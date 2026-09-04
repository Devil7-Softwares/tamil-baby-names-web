import {
    Inject,
    Injectable,
    Logger,
    OnApplicationBootstrap,
} from '@nestjs/common';
import { AdminReviewRun, ReviewOutcome } from '@tbn/shared';
import { Op } from 'sequelize';

import { DatabaseBootstrap } from '../database/database.bootstrap.js';
import {
    AGENTS_MODEL,
    REVIEW_RUNS_MODEL,
} from '../database/database.constants.js';
import {
    AgentsModel,
    IAgent,
    IReviewRun,
    ReviewRunsModel,
} from '../database/models.js';
import { ReviewService } from './review.service.js';

/** Written after each cluster, so the dashboard's poll always has something. */
type Counts = Pick<
    IReviewRun,
    | 'reviewed'
    | 'abstained'
    | 'unchanged'
    | 'published'
    | 'rejected'
    | 'added'
    | 'dropped'
    | 'failed'
>;

const ZERO: Counts = {
    reviewed: 0,
    abstained: 0,
    unchanged: 0,
    published: 0,
    rejected: 0,
    added: 0,
    dropped: 0,
    failed: 0,
};

/** Why a run could not be started, in words the dashboard shows as they are. */
export class RunRefused extends Error {}

export interface StartOptions {
    /** Re-ask that run's clusters rather than the ones this agent has not seen. */
    compareWith?: number | null;
    /** False records what the agent would have done and changes nothing. */
    applied?: boolean;
    /** Only names that hold no reading at all — writing, not choosing. */
    unwritten?: boolean;
}

const seen = (run: IReviewRun, agent: string): AdminReviewRun => ({
    id: run.id,
    agentId: run.agentId,
    agent,
    status: run.status,
    requested: run.requested,
    total: run.total,
    reviewed: run.reviewed,
    abstained: run.abstained,
    unchanged: run.unchanged,
    published: run.published,
    rejected: run.rejected,
    added: run.added,
    dropped: run.dropped,
    failed: run.failed,
    error: run.error,
    compareWith: run.compareWith,
    applied: run.applied,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
});

/**
 * Runs an agent over the queue in the background.
 *
 * The work happens in this process rather than a queue or a worker, because
 * there is one API process and adding a broker to run a loop would be a bigger
 * thing than the loop. What that costs is honesty about restarts: a run only
 * exists while the process that started it does, so `onModuleInit` closes out
 * anything left `running` by a process that is gone.
 */
@Injectable()
export class ReviewRunsService implements OnApplicationBootstrap {
    private readonly logger = new Logger(ReviewRunsService.name);

    /** Live runs, by id. Empty after a restart, which is what the sweep is for. */
    private readonly running = new Map<number, AbortController>();

    constructor(
        @Inject(REVIEW_RUNS_MODEL) private readonly runs: ReviewRunsModel,
        @Inject(AGENTS_MODEL) private readonly agents: AgentsModel,
        private readonly review: ReviewService,
        private readonly database: DatabaseBootstrap,
    ) {}

    /**
     * Starts the sweep, and does not wait for it.
     *
     * `database.ready` resolves during `onApplicationBootstrap`, so a hook that
     * awaits it is waiting on something that has not been allowed to happen yet
     * — awaiting it here would deadlock the boot, whatever order the hooks run
     * in. Detaching it also keeps housekeeping off the path that starts serving.
     */
    onApplicationBootstrap(): void {
        void this.sweep();
    }

    /**
     * Closes out runs left behind by a process that is gone. Housekeeping, not
     * a precondition: it is caught so the API still serves when it cannot run.
     * The cost of a failed sweep is a stale `running` row, which is worth a
     * line in the log and not worth refusing to start over.
     */
    async sweep(): Promise<void> {
        try {
            await this.database.ready;

            const [closed] = await this.runs.update(
                {
                    status: 'failed',
                    error: 'The API restarted while this run was going.',
                    finishedAt: new Date(),
                },
                { where: { status: 'running' } },
            );

            if (closed) {
                this.logger.warn(
                    `${closed} review ${closed === 1 ? 'run was' : 'runs were'} interrupted by a restart.`,
                );
            }
        } catch (error) {
            this.logger.warn(
                `Could not close out interrupted review runs: ${String(error)}`,
            );
        }
    }

    async list(limit = 20): Promise<AdminReviewRun[]> {
        const [rows, names] = await Promise.all([
            this.runs.findAll({ order: [['id', 'DESC']], limit }),
            this.agentNames(),
        ]);

        return rows.map(({ dataValues }) =>
            seen(dataValues, names.get(dataValues.agentId) ?? '—'),
        );
    }

    async get(id: number): Promise<AdminReviewRun | null> {
        const row = await this.runs.findByPk(id);

        if (!row) {
            return null;
        }

        const names = await this.agentNames();

        return seen(row.dataValues, names.get(row.dataValues.agentId) ?? '—');
    }

