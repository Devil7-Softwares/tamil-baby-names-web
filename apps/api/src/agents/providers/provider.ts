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
    /**
     * A JSON Schema the answer must fit. Every provider has its own way of
     * being held to one, so each expresses this natively rather than the
     * caller begging for JSON in the prompt.
     */
    schema?: { name: string; json: Record<string, unknown> };
    /** Aborts a call that has stopped answering; a run cancels through this. */
    signal?: AbortSignal;
    /**
     * How long to wait before giving up. A caller that passes nothing gets
     * `DEFAULT_TIMEOUT_MS`, because no deadline at all is not a slower run —
     * it is a run that stops on one cluster and never says why.
     */
    timeoutMs?: number;
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

/**
 * Long enough for a reasoning model on a hard name, short enough that a run of
 * thousands cannot be stopped for an afternoon by one of them.
 */
export const DEFAULT_TIMEOUT_MS = 120_000;

/** The caller's signal and a deadline, and which of the two ended the call. */
export interface Deadline {
    signal: AbortSignal;
    /** True once the deadline rather than the caller aborted it. */
    expired: () => boolean;
    ms: number;
}

/**
 * A deadline for one call, from the agent's `timeout` option or the caller's.
 *
 * Every provider gets one, because a model that never answers is not a slow
 * answer — it is no answer, and without this it arrives as a request that never
 * ends: the Test button spins, and a run sits on one cluster with nothing in
 * the log. `gemini-3.7-flash` through the OpenAI-compatible endpoint does
 * exactly that, while other Gemini models answer the same request in a second.
 */
export const deadlineFor = (
    config: AgentConfig,
    request: AgentRequest,
): Deadline => {
    const ms = dial(
        config.options,
        'timeout',
        request.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
    const clock = AbortSignal.timeout(ms);

    return {
        signal: request.signal
            ? AbortSignal.any([request.signal, clock])
            : clock,
        expired: () => clock.aborted,
        ms,
    };
};

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

/** Said the same way whichever provider ran out of time. */
export const expired = (what: string, ms: number): string =>
    `${what} did not answer within ${Math.round(ms / 1000)}s. ` +
    `Raise the agent's "timeout" option if it needs longer.`;

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
    deadline?: Deadline,
): Promise<unknown> => {
    let response: Response;

    try {
        response = await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...headers },
            body: JSON.stringify(body),
            signal: deadline?.signal,
        });
    } catch (error) {
        // "This operation was aborted" says nothing about whose fault it was.
        if (deadline?.expired()) {
            throw new AgentCallError(expired(url, deadline.ms));
        }

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
