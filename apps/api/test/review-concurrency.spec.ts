import { describe, expect, it } from 'vitest';

import { ReviewService } from '../src/review/review.service.js';

/**
 * The run loop only — a fake `one()` stands in for the model, so what is being
 * measured is how many clusters are in flight and nothing about any provider.
 */
const drive = async (
    clusters: number,
    concurrency: number,
    delay = (at: number) => (at % 5 === 0 ? 20 : 1),
) => {
    let open = 0;
    let peak = 0;
    const order: number[] = [];

    const service = Object.create(ReviewService.prototype) as ReviewService;

    Object.assign(service, {
        agents: { configOf: () => ({}), concurrencyOf: () => concurrency },
        candidates: async () =>
            Array.from({ length: clusters }, (_, at) => ({ clusterId: at })),
        one: async (
            _agent: unknown,
            _config: unknown,
            candidate: { clusterId: number },
        ) => {
            open += 1;
            peak = Math.max(peak, open);
            await new Promise((r) => setTimeout(r, delay(candidate.clusterId)));
            open -= 1;
            order.push(candidate.clusterId);

            return {
                clusterId: candidate.clusterId,
                name: 'x',
                confidence: 90,
                note: '',
                published: 0,
                rejected: 0,
                added: 0,
                dropped: 0,
                abstained: false,
                unchanged: false,
            };
        },
    });

    const report = await service.run({ id: 1, slug: 'a' } as never, {
        limit: clusters,
    });

    return { report, peak, order };
};

describe('running clusters in batches', () => {
    const sizes = async (clusters: number, batch: number) => {
        const seen: number[] = [];
        const service = Object.create(ReviewService.prototype) as ReviewService;

        Object.assign(service, {
            agents: { configOf: () => ({}), concurrencyOf: () => 1 },
            candidates: async () =>
                Array.from({ length: clusters }, (_, at) => ({
                    clusterId: at,
                })),
            one: async () => {
                seen.push(1);

                return null;
            },
            many: async (
                _a: unknown,
                _c: unknown,
                group: { clusterId: number }[],
            ) => {
                seen.push(group.length);

                return group.map(() => null);
            },
        });

        await service.run({ id: 1, slug: 'a' } as never, {
            limit: clusters,
            batch,
        });

        return seen;
    };

    it('splits the queue into requests of the size asked for', async () => {
        expect(await sizes(25, 10)).toEqual([10, 10, 5]);
    });

    // A batch of one has to stay the old path exactly: every calibration figure
    // behind the model comparison was measured one cluster per request.
    it('asks one at a time when the batch is one', async () => {
        expect(await sizes(4, 1)).toEqual([1, 1, 1, 1]);
    });

    it('treats no batch at all as one at a time', async () => {
        const seen: number[] = [];
        const service = Object.create(ReviewService.prototype) as ReviewService;

        Object.assign(service, {
            agents: { configOf: () => ({}), concurrencyOf: () => 1 },
            candidates: async () => [{ clusterId: 1 }, { clusterId: 2 }],
            one: async () => {
                seen.push(1);

                return null;
            },
            many: async () => {
                throw new Error('should not batch');
            },
        });

        await service.run({ id: 1, slug: 'a' } as never, { limit: 2 });

        expect(seen).toEqual([1, 1]);
    });
});

describe('running clusters concurrently', () => {
    it('keeps the configured number in flight and no more', async () => {
        const { report, peak } = await drive(30, 4);

        expect(peak).toBe(4);
        expect(report.reviewed).toBe(30);
    });

    // The old loop. Still what Ollama gets, because one set of weights answering
    // four questions at once only makes each of them slower.
    it('runs one at a time when that is what the agent says', async () => {
        const { peak, order } = await drive(10, 1);

        expect(peak).toBe(1);
        expect(order).toEqual([...order].sort((a, b) => a - b));
    });

    // Workers pull from one queue rather than taking fixed slices: a cluster
    // the model reasons over for twenty seconds must not idle three workers.
    it('does not let one slow cluster hold up the others', async () => {
        const { order } = await drive(12, 4);

        // 0 is the slow one and finishes after quicker clusters queued behind it.
        expect(order.indexOf(0)).toBeGreaterThan(0);
    });

    it('never opens more than there are clusters', async () => {
        const { peak, report } = await drive(3, 8);

        expect(peak).toBe(3);
        expect(report.reviewed).toBe(3);
    });

    it('stops pulling once the run is cancelled', async () => {
        const stop = new AbortController();
        const service = Object.create(ReviewService.prototype) as ReviewService;
        let seen = 0;

        Object.assign(service, {
            agents: { configOf: () => ({}), concurrencyOf: () => 2 },
            candidates: async () =>
                Array.from({ length: 50 }, (_, at) => ({ clusterId: at })),
            one: async () => {
                seen += 1;

                if (seen === 6) {
                    stop.abort();
                }

                return null;
            },
        });

        const report = await service.run({ id: 1, slug: 'a' } as never, {
            limit: 50,
            signal: stop.signal,
        });

        expect(report.failed).toBeLessThan(50);
        expect(seen).toBeLessThan(50);
    });
});