    /**
     * Starts a run and returns straight away. The loop keeps going after the
     * request that asked for it has been answered.
     */
    async start(
        agentId: number,
        requested: number,
        {
            compareWith = null,
            applied = true,
            unwritten = false,
        }: StartOptions = {},
    ): Promise<AdminReviewRun> {
        const agent = await this.agents.findByPk(agentId);

        if (!agent) {
            throw new RunRefused('There is no such agent.');
        }

        if (!agent.dataValues.enabled) {
            throw new RunRefused(
                `“${agent.dataValues.name}” is turned off. Turn it on to run a review.`,
            );
        }

        const already = await this.runs.findOne({
            where: { agentId, status: 'running' },
        });

        if (already) {
            throw new RunRefused(
                `“${agent.dataValues.name}” is already running. Wait for it, or stop it.`,
            );
        }

        if (compareWith !== null && !(await this.runs.findByPk(compareWith))) {
            throw new RunRefused(`There is no run #${compareWith}.`);
        }

        const waiting =
            compareWith === null
                ? await this.review.pending(agentId, unwritten)
                : await this.review.reAskable(compareWith);

        if (!waiting) {
            throw new RunRefused(
                compareWith === null
                    ? `“${agent.dataValues.name}” has already looked at everything in the queue.`
                    : `Run #${compareWith} recorded no verdict to re-ask.`,
            );
        }

        const row = await this.runs.create({
            agentId,
            requested,
            total: Math.min(requested, waiting),
            compareWith,
            applied,
            startedAt: new Date(),
        });

        const id = row.dataValues.id;
        const stop = new AbortController();

        this.running.set(id, stop);

        // Deliberately not awaited: the caller gets the run back now and
        // watches it. `catch` rather than `await` so a throw cannot become an
        // unhandled rejection that takes the process down.
        void this.drive(id, agent.dataValues, requested, stop, {
            compareWith,
            applied,
            unwritten,
        }).catch((error: unknown) => this.logger.error(String(error)));

        return this.get(id) as Promise<AdminReviewRun>;
    }

    /**
     * Stops a run. What it has already decided stays decided — each verdict was
     * its own transaction, and unpicking them would be a second review nobody
     * asked for.
     */
    async cancel(id: number): Promise<AdminReviewRun | null> {
        const row = await this.runs.findByPk(id);

        if (!row) {
            return null;
        }

        this.running.get(id)?.abort();

        if (row.dataValues.status === 'running') {
            await this.settle(id, 'cancelled');
        }

        return this.get(id);
    }

    private async drive(
        id: number,
        agent: IAgent,
        requested: number,
        stop: AbortController,
        { compareWith, applied, unwritten }: Required<StartOptions>,
    ): Promise<void> {
        const counts = { ...ZERO };

        try {
            await this.review.run(agent, {
                limit: requested,
                runId: id,
                compareWith,
                applied,
                unwritten,
                signal: stop.signal,
                onProgress: (outcome) => {
                    tally(counts, outcome);

                    // Not awaited: the next cluster should not wait on a
                    // progress write, and a lost one is corrected by the next.
                    void this.runs
                        .update(counts, { where: { id } })
                        .catch(() => undefined);
                },
            });

            await this.settle(
                id,
                stop.signal.aborted ? 'cancelled' : 'finished',
                counts,
            );
        } catch (error) {
            await this.settle(id, 'failed', counts, String(error));
        } finally {
            this.running.delete(id);
        }
    }

    /** The last write, which is also the one that frees the agent. */
    private async settle(
        id: number,
        status: IReviewRun['status'],
        counts?: Counts,
        error?: string,
    ): Promise<void> {
        await this.runs.update(
            {
                status,
                finishedAt: new Date(),
                ...(counts ?? {}),
                ...(error ? { error } : {}),
            },
            { where: { id } },
        );
    }

    private async agentNames(): Promise<Map<number, string>> {
        const rows = await this.agents.findAll({
            attributes: ['id', 'name'],
            where: { id: { [Op.ne]: 0 } },
            raw: true,
        });

        return new Map(
            (rows as unknown as Array<{ id: number; name: string }>).map(
                ({ id, name }) => [id, name],
            ),
        );
    }
}

const tally = (counts: Counts, outcome: ReviewOutcome | null): void => {
    if (!outcome) {
        counts.failed += 1;

        return;
    }

    counts.reviewed += 1;
    counts.abstained += outcome.abstained ? 1 : 0;
    counts.unchanged += outcome.unchanged ? 1 : 0;
    counts.published += outcome.published;
    counts.rejected += outcome.rejected;
    counts.added += outcome.added;
    counts.dropped += outcome.dropped;
};
