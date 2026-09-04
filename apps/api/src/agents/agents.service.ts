import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AGENTS_MODEL } from '../database/database.constants.js';
import { AgentsModel, IAgent } from '../database/models.js';
import { AgentKeyError, open, seal, sealedOf } from './agent-keys.js';
import {
    AgentCallError,
    AgentConfig,
    AgentReply,
    AgentRequest,
    requireProvider,
} from './providers/index.js';

/** Enough for a verdict on a cluster; the caller may ask for more. */
const MAX_TOKENS = 4096;
const TEMPERATURE = 0;

/** Somebody is watching a check, so it gives up long before a run would. */
const CHECK_TIMEOUT_MS = 30_000;

@Injectable()
export class AgentsService {
    private readonly logger = new Logger(AgentsService.name);

    constructor(
        @Inject(AGENTS_MODEL) private readonly agents: AgentsModel,
        private readonly config: ConfigService,
    ) {
        if (!this.secret) {
            this.logger.warn(
                'AGENT_KEY_SECRET is not set, so agents that need an API key cannot be used.',
            );
        }
    }

    private get secret(): string | undefined {
        return this.config.get<string>('AGENT_KEY_SECRET');
    }

    /**
     * Whether a key can be sealed at all. An agent that needs no key — Ollama
     * on this machine — works whatever this says.
     */
    get canSealKeys(): boolean {
        return !!this.secret;
    }

    sealKey(plaintext: string) {
        return seal(this.secret, plaintext);
    }

    /**
     * The row as the provider needs it, with the key opened. Separate from the
     * call so a caller reviewing 600 clusters opens the key once.
     */
    configOf(agent: IAgent): AgentConfig {
        const provider = requireProvider(agent.provider);
        const sealed = sealedOf(agent);

        if (provider.needsKey && !sealed) {
            throw new AgentCallError(
                `“${agent.name}” has no API key, and ${provider.id} needs one.`,
            );
        }

        return {
            provider: agent.provider,
            baseUrl: agent.baseUrl,
            model: agent.model,
            apiKey: sealed ? open(this.secret, sealed) : null,
            options: agent.options ?? {},
        };
    }

    /**
     * One call. Errors arrive as `AgentCallError` whichever provider produced
     * them, so a run can tell "try again" from "this will never work".
     */
    async ask(
        config: AgentConfig,
        request: Partial<AgentRequest> &
            Pick<AgentRequest, 'system' | 'prompt'>,
    ): Promise<AgentReply> {
        return requireProvider(config.provider).complete(config, {
            maxTokens: MAX_TOKENS,
            temperature: TEMPERATURE,
            ...request,
        });
    }

    /**
     * How many requests a run may have open against this agent, from the agent
     * where it says so and the provider where it does not.
     */
    concurrencyOf(agent: IAgent): number {
        return agent.concurrency ?? requireProvider(agent.provider).concurrency;
    }

    /**
     * Proves the endpoint, the model name and the key are all right before a
     * run depends on them. The ceiling is generous rather than minimal: a
     * reasoning model spends tokens thinking before it writes a word, and a
     * check that fails for that reason would be reporting its own impatience.
     *
     * The deadline is the exception, and is much shorter than a run's. Somebody
     * is watching this one, and "it does not answer" is the single most useful
     * thing a check can find out — `gemini-3.7-flash` never answers here at
     * all, and before this the button simply spun.
     */
    async check(
        agent: IAgent,
    ): Promise<{ ok: true } | { ok: false; why: string }> {
        try {
            await this.ask(this.configOf(agent), {
                system: 'Answer with one word.',
                prompt: 'Reply with the word: ready',
                maxTokens: 512,
                timeoutMs: CHECK_TIMEOUT_MS,
            });

            return { ok: true };
        } catch (error) {
            if (
                error instanceof AgentCallError ||
                error instanceof AgentKeyError
            ) {
                return { ok: false, why: error.message };
            }

            throw error;
        }
    }

    async byId(id: number): Promise<IAgent | null> {
        const row = await this.agents.findByPk(id);

        return row?.dataValues ?? null;
    }
}
