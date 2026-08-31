import { Op, Sequelize } from 'sequelize';
import { describe, expect, it } from 'vitest';

import {
    MeaningsModel,
    NamesModel,
    SourcesModel,
} from '../src/database/models.js';
import {
    FIXTURE_SOURCE,
    FixtureModels,
    seedReviewFixture,
    undoReviewFixture,
} from '../src/database/review-fixture.js';

const FIXTURE_ID = 2;

interface Reading {
    id: number;
    nameId: number;
    text: string;
    sourceId: number | null;
    status: 'published' | 'candidate' | 'rejected';
}

/** The service reads by id and by `Op.in`, so the stub has to honour both. */
const matches = (value: unknown, criterion: unknown): boolean => {
    if (criterion === undefined) {
        return true;
    }

    if (criterion && typeof criterion === 'object' && Op.in in criterion) {
        return (criterion as Record<symbol, unknown[]>)[Op.in].includes(value);
    }

    return value === criterion;
};

const build = ({
    rows = [] as Array<{ id: number; clusterId: number }>,
    readings = [] as Reading[],
    source = null as { id: number } | null,
}) => {
    const created: Array<Partial<Reading>> = [];
    const destroyed: Array<Record<string, unknown>> = [];
    const updated: Array<{ values: unknown; where: unknown }> = [];
    let store = [...readings];

    const models: FixtureModels = {
        sequelize: {
            query: async () =>
                [...new Set(rows.map(({ clusterId }) => clusterId))].map(
                    (cluster_id) => ({ cluster_id }),
                ),
        } as unknown as Sequelize,
        names: {
            findAll: async () => rows.map((dataValues) => ({ dataValues })),
        } as unknown as NamesModel,
        meanings: {
            findAll: async (options?: {
                where?: { nameId?: unknown; sourceId?: unknown };
            }) => {
                const where = options?.where ?? {};

                return store
                    .filter(
                        (row) =>
                            matches(row.nameId, where.nameId) &&
                            matches(row.sourceId, where.sourceId),
                    )
                    .map((dataValues) => ({ dataValues }));
            },
            bulkCreate: async (drafts: Array<Partial<Reading>>) => {
                created.push(...drafts);

                return [];
            },
            destroy: async (options: { where: Record<string, unknown> }) => {
                destroyed.push(options.where);
                store = store.filter(
                    (row) => row.sourceId !== options.where.sourceId,
                );

                return 0;
            },
            update: async (
                values: unknown,
                options: { where: Record<string, unknown> },
            ) => {
                updated.push({ values, where: options.where });

                return [1];
            },
        } as unknown as MeaningsModel,
        sources: {
            findOrCreate: async () => [{ dataValues: { id: FIXTURE_ID } }],
            findOne: async () => (source ? { dataValues: source } : null),
            destroy: async () => 0,
        } as unknown as SourcesModel,
    };

    return { models, created, destroyed, updated };
};

const reading = (
    id: number,
    nameId: number,
    text: string,
    sourceId: number | null = 1,
    status: Reading['status'] = 'published',
): Reading => ({ id, nameId, text, sourceId, status });

describe('the review fixture', () => {
    it('gives each row the reading its sibling disagrees with', async () => {
        const { models, created } = build({
            rows: [
                { id: 1, clusterId: 9 },
                { id: 2, clusterId: 9 },
            ],
            readings: [
                reading(10, 1, 'அழிப்பவர்'),
                reading(11, 2, 'மருத்துவர்'),
            ],
        });

        const report = await seedReviewFixture(models);

        expect(report).toEqual({ clusters: 1, readings: 2 });
        expect(created).toEqual([
            {
                nameId: 1,
                text: 'மருத்துவர்',
                sourceId: FIXTURE_ID,
                status: 'candidate',
            },
            {
                nameId: 2,
                text: 'அழிப்பவர்',
                sourceId: FIXTURE_ID,
                status: 'candidate',
            },
        ]);
    });

    // Two rows saying the same thing is a free merge, not a decision.
    it('writes nothing for a cluster whose rows agree', async () => {
        const { models, created } = build({
            rows: [
                { id: 1, clusterId: 9 },
                { id: 2, clusterId: 9 },
            ],
            readings: [reading(10, 1, 'ஒன்றே'), reading(11, 2, 'ஒன்றே')],
        });

        expect(await seedReviewFixture(models)).toEqual({
            clusters: 1,
            readings: 0,
        });
        expect(created).toEqual([]);
    });

    it('adds nothing the second time it is run', async () => {
        const { models, created } = build({
            rows: [
                { id: 1, clusterId: 9 },
                { id: 2, clusterId: 9 },
            ],
            readings: [
                reading(10, 1, 'அழிப்பவர்'),
                reading(11, 2, 'மருத்துவர்'),
                reading(12, 1, 'மருத்துவர்', FIXTURE_ID, 'candidate'),
                reading(13, 2, 'அழிப்பவர்', FIXTURE_ID, 'candidate'),
            ],
        });

        expect(await seedReviewFixture(models)).toEqual({
            clusters: 1,
            readings: 0,
        });
        expect(created).toEqual([]);
    });

    it('invents no text, taking every reading from the catalogue', async () => {
        const { models, created } = build({
            rows: [
                { id: 1, clusterId: 9 },
                { id: 2, clusterId: 9 },
            ],
            readings: [
                reading(10, 1, 'அழிப்பவர்'),
                reading(11, 2, 'மருத்துவர்'),
            ],
        });

        await seedReviewFixture(models);

        const known = new Set(['அழிப்பவர்', 'மருத்துவர்']);

        expect(created.every(({ text }) => known.has(text!))).toBe(true);
    });
});

describe('undoing the review fixture', () => {
    it('removes only what the fixture wrote', async () => {
        const { models, destroyed } = build({
            source: { id: FIXTURE_ID },
            readings: [
                reading(10, 1, 'அழிப்பவர்'),
                reading(12, 1, 'மருத்துவர்', FIXTURE_ID, 'candidate'),
            ],
        });

        const removal = await undoReviewFixture(models);

        expect(destroyed).toEqual([{ sourceId: FIXTURE_ID }]);
        expect(removal.readings).toBe(1);
    });

    // The reviewer published a fixture reading, which demoted the import's own.
    it('gives back the reading a fixture one displaced', async () => {
        const { models, updated } = build({
            source: { id: FIXTURE_ID },
            readings: [
                reading(10, 1, 'அழிப்பவர்', 1, 'candidate'),
                reading(12, 1, 'மருத்துவர்', FIXTURE_ID, 'published'),
            ],
        });

        const removal = await undoReviewFixture(models);

        expect(removal.republished).toBe(1);
        expect(updated).toEqual([
            { values: { status: 'published' }, where: { id: 10 } },
        ]);
    });

    it('leaves a row alone when its own reading still stands', async () => {
        const { models, updated } = build({
            source: { id: FIXTURE_ID },
            readings: [
                reading(10, 1, 'அழிப்பவர்'),
                reading(12, 1, 'மருத்துவர்', FIXTURE_ID, 'candidate'),
            ],
        });

        expect((await undoReviewFixture(models)).republished).toBe(0);
        expect(updated).toEqual([]);
    });

    it('does nothing when the fixture was never seeded', async () => {
        const { models, destroyed } = build({ source: null });

        expect(await undoReviewFixture(models)).toEqual({
            readings: 0,
            republished: 0,
        });
        expect(destroyed).toEqual([]);
    });

    it('names the source it marks its readings with', () => {
        expect(FIXTURE_SOURCE).toBe('dev-fixture');
    });
});
