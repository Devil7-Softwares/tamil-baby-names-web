import { Inject, Injectable, Logger } from '@nestjs/common';
import {
    REVIEW_BATCH_JSON_SCHEMA,
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
    REVIEW_RUN_FAILURES_MODEL,
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
    ReviewRunFailuresModel,
    SourcesModel,
    VerificationsModel,
} from '../database/models.js';
import { render, renderBatch, SYSTEM } from './prompt.js';
import {
    applyVerdict,
    Candidate,
    parseBatch,
    parseVerdict,
    ReviewModels,
    subjectOf,
} from './reviewer.js';

/** Room for a verdict with a note, and no more. */
const MAX_TOKENS = 800;

export interface RunOptions {
    limit: number;
    /** The run this is, stamped on every verdict so it can be re-asked later. */
    runId?: number | null;
    /** Take that run's clusters instead of the ones this agent has not seen. */
    compareWith?: number | null;
    /** False records what the agent would have done and changes nothing. */
    applied?: boolean;
    /** Clusters per request. 1 asks about each on its own, as before. */
    batch?: number;
    /** Only clusters that hold no reading at all — see `UNWRITTEN`. */
    unwritten?: boolean;
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
        @Inject(REVIEW_RUN_FAILURES_MODEL)
        private readonly failures: ReviewRunFailuresModel,
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
    async pending(agentId: number, unwritten = false): Promise<number> {
        const [row] = await this.sequelize.query<{ count: string }>(
            `SELECT count(*)::text AS count FROM (${queue(unwritten)}) AS pending`,
            { type: QueryTypes.SELECT, replacements: { agentId, limit: null } },
        );

        return Number(row.count);
    }

    /**
     * How many clusters an earlier run looked at. A re-ask is over these, and
     * zero means the run wrote no verdict worth re-asking — which is what a run
     * that failed on its first cluster leaves behind.
     */
    async reAskable(runId: number): Promise<number> {
        const [row] = await this.sequelize.query<{ count: string }>(
            `SELECT count(*)::text AS count FROM (${RE_ASK}) AS asked`,
            {
                type: QueryTypes.SELECT,
                replacements: { sourceRun: runId, limit: null },
            },
        );

        return Number(row.count);
    }

