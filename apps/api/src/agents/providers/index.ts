import { AGENT_PROVIDERS, AgentProviderId } from '@tbn/shared';

import { anthropic } from './anthropic.js';
import { ollama } from './ollama.js';
import { openai } from './openai.js';
import { AgentProvider } from './provider.js';

/**
 * Every provider the application knows. Adding one is a file beside these, an
 * entry here and an entry in `AGENT_PROVIDERS` — no migration, because
 * `agents.provider` is TEXT and this map is what says which values are real.
 */
const REGISTRY: Record<AgentProviderId, AgentProvider> = {
    anthropic,
    openai,
    ollama,
};

export const providerOf = (id: string): AgentProvider | null =>
    (REGISTRY as Record<string, AgentProvider>)[id] ?? null;

/** Throws rather than returns null, for the paths where absence is a bug. */
export const requireProvider = (id: string): AgentProvider => {
    const provider = providerOf(id);

    if (!provider) {
        throw new Error(`No provider named “${id}”.`);
    }

    return provider;
};

export const isProviderId = (id: string): id is AgentProviderId =>
    providerOf(id) !== null;

/**
 * The registry answering for itself, so nothing has to keep a second list of
 * which providers want a key.
 */
export const providerSummaries = (): Array<{
    id: AgentProviderId;
    defaultBaseUrl: string;
    needsKey: boolean;
    concurrency: number;
}> =>
    AGENT_PROVIDERS.map((id) => ({
        id,
        defaultBaseUrl: REGISTRY[id].defaultBaseUrl,
        needsKey: REGISTRY[id].needsKey,
        concurrency: REGISTRY[id].concurrency,
    }));

export * from './provider.js';
