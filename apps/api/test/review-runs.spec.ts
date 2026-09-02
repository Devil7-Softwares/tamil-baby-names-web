import { ReviewOutcome } from '@tbn/shared';
import { describe, expect, it } from 'vitest';

import { DatabaseBootstrap } from '../src/database/database.bootstrap.js';
import {
    AgentsModel,
    IAgent,
    IReviewRun,
    ReviewRunsModel,
} from '../src/database/models.js';
import { ReviewService } from '../src/review/review.service.js';
import {
    ReviewRunsService,
    RunRefused,
} from '../src/review/review-runs.service.js';

const agent = (over: Partial<IAgent> = {}): IAgent =>
    ({
        id: 3,
        slug: 'local',
        name: 'Local qwen3',
        provider: 'ollama',
        model: 'qwen3:8b',
        enabled: true,
        options: {},
        ...over,
    }) as IAgent;

const outcome = (over: Partial<ReviewOutcome> = {}): ReviewOutcome => ({
    clusterId: 1,
    name: 'அமுதன்',
    confidence: 90,
    note: 'ok',
    published: 1,
    rejected: 2,
    added: 0,
    dropped: 0,
    abstained: false,
    ...over,
});

interface Options {
    agents?: IAgent[];
    runs?: Partial<IReviewRun>[];
    pending?: number;
    /** What the review hands back, one per cluster it "looks at". */
    outcomes?: Array<ReviewOutcome | null>;
    /** Blocks the run until released, so a cancel can land mid-way. */
    gate?: Promise<void>;
}

const build = ({
    agents = [agent()],
    runs = [],
    pending = 100,
    outcomes = [outcome()],
    gate,
}: Options = {}) => {
    const store: Partial<IReviewRun>[] = runs.map((run, index) => ({
        id: index + 1,
        status: 'running',
        reviewed: 0,
        abstained: 0,
        published: 0,
        rejected: 0,
        added: 0,
        dropped: 0,
        failed: 0,
        error: null,
        startedAt: new Date(0),
        finishedAt: null,
        ...run,
    }));

    let nextId = store.length + 1;
    const updates: Array<Record<string, unknown>> = [];

    const runsModel = {
        findAll: async () => store.map((dataValues) => ({ dataValues })),
        findByPk: async (id: number) => {
            const found = store.find((run) => run.id === id);

            return found ? { dataValues: found } : null;
        },
        findOne: async ({
            where,
        }: {
            where: { agentId: number; status: string };
        }) => {
            const found = store.find(
                (run) =>
                    run.agentId === where.agentId &&
                    run.status === where.status,
            );

            return found ? { dataValues: found } : null;
        },
        create: async (draft: Partial<IReviewRun>) => {
            const row = {
                id: nextId++,
                status: 'running' as const,
                reviewed: 0,
                abstained: 0,
                published: 0,
                rejected: 0,
                added: 0,
                dropped: 0,
                failed: 0,
                error: null,
                finishedAt: null,
                ...draft,
            };

            store.push(row);

            return { dataValues: row };
        },
        update: async (
            values: Record<string, unknown>,
            { where }: { where: { id?: number; status?: string } },
        ) => {
            const touched = store.filter((run) =>
                where.id === undefined
                    ? run.status === where.status
                    : run.id === where.id,
            );

            updates.push(values);
            touched.forEach((run) => Object.assign(run, values));

            return [touched.length];
        },
    } as unknown as ReviewRunsModel;

    const agentsModel = {
        findByPk: async (id: number) => {
            const found = agents.find((row) => row.id === id);

            return found ? { dataValues: found } : null;
        },
        findAll: async () => agents.map(({ id, name }) => ({ id, name })),
    } as unknown as AgentsModel;

    const review = {
        pending: async () => pending,
        run: async (
            _agent: IAgent,
            options: {
                signal?: AbortSignal;
                onProgress?: (outcome: ReviewOutcome | null) => void;
            },
        ) => {
            for (const each of outcomes) {
                await gate;

                if (options.signal?.aborted) {
                    break;
                }

                options.onProgress?.(each);
            }

            return null;
        },
    } as unknown as ReviewService;

    const service = new ReviewRunsService(runsModel, agentsModel, review, {
        ready: Promise.resolve(),
    } as unknown as DatabaseBootstrap);

    return { service, store, updates };
};

