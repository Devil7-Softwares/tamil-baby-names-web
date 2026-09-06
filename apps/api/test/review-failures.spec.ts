import { describe, expect, it } from 'vitest';

import { AgentCallError } from '../src/agents/providers/index.js';
import { ReviewService } from '../src/review/review.service.js';

const candidate = (clusterId: number) => ({
    clusterId,
    name: 'அமுதன்',
    gender: 'boy',
    religion: null,
    language: null,
    rows: [{ id: clusterId, status: 'candidate' }],
    readings: [],
    sources: new Map(),
});

/**
 * The real `one()` and `many()`, with only the provider and the tables faked —
 * what is being checked is that a failure is written down, and by which paths.
 */
const drive = async (
    clusters: number,
    answer: () => never | Promise<{ text: string }>,
    options: { runId?: number | null; batch?: number } = {},
) => {
    const recorded: Array<{ runId: number; clusterId: number; error: string }> =
        [];

    const service = Object.create(ReviewService.prototype) as ReviewService;

    Object.assign(service, {
        logger: { warn: () => undefined },
        agents: {
            configOf: () => ({}),
            concurrencyOf: () => 1,
            ask: answer,
        },
        failures: {
            bulkCreate: async (rows: typeof recorded) => {
                recorded.push(...rows);

                return [];
            },
        },
        candidates: async () =>
            Array.from({ length: clusters }, (_, at) => candidate(at + 1)),
    });

    const report = await service.run({ id: 1, slug: 'a' } as never, {
        limit: clusters,
        runId: 5,
        ...options,
    });

    return { report, recorded };
};

const refuses = (): never => {
    throw new AgentCallError('You have reached your API usage limits.', 400);
};

describe('a cluster the run could not ask about', () => {
    // Run 43 met a usage limit part way through and finished reporting 1,050
    // failures it could not name.
    it('is written down with what the provider said', async () => {
        const { report, recorded } = await drive(3, refuses);

        expect(report.failed).toBe(3);
        expect(report.reviewed).toBe(0);
        expect(recorded).toEqual([
            {
                runId: 5,
                clusterId: 1,
                error: 'You have reached your API usage limits.',
            },
            {
                runId: 5,
                clusterId: 2,
                error: 'You have reached your API usage limits.',
            },
            {
                runId: 5,
                clusterId: 3,
                error: 'You have reached your API usage limits.',
            },
        ]);
    });

    // A rate limit and a model that cannot be parsed both land here, and only
    // one of them is worth waiting out.
    it('says so when the answer could not be read', async () => {
        const { recorded } = await drive(1, async () => ({
            text: 'I am not sure.',
        }));

        expect(recorded).toHaveLength(1);
        expect(recorded[0].error).toContain('did not answer with JSON');
    });

    // Asking ten together means one refusal costs all ten, and every one of
    // them has to come round again.
    it('covers every cluster of a batch that failed together', async () => {
        const { recorded } = await drive(10, refuses, { batch: 10 });

        expect(recorded.map(({ clusterId }) => clusterId)).toEqual([
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
        ]);
    });

    // The command line reviews without a run row to hang anything off.
    it('is left unrecorded when there is no run to record it against', async () => {
        const { report, recorded } = await drive(2, refuses, { runId: null });

        expect(report.failed).toBe(2);
        expect(recorded).toEqual([]);
    });

    // A run that stopped because it could not write down that it had failed
    // would be a worse failure than the one it was recording.
    it('does not end the run when it cannot be recorded', async () => {
        const service = Object.create(ReviewService.prototype) as ReviewService;

        Object.assign(service, {
            logger: { warn: () => undefined },
            agents: {
                configOf: () => ({}),
                concurrencyOf: () => 1,
                ask: refuses,
            },
            failures: {
                bulkCreate: async () => {
                    throw new Error('the table is gone');
                },
            },
            candidates: async () => [candidate(1)],
        });

        const report = await service.run({ id: 1, slug: 'a' } as never, {
            limit: 1,
            runId: 5,
        });

        expect(report.failed).toBe(1);
    });
});
