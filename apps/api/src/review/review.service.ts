import { Inject, Injectable, Logger } from '@nestjs/common';
import {
    REVIEW_VERDICT_JSON_SCHEMA,
    ReviewOutcome,
    ReviewReport,
} from '@tbn/shared';
import { Op, QueryTypes, Sequelize } from 'sequelize';

import { AgentsService } from '../agents/agents.service.js';
import { AgentCallError } from '../agents/providers/index.js';
import {
    CLUSTERS_MODEL,
    MEANINGS_MODEL,
    NAMES_MODEL,
    SEQUELIZE,
    SOURCES_MODEL,
    VERIFICATIONS_MODEL,
} from '../database/database.constants.js';
import { LookupsService } from '../database/lookups.service.js';
import {
    ClustersModel,
    IAgent,
    IMeaning,
    MeaningsModel,
    NamesModel,
    NamesRow,
    SourcesModel,
    VerificationsModel,
} from '../database/models.js';
import { render, SYSTEM } from './prompt.js';
import {
    applyVerdict,
    Candidate,
    parseVerdict,
    ReviewModels,
    subjectOf,
} from './reviewer.js';

/** Room for a verdict with a note, and no more. */
const MAX_TOKENS = 800;

export interface RunOptions {
    limit: number;
    /** Called after each cluster, so a caller can show progress or stop. */
    onProgress?: (outcome: ReviewOutcome | null) => void;
    signal?: AbortSignal;
}

@Injectable()
export class ReviewService {
    private readonly logger = new Logger(ReviewService.name);

    constructor(
        @Inject(SEQUELIZE) private readonly sequelize: Sequelize,
        @Inject(NAMES_MODEL) private readonly names: NamesModel,
        @Inject(MEANINGS_MODEL) private readonly meanings: MeaningsModel,
        @Inject(CLUSTERS_MODEL) private readonly clusters: ClustersModel,
        @Inject(SOURCES_MODEL) private readonly sources: SourcesModel,
        @Inject(VERIFICATIONS_MODEL)
        private readonly verifications: VerificationsModel,
        private readonly agents: AgentsService,
        private readonly lookups: LookupsService,
    ) {}

    private get models(): ReviewModels {
        return {
            sequelize: this.sequelize,
            names: this.names,
            meanings: this.meanings,
            sources: this.sources,
            verifications: this.verifications,
        };
    }

    /**
     * How many clusters this agent has left to look at. The dashboard shows it
     * before a run so "review the queue" has a number attached.
     */
    async pending(agentId: number): Promise<number> {
        const [row] = await this.sequelize.query<{ count: string }>(
            `SELECT count(*)::text AS count FROM (${UNREVIEWED}) AS pending`,
            { type: QueryTypes.SELECT, replacements: { agentId, limit: null } },
        );

        return Number(row.count);
    }

    /**
     * The clusters this agent has not answered on yet. Ordered by id so a run
     * that stops and starts again carries on rather than beginning afresh.
     */
    async candidates(agentId: number, limit: number): Promise<Candidate[]> {
        const rows = await this.sequelize.query<{ cluster_id: number }>(
            UNREVIEWED,
            {
                type: QueryTypes.SELECT,
                replacements: { agentId, limit },
            },
        );

        return this.gather(rows.map(({ cluster_id }) => cluster_id));
    }

    /**
     * Asks the agent about each cluster in turn and applies what it says.
     *
     * One at a time on purpose: a local model answers one request at a time
     * anyway, a hosted one rate-limits, and a failure part way through leaves
     * everything before it applied rather than a batch half-written.
     */
    async run(agent: IAgent, options: RunOptions): Promise<ReviewReport> {
        const report: ReviewReport = {
            agent: agent.slug,
            reviewed: 0,
            abstained: 0,
            published: 0,
            rejected: 0,
            added: 0,
            dropped: 0,
            failed: 0,
            outcomes: [],
        };

        const config = this.agents.configOf(agent);
        const candidates = await this.candidates(agent.id, options.limit);

        for (const candidate of candidates) {
            if (options.signal?.aborted) {
                break;
            }

            const outcome = await this.one(agent, config, candidate, options);

            if (!outcome) {
                report.failed += 1;
            } else {
                report.reviewed += 1;
                report.abstained += outcome.abstained ? 1 : 0;
                report.published += outcome.published;
                report.rejected += outcome.rejected;
                report.added += outcome.added;
                report.dropped += outcome.dropped;
                report.outcomes.push(outcome);
            }

            options.onProgress?.(outcome);
        }

        return report;
    }