    /**
     * The clusters this agent has not answered on yet. Ordered by id so a run
     * that stops and starts again carries on rather than beginning afresh.
     */
    async candidates(
        agentId: number,
        limit: number,
        compareWith?: number | null,
        unwritten = false,
    ): Promise<Candidate[]> {
        const rows = await this.sequelize.query<{ cluster_id: number }>(
            compareWith ? RE_ASK : queue(unwritten),
            {
                type: QueryTypes.SELECT,
                replacements: compareWith
                    ? { sourceRun: compareWith, limit }
                    : { agentId, limit },
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
            unchanged: 0,
            published: 0,
            rejected: 0,
            added: 0,
            dropped: 0,
            failed: 0,
            outcomes: [],
        };

        const config = this.agents.configOf(agent);
        const candidates = await this.candidates(
            agent.id,
            options.limit,
            options.compareWith,
            options.unwritten,
        );

        const tally = (outcome: ReviewOutcome | null): void => {
            if (!outcome) {
                report.failed += 1;
            } else {
                report.reviewed += 1;
                report.abstained += outcome.abstained ? 1 : 0;
                report.unchanged += outcome.unchanged ? 1 : 0;
                report.published += outcome.published;
                report.rejected += outcome.rejected;
                report.added += outcome.added;
                report.dropped += outcome.dropped;
                report.outcomes.push(outcome);
            }

            options.onProgress?.(outcome);
        };

        // Workers pulling from one queue rather than fixed slices: the clusters
        // take wildly different times — a model abstains in a second and
        // reasons for twenty — and slicing would leave most workers idle
        // waiting for the slowest.
        // Batches, not clusters, are what a worker pulls. At a batch of one
        // this is the old loop exactly — same prompt, same schema — because
        // every calibration figure behind the model comparison was measured
        // that way and a "no batching" run must not quietly become something
        // else.
        const size = Math.max(1, options.batch ?? 1);
        const batches: Candidate[][] = [];

        for (let at = 0; at < candidates.length; at += size) {
            batches.push(candidates.slice(at, at + size));
        }

        const queue = batches[Symbol.iterator]();
        const width = Math.max(
            1,
            Math.min(this.agents.concurrencyOf(agent), batches.length),
        );

        const worker = async (): Promise<void> => {
            for (;;) {
                if (options.signal?.aborted) {
                    return;
                }

                const next = queue.next();

                if (next.done) {
                    return;
                }

                // Tallied as each finishes, so the counts and the progress the
                // page polls stay in step with what has actually been decided.
                const outcomes =
                    next.value.length === 1
                        ? [
                              await this.one(
                                  agent,
                                  config,
                                  next.value[0],
                                  options,
                              ),
                          ]
                        : await this.many(agent, config, next.value, options);

                outcomes.forEach(tally);
            }
        };

        await Promise.all(Array.from({ length: width }, worker));

        return report;
    }

    /**
     * Which clusters a run could not ask about, and why.
     *
     * Not the ledger: `verifications` is what the queue reads to decide a
     * cluster has been answered, and a failure written there would answer it
     * and lose it. This says only that the run reached the cluster and got
     * nothing back, which is what "1,050 failed" needs to be able to name.
     *
     * Never allowed to end a run. A run that stopped because it could not
     * write down that it had failed would be a worse failure than the one it
     * was recording.
     */
    private async noAnswer(
        options: RunOptions,
        clusters: Candidate[],
        error: string,
    ): Promise<void> {
        const runId = options.runId;

        if (!runId || !clusters.length) {
            return;
        }

        try {
            await this.failures.bulkCreate(
                clusters.map((candidate) => ({
                    runId,
                    clusterId: candidate.clusterId,
                    error,
                })),
                { ignoreDuplicates: true },
            );
        } catch (error_) {
            this.logger.warn(
                `Could not record the failure: ${(error_ as Error).message}`,
            );
        }
    }

    /**
     * Several clusters in one request, and one outcome back for every one of
     * them — a null where the model said nothing about it.
     *
     * The saving is the standing instructions, which are most of a request and
     * are sent once instead of once per name. What it costs is independence:
     * the model is filling a list rather than answering a question, and on
     * names with no reading yet, declining is the answer that matters most.
     *
     * A verdict names the cluster it is about rather than relying on order, so
     * a model that returns nine of ten does not shift every later verdict onto
     * the wrong name. Anything it left out is a failure for that cluster and
     * not a silent skip: an unanswered name must come round again.
     */
    private async many(
        agent: IAgent,
        config: ReturnType<AgentsService['configOf']>,
        batch: Candidate[],
        options: RunOptions,
    ): Promise<Array<ReviewOutcome | null>> {
        let answer: string;

        try {
            const reply = await this.agents.ask(config, {
                system: SYSTEM,
                prompt: renderBatch(batch.map(subjectOf)),
                // Every verdict needs its own note, so the ceiling has to grow
                // with the batch or the last few arrive truncated.
                maxTokens: MAX_TOKENS * batch.length,
                schema: {
                    name: 'review_verdicts',
                    json: REVIEW_BATCH_JSON_SCHEMA,
                },
                signal: options.signal,
            });

            answer = reply.text;
        } catch (error) {
            const message = (error as AgentCallError).message;

            this.logger.warn(`${batch.length} names: ${message}`);
            await this.noAnswer(options, batch, message);

            return batch.map(() => null);
        }

        const parsed = parseBatch(answer);

        if ('unreadable' in parsed) {
            // One malformed answer costs the whole batch, which is the price of
            // asking together and worth saying out loud in the log.
            this.logger.warn(`${batch.length} names: ${parsed.unreadable}`);
            await this.noAnswer(options, batch, parsed.unreadable);

            return batch.map(() => null);
        }

        const byIndex = new Map(
            parsed.batch.verdicts.map((verdict) => [verdict.at, verdict]),
        );

        return Promise.all(
            batch.map(async (candidate, at) => {
                const verdict = byIndex.get(at + 1);

                if (!verdict) {
                    const message = 'The batch came back without this one.';

                    this.logger.warn(`${candidate.name}: no verdict returned.`);
                    await this.noAnswer(options, [candidate], message);

                    return null;
                }

                return applyVerdict(this.models, agent, candidate, verdict, {
                    runId: options.runId,
                    applied: options.applied,
                });
            }),
        );
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
            const message = (error as AgentCallError).message;

            this.logger.warn(`${candidate.name}: ${message}`);
            await this.noAnswer(options, [candidate], message);

            return null;
        }

        const parsed = parseVerdict(answer);

        if ('unreadable' in parsed) {
            this.logger.warn(`${candidate.name}: ${parsed.unreadable}`);
            await this.noAnswer(options, [candidate], parsed.unreadable);

            return null;
        }

        return applyVerdict(this.models, agent, candidate, parsed.verdict, {
            runId: options.runId,
            applied: options.applied,
        });
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
/**
 * The clusters an earlier run looked at, whatever it decided about them and
 * whoever asked. Re-asking deliberately ignores "this agent has already
 * answered": the point is a second answer to the same question.
 */
const RE_ASK = `
    SELECT DISTINCT COALESCE(vn."cluster_id", vm."cluster_id") AS cluster_id
    FROM "verifications" v
    LEFT JOIN "names" vn ON vn."id" = v."name_id"
    LEFT JOIN "meanings" vm ON vm."id" = v."meaning_id"
    WHERE v."run_id" = :sourceRun
      AND COALESCE(vn."cluster_id", vm."cluster_id") IS NOT NULL
    ORDER BY 1
    LIMIT COALESCE(:limit, 2147483647)
`;

/**
 * Names with no reading at all, which is a different job from choosing between
 * rival ones: there is nothing to weigh, and the model is being asked to write.
 *
 * Worth asking for on its own because the queue is ordered by cluster id and
 * these arrived last — 12,562 of them from `nithra.babyname`, sitting behind
 * every older cluster that an import has since given a new candidate row. A
 * run would not reach them for a very long time.
 */
const UNWRITTEN = `
    AND NOT EXISTS (
        SELECT 1 FROM "meanings" m2 WHERE m2."cluster_id" = c."id"
    )
`;

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
    /* unwritten */
    ORDER BY c."id"
    LIMIT COALESCE(:limit, 2147483647)
`;

/** The unreviewed queue, narrowed to names nobody has written a reading for. */
const queue = (unwritten: boolean): string =>
    UNREVIEWED.replace('/* unwritten */', unwritten ? UNWRITTEN : '');
