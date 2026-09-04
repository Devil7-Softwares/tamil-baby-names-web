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
    unchanged: false,
    ...over,
});

interface Options {
    agents?: IAgent[];
    runs?: Partial<IReviewRun>[];
    pending?: number;
    /** How many clusters an earlier run is reported to have looked at. */
    reAskable?: number;
    /** What the review hands back, one per cluster it "looks at". */
    outcomes?: Array<ReviewOutcome | null>;
    /** Blocks the run until released, so a cancel can land mid-way. */
    gate?: Promise<void>;
}

const build = ({
    agents = [agent()],
    runs = [],
    pending = 100,
    reAskable = 10,
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

    const asked: Array<Record<string, unknown>> = [];

    const asked_: unknown[] = [];
    const review = {
        pending: async (_id: number, unwritten?: boolean) => {
            asked_.push(unwritten);

            return pending;
        },
        reAskable: async () => reAskable,
        run: async (
            _agent: IAgent,
            options: {
                signal?: AbortSignal;
                onProgress?: (outcome: ReviewOutcome | null) => void;
            },
        ) => {
            asked.push(options as Record<string, unknown>);
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

    return { service, store, updates, asked };
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

describe('asking two agents the same question', () => {
    it('queues the clusters of the run it was pointed at', async () => {
        const { service, store, asked } = build({
            runs: [{ agentId: 3, status: 'finished' }],
            reAskable: 6,
        });

        const run = await service.start(3, 25, {
            compareWith: 1,
            applied: false,
        });
        await settle();

        expect(run.compareWith).toBe(1);
        expect(run.applied).toBe(false);
        // Six, not the hundred waiting: the batch is over that run's clusters.
        expect(run.total).toBe(6);
        expect(asked[0]).toMatchObject({
            compareWith: 1,
            applied: false,
            runId: store[1].id,
        });
    });

    // Re-asking is the point, so the "already answered" rule is the one thing
    // that must not stand in its way.
    it('lets an agent that has seen everything re-ask', async () => {
        const { service } = build({
            runs: [{ agentId: 3, status: 'finished' }],
            pending: 0,
        });

        await expect(
            service.start(3, 25, { compareWith: 1 }),
        ).resolves.toMatchObject({ compareWith: 1 });
    });

    it('refuses a run it cannot find', async () => {
        const { service } = build();

        await expect(service.start(3, 25, { compareWith: 9 })).rejects.toThrow(
            /no run #9/,
        );
    });

    it('refuses a run that recorded nothing to re-ask', async () => {
        const { service } = build({
            runs: [{ agentId: 3, status: 'failed' }],
            reAskable: 0,
        });

        await expect(service.start(3, 25, { compareWith: 1 })).rejects.toThrow(
            /no verdict to re-ask/,
        );
    });

    // The queue is ordered by cluster id and the names with no reading arrived
    // last, so a run would not reach them without asking.
    it('can ask for only the names nobody has written a reading for', async () => {
        const { service, asked } = build();

        await service.start(3, 25, { unwritten: true });
        await settle();

        expect(asked[0]).toMatchObject({ unwritten: true });
    });

    it('still applies by default', async () => {
        const { service, asked } = build();

        await service.start(3, 25);
        await settle();

        expect(asked[0]).toMatchObject({
            applied: true,
            compareWith: null,
            unwritten: false,
        });
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