    /** One cluster. Returns null when the model could not be asked or read. */
    private async one(
        agent: IAgent,
        config: ReturnType<AgentsService['configOf']>,
        candidate: Candidate,
        options: RunOptions,
    ): Promise<ReviewOutcome | null> {
        let answer: string;

        try {
            const reply = await this.agents.ask(config, {
                system: SYSTEM,
                prompt: render(subjectOf(candidate)),
                maxTokens: MAX_TOKENS,
                schema: {
                    name: 'review_verdict',
                    json: REVIEW_VERDICT_JSON_SCHEMA,
                },
                signal: options.signal,
            });

            answer = reply.text;
        } catch (error) {
            // A refused or unreachable provider is the run's problem, not this
            // cluster's: it is left untouched and unreviewed, to be asked again.
            this.logger.warn(
                `${candidate.name}: ${(error as AgentCallError).message}`,
            );

            return null;
        }

        const parsed = parseVerdict(answer);

        if ('unreadable' in parsed) {
            this.logger.warn(`${candidate.name}: ${parsed.unreadable}`);

            return null;
        }

        return applyVerdict(this.models, agent, candidate, parsed.verdict);
    }

    /** The rows, readings and labels for a page of clusters, in three reads. */
    private async gather(clusterIds: number[]): Promise<Candidate[]> {
        if (!clusterIds.length) {
            return [];
        }

        const [clusters, rows, readings, labels, sources] = await Promise.all([
            this.clusters.findAll({ where: { id: { [Op.in]: clusterIds } } }),
            this.names.findAll({
                where: { clusterId: { [Op.in]: clusterIds } },
                order: ['id'],
            }),
            this.meanings.findAll({
                where: { clusterId: { [Op.in]: clusterIds } },
                order: ['id'],
            }),
            this.lookups.labels(),
            this.sources.findAll({ attributes: ['id', 'slug'], raw: true }),
        ]);

        const slugs = new Map(
            (sources as unknown as Array<{ id: number; slug: string }>).map(
                ({ id, slug }) => [id, slug],
            ),
        );

        const byCluster = <T extends { clusterId: number | null }>(
            all: Array<{ dataValues: T }>,
            id: number,
        ): T[] =>
            all
                .map(({ dataValues }) => dataValues)
                .filter((row) => row.clusterId === id);

        return clusters.map(({ dataValues: cluster }) => {
            const here = byCluster<NamesRow>(rows, cluster.id);
            const first = here[0];

            return {
                clusterId: cluster.id,
                name: cluster.name,
                gender: cluster.gender,
                // From the first row: religion and language are per row, and
                // the model is being asked about the spelling, not the filing.
                religion: first?.religionId
                    ? (labels.religions.get(first.religionId) ?? null)
                    : null,
                language: first?.languageId
                    ? (labels.languages.get(first.languageId) ?? null)
                    : null,
                rows: here,
                readings: byCluster<IMeaning>(readings, cluster.id),
                sources: slugs,
            };
        });
    }
}

/**
 * Clusters with something still to decide, that this agent has not already
 * answered on. "Answered on" includes abstaining: a model that looked and would
 * not decide should not be asked the same question on the next run.
 */
const UNREVIEWED = `
    SELECT c."id" AS cluster_id
    FROM "clusters" c
    WHERE (
        EXISTS (
            SELECT 1 FROM "names" n
            WHERE n."cluster_id" = c."id" AND n."status" = 'candidate'
        )
        OR EXISTS (
            SELECT 1 FROM "meanings" m
            WHERE m."cluster_id" = c."id" AND m."status" = 'candidate'
        )
    )
    AND NOT EXISTS (
        SELECT 1 FROM "verifications" v
        LEFT JOIN "names" vn ON vn."id" = v."name_id"
        LEFT JOIN "meanings" vm ON vm."id" = v."meaning_id"
        WHERE v."agent_id" = :agentId
          AND COALESCE(vn."cluster_id", vm."cluster_id") = c."id"
    )
    ORDER BY c."id"
    LIMIT COALESCE(:limit, 2147483647)
`;
