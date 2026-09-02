import { Inject, Injectable } from '@nestjs/common';
import {
    AdminAgent,
    AGENT_PROVIDER_LABELS,
    AgentCheck,
    AgentCreate,
    AgentProviders,
    AgentUpdate,
} from '@tbn/shared';

import { AgentKeyError } from '../../agents/agent-keys.js';
import { AgentsService } from '../../agents/agents.service.js';
import { providerSummaries } from '../../agents/providers/index.js';
import { AGENTS_MODEL } from '../../database/database.constants.js';
import { AgentDraft, AgentsModel, IAgent } from '../../database/models.js';

/** Lowercase, dashes, no run of them: `Claude Sonnet 5` → `claude-sonnet-5`. */
const slugify = (name: string): string =>
    name
        .normalize('NFKD')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 48) || 'agent';

/**
 * The row as the dashboard is allowed to see it. The key is not in here, and
 * `hasKey` is the whole of what can be said about one once it is saved.
 */
const seen = (agent: IAgent): AdminAgent => ({
    id: agent.id,
    slug: agent.slug,
    name: agent.name,
    provider: agent.provider,
    baseUrl: agent.baseUrl,
    model: agent.model,
    hasKey: !!agent.keyCiphertext,
    options: agent.options ?? {},
    enabled: agent.enabled,
});

/** Null when no such agent, which the handler reports as a 404. */
export type Found<T> = T | null;

@Injectable()
export class AdminAgentsService {
    constructor(
        @Inject(AGENTS_MODEL) private readonly agents: AgentsModel,
        private readonly runtime: AgentsService,
    ) {}

    /**
     * What the registry knows, plus whether a key can be sealed at all. A
     * provider that needs one is unusable while `AGENT_KEY_SECRET` is unset,
     * and saying so beats a save that fails for no visible reason.
     */
    providers(): AgentProviders {
        const canSealKeys = this.runtime.canSealKeys;

        return {
            canSealKeys,
            providers: providerSummaries().map((provider) => ({
                ...provider,
                label: AGENT_PROVIDER_LABELS[provider.id],
                usable: canSealKeys || !provider.needsKey,
            })),
        };
    }

    async list(): Promise<AdminAgent[]> {
        const rows = await this.agents.findAll({ order: ['id'] });

        return rows.map(({ dataValues }) => seen(dataValues));
    }

    async create(input: AgentCreate): Promise<AdminAgent> {
        const row = await this.agents.create({
            slug: await this.freeSlug(slugify(input.name)),
            name: input.name,
            provider: input.provider,
            model: input.model,
            baseUrl: input.baseUrl,
            options: input.options,
            enabled: input.enabled,
            ...this.keyColumns(input.apiKey),
        });

        return seen(row.dataValues);
    }

    async update({ id, ...input }: AgentUpdate): Promise<Found<AdminAgent>> {
        const existing = await this.agents.findByPk(id);

        if (!existing) {
            return null;
        }

        // The slug is left alone on purpose: an agent's own readings are
        // attributed to a source named after it, and renaming the display name
        // must not orphan that.
        const draft: Partial<AgentDraft> = {
            ...(input.name === undefined ? {} : { name: input.name }),
            ...(input.model === undefined ? {} : { model: input.model }),
            ...(input.baseUrl === undefined ? {} : { baseUrl: input.baseUrl }),
            ...(input.options === undefined ? {} : { options: input.options }),
            ...(input.enabled === undefined ? {} : { enabled: input.enabled }),
            // Absent leaves the saved key alone; null clears it; a string
            // replaces it. Sending an unchanged key back to change the model
            // would mean the dashboard had to hold one.
            ...(input.apiKey === undefined
                ? {}
                : this.keyColumns(input.apiKey)),
        };

        await this.agents.update(draft, { where: { id } });

        const saved = await this.agents.findByPk(id);

        return saved ? seen(saved.dataValues) : null;
    }

    /**
     * For an agent configured by mistake. `enabled: false` is what retires one
     * that has done work — its verdicts stay in the ledger, and a ledger
     * pointing at a missing agent cannot say who decided.
     */
    async remove(id: number): Promise<Found<number>> {
        const removed = await this.agents.destroy({ where: { id } });

        return removed ? id : null;
    }

    async check(id: number): Promise<Found<AgentCheck>> {
        const agent = await this.runtime.byId(id);

        if (!agent) {
            return null;
        }

        try {
            const outcome = await this.runtime.check(agent);

            return outcome.ok
                ? { ok: true, why: null }
                : { ok: false, why: outcome.why };
        } catch (error) {
            // A missing or changed AGENT_KEY_SECRET is a configuration fault,
            // not a fault of the endpoint being checked.
            if (error instanceof AgentKeyError) {
                return { ok: false, why: error.message };
            }

            throw error;
        }
    }

    private keyColumns(apiKey: string | null | undefined) {
        if (!apiKey) {
            return { keyCiphertext: null, keyIv: null, keyTag: null };
        }

        return this.runtime.sealKey(apiKey);
    }

    /** `claude`, then `claude-2`, so two agents may share a display name. */
    private async freeSlug(wanted: string): Promise<string> {
        for (let attempt = 1; ; attempt += 1) {
            const slug = attempt === 1 ? wanted : `${wanted}-${attempt}`;

            if (!(await this.agents.findOne({ where: { slug } }))) {
                return slug;
            }
        }
    }
}