/** Lets the run's own promises settle before the assertions read the store. */
const settle = async (): Promise<void> => {
    for (let turn = 0; turn < 20; turn += 1) {
        await Promise.resolve();
    }
};

describe('starting a run', () => {
    it('records what it queued and counts up as it goes', async () => {
        let release = () => undefined as void;
        const gate = new Promise<void>((resolve) => {
            release = () => resolve();
        });

        const { service, store } = build({
            outcomes: [outcome(), outcome({ abstained: true, published: 0 })],
            gate,
        });

        const run = await service.start(3, 25);

        expect(run).toMatchObject({ status: 'running', total: 25 });

        release();
        await settle();

        expect(store[0]).toMatchObject({
            status: 'finished',
            reviewed: 2,
            abstained: 1,
            published: 1,
            rejected: 4,
        });
    });

    // A batch bigger than the queue would otherwise show a progress bar that
    // stops part way and never finishes.
    it('queues no more than the queue holds', async () => {
        const { service } = build({ pending: 4 });

        expect((await service.start(3, 500)).total).toBe(4);
    });

    it('counts a cluster the model could not be read on', async () => {
        const { service, store } = build({ outcomes: [null, outcome()] });

        await service.start(3, 25);
        await settle();

        expect(store[0]).toMatchObject({ reviewed: 1, failed: 1 });
    });
});

describe('a run that should not start', () => {
    it('refuses a second run of the same agent', async () => {
        const { service } = build({
            runs: [{ agentId: 3, status: 'running' }],
        });

        await expect(service.start(3, 25)).rejects.toThrow(RunRefused);
        await expect(service.start(3, 25)).rejects.toThrow(/already running/);
    });

    it('refuses an agent that is turned off', async () => {
        const { service } = build({ agents: [agent({ enabled: false })] });

        await expect(service.start(3, 25)).rejects.toThrow(/turned off/);
    });

    it('refuses when the agent has seen everything', async () => {
        const { service } = build({ pending: 0 });

        await expect(service.start(3, 25)).rejects.toThrow(
            /already looked at everything/,
        );
    });

    it('refuses an agent that is not there', async () => {
        const { service } = build();

        await expect(service.start(99, 25)).rejects.toThrow(/no such agent/);
    });
});

describe('stopping a run', () => {
    it('stops it and keeps what it had already decided', async () => {
        let release = () => undefined as void;
        const gate = new Promise<void>((resolve) => {
            release = () => resolve();
        });

        const { service, store } = build({
            outcomes: [outcome(), outcome(), outcome()],
            gate,
        });

        await service.start(3, 25);

        const stopped = await service.cancel(1);

        expect(stopped).toMatchObject({ status: 'cancelled' });

        release();
        await settle();

        // Cancelled stays cancelled: the loop finding its signal aborted must
        // not overwrite the ending with "finished".
        expect(store[0].status).toBe('cancelled');
    });

    it('says nothing about a run that does not exist', async () => {
        const { service } = build();

        expect(await service.cancel(99)).toBeNull();
    });
});

describe('a run the API never finished', () => {
    // The sweep waits on the migrations, which finish during
    // `onApplicationBootstrap` — so the hook must start it, never await it, or
    // the boot waits on something it is itself blocking.
    it('is started by the boot hook without blocking it', () => {
        const { service } = build({
            runs: [{ agentId: 3, status: 'running' }],
        });

        expect(service.onApplicationBootstrap()).toBeUndefined();
    });

    // Nothing else can tell "still going" from "the process that was going is
    // gone", and a row stuck on running blocks its agent for good.
    it('is closed out by the sweep on the next boot', async () => {
        const { service, store } = build({
            runs: [
                { agentId: 3, status: 'running' },
                { agentId: 4, status: 'finished' },
            ],
        });

        await service.sweep();

        expect(store[0]).toMatchObject({
            status: 'failed',
            error: 'The API restarted while this run was going.',
        });
        expect(store[1].status).toBe('finished');
    });
});
