import { AgentProviderId } from '@tbn/shared';

/** What the caller asks for, in terms every provider can express. */
export interface AgentRequest {
    /** Standing instructions. Sent as a system prompt where one exists. */
    system: string;
    prompt: string;
    maxTokens: number;
    /**
     * Ignored by providers whose models reject it — Claude's current ones do,
     * and ask for depth through `effort` instead.
     */
    temperature: number;
    /** Aborts a call that has stopped answering; a run cancels through this. */
    signal?: AbortSignal;
}

export interface AgentReply {
    text: string;
    /** Tokens in and out where the provider reports them, for cost and logs. */
    usage: { input: number; output: number } | null;
}

/** One configured endpoint, with its key already opened. */
export interface AgentConfig {
    provider: AgentProviderId;
    /** Null for the provider's own endpoint. */
    baseUrl: string | null;
    model: string;
    apiKey: string | null;
    options: Record<string, unknown>;
}

/**
 * A provider is a translation, nothing more: our request into one API's shape
 * and its answer back out. Everything that decides *what* to ask lives above
 * this, so a new API is one file and a line in the registry.
 */
export interface AgentProvider {
    readonly id: AgentProviderId;
    /** Used when the agent row names no `baseUrl`. */
    readonly defaultBaseUrl: string;
    /** False for a provider that runs locally and authenticates nothing. */
    readonly needsKey: boolean;
    complete(config: AgentConfig, request: AgentRequest): Promise<AgentReply>;
}

/** A provider said no. Carries the status so a run can tell retry from give up. */
export class AgentCallError extends Error {
    constructor(
        message: string,
        readonly status: number | null = null,
    ) {
        super(message);
    }

    /** Rate limits and 5xx are worth trying again; a 400 never is. */
    get retryable(): boolean {
        return (
            this.status === null || this.status === 429 || this.status >= 500
        );
    }
}

/** An empty answer is a failure worth naming, not an empty string to parse. */
export const text = (value: string, provider: string): string => {
    if (!value.trim()) {
        throw new AgentCallError(`${provider} answered with no text.`);
    }

    return value;
};

const trimSlash = (url: string): string => url.replace(/\/+$/, '');

export const endpointOf = (
    { baseUrl }: AgentConfig,
    provider: AgentProvider,
    path: string,
): string => `${trimSlash(baseUrl || provider.defaultBaseUrl)}${path}`;

/** A number the agent's `options` may override, within reason. */
export const dial = (
    options: Record<string, unknown>,
    key: string,
    fallback: number,
): number => {
    const value = options[key];

    return typeof value === 'number' && Number.isFinite(value)
        ? value
        : fallback;
};

/** Extra headers a gateway wants, ignored unless they are all strings. */
export const extraHeaders = (
    options: Record<string, unknown>,
): Record<string, string> => {
    const headers = options.headers;

    if (!headers || typeof headers !== 'object') {
        return {};
    }

    return Object.fromEntries(
        Object.entries(headers as Record<string, unknown>).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
    );
};

/**
 * One place every provider funnels through, so a failure reads the same
 * whichever API produced it and the body is kept — providers explain refusals
 * there, and a run's error column is worthless without it.
 */
export const post = async (
    url: string,
    headers: Record<string, string>,
    body: unknown,
    signal?: AbortSignal,
): Promise<unknown> => {
    let response: Response;

    try {
        response = await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...headers },
            body: JSON.stringify(body),
            signal,
        });
    } catch (error) {
        throw new AgentCallError(
            `Could not reach ${url}: ${(error as Error).message}`,
        );
    }

    const payload = await response.text();

    if (!response.ok) {
        throw new AgentCallError(
            `${url} answered ${response.status}: ${payload.slice(0, 500)}`,
            response.status,
        );
    }

    try {
        return JSON.parse(payload) as unknown;
    } catch {
        throw new AgentCallError(`${url} answered with something not JSON.`);
    }
};
