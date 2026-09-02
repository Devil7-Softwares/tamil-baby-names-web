/**
 * The APIs an agent can speak. Three shapes cover the field: Anthropic's
 * Messages API, the OpenAI chat-completions shape that most hosted models and
 * every gateway imitate, and Ollama's, which is the same idea again for a model
 * running on this machine.
 *
 * A new provider is a file in `apps/api/src/agents/providers` and an entry
 * here. Deliberately *not* a Postgres enum: the registry is what knows which
 * providers exist, and adding one should not need a migration.
 */
export const AGENT_PROVIDERS = ['anthropic', 'openai', 'ollama'] as const;

export type AgentProviderId = (typeof AGENT_PROVIDERS)[number];

export const AGENT_PROVIDER_LABELS: Record<AgentProviderId, string> = {
    anthropic: 'Claude API',
    openai: 'OpenAI-compatible',
    ollama: 'Ollama',
};
