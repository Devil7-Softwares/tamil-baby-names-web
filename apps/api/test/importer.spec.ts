import { ImportFileInput } from '@tbn/shared';
import { Op, Sequelize } from 'sequelize';
import { describe, expect, it } from 'vitest';

import { ImporterModels, importNames } from '../src/database/importer.js';
import {
    AttestationsModel,
    ClustersModel,
    LookupModel,
    MeaningsModel,
    NamesModel,
    SourcesModel,
} from '../src/database/models.js';

const SOURCE_ID = 7;

interface Cluster {
    id: number;
    name: string;
    gender: string;
    sortKey: string;
}

interface NameRow {
    id: number;
    clusterId: number;
    sourceId: number | null;
    [column: string]: unknown;
}

interface Reading {
    id: number;
    nameId: number;
    clusterId: number;
    text: string;
    sourceId: number | null;
    status: string;
}

interface Citation {
    id: number;
    nameId?: number | null;
    meaningId?: number | null;
    sourceId: number;
    locator: string;
    excerpt: string | null;
}

const build = ({
    clusters = [] as Cluster[],
    names = [] as NameRow[],
    readings = [] as Reading[],
} = {}) => {
    const store = {
        clusters: [...clusters],
        names: [...names],
        readings: [...readings],
        citations: [] as Citation[],
    };

    let next = 100;
    const id = () => ++next;

    const models: ImporterModels = {
        sequelize: {
            // Rolls back the way the real one does, so a dry run can be seen
            // to leave nothing behind.
            transaction: async (run: (transaction: unknown) => unknown) => {
                const before = {
                    clusters: [...store.clusters],
                    names: [...store.names],
                    readings: [...store.readings],
                    citations: [...store.citations],
                };

                try {
                    return await run({});
                } catch (error) {
                    Object.assign(store, before);

                    throw error;
                }
            },
        } as unknown as Sequelize,
        clusters: {
            findOrCreate: async ({
                where,
                defaults,
            }: {
                where: { name: string; gender: string };
                defaults: Cluster;
            }) => {
                const found = store.clusters.find(
                    ({ name, gender }) =>
                        name === where.name && gender === where.gender,
                );

                if (found) {
                    return [{ dataValues: found }, false];
                }

                const made = { ...defaults, id: id() };

                store.clusters.push(made);

                return [{ dataValues: made }, true];
            },
        } as unknown as ClustersModel,
        names: {
            findOne: async ({
                where,
            }: {
                where: { clusterId: number; sourceId: number };
            }) => {
                const found = store.names.find(
                    (row) =>
                        row.clusterId === where.clusterId &&
                        row.sourceId === where.sourceId,
                );

                return found ? { dataValues: found } : null;
            },
            create: async (draft: Record<string, unknown>) => {
                const made = { ...draft, id: id() } as NameRow;

                store.names.push(made);

                return { dataValues: made };
            },
        } as unknown as NamesModel,
        meanings: {
            findAll: async ({
                where,
            }: {
                where: {
                    clusterId: number;
                    text?: { [Op.in]: string[] };
                };
            }) =>
                store.readings
                    .filter(
                        (row) =>
                            row.clusterId === where.clusterId &&
                            (!where.text ||
                                where.text[Op.in].includes(row.text)),
                    )
                    .map((dataValues) => ({ dataValues })),
            bulkCreate: async (drafts: Array<Record<string, unknown>>) => {
                for (const draft of drafts) {
                    // The cluster comes from the row, as the trigger 0011 added
                    // fills it in: nothing writes `cluster_id` by hand.
                    const row = store.names.find(
                        ({ id }) => id === draft.nameId,
                    );

                    store.readings.push({
                        ...draft,
                        id: id(),
                        clusterId: row?.clusterId,
                    } as Reading);
                }

                return [];
            },
        } as unknown as MeaningsModel,
        sources: {
            findOrCreate: async () => [{ dataValues: { id: SOURCE_ID } }, true],
            update: async () => [1],
        } as unknown as SourcesModel,
        attestations: {
            // Filtered by source and locator only. The importer keys what comes
            // back by subject, so a superset changes nothing and the `Op.or`
            // over two columns does not have to be reimplemented here.
            findAll: async ({
                where,
            }: {
                where: { sourceId: number; locator: string };
            }) =>
                store.citations
                    .filter(
                        (row) =>
                            row.sourceId === where.sourceId &&
                            row.locator === where.locator,
                    )
                    .map((dataValues) => ({ dataValues })),
            bulkCreate: async (drafts: Array<Record<string, unknown>>) => {
                for (const draft of drafts) {
                    store.citations.push({ ...draft, id: id() } as Citation);
                }

                return [];
            },
        } as unknown as AttestationsModel,
        religions: {
            findAll: async () => [
                { id: 1, slug: 'hindu', name: 'இந்து' },
                { id: 2, slug: 'muslim', name: 'முஸ்லிம்' },
            ],
        } as unknown as LookupModel,
        languages: {
            findAll: async () => [{ id: 1, slug: 'tamil', name: 'தமிழ்' }],
        } as unknown as LookupModel,
    };

    return { models, store };
};

const file = (names: unknown[]): ImportFileInput => ({
    source: { slug: 'nithra', kind: 'app' },
    names,
});

const cited = { locator: 'page 42', excerpt: 'அறிவு — knowledge' };

const record = (over: Record<string, unknown> = {}) => ({
    name: 'அறிவு',
    gender: 'boy',
    religion: 'hindu',
    language: 'tamil',
    meanings: ['அறிவு'],
    ...over,
});

describe('importing names', () => {
    it('files a name nobody has seen, as a candidate', async () => {
        const { models, store } = build();

        const report = await importNames(models, file([record()]));

        expect(report).toMatchObject({
            source: 'nithra',
            clusters: 1,
            names: 1,
            meanings: 1,
            attestations: 0,
            unchanged: 0,
            rejected: [],
        });

        expect(store.names[0]).toMatchObject({
            name: 'அறிவு',
            gender: 'boy',
            religion: 'இந்து',
            language: 'தமிழ்',
            firstLetter: 'அ',
            religionId: 1,
            languageId: 1,
            sourceId: SOURCE_ID,
            status: 'candidate',
        });
    });

    // The whole point of importing into the queue rather than into the site.
    it('publishes nothing it writes', async () => {
        const { models, store } = build();

        await importNames(
            models,
            file([record(), record({ name: 'அன்பு', meanings: ['அன்பு'] })]),
        );

        expect(
            [...store.names, ...store.readings].every(
                ({ status }) => status === 'candidate',
            ),
        ).toBe(true);
    });

    it('orders a new cluster by what the name sounds like', async () => {
        const { models, store } = build();

        await importNames(models, file([record({ name: 'கோபி' })]));

        expect(store.clusters[0]).toMatchObject({
            name: 'கோபி',
            gender: 'boy',
            sortKey: 'koopi',
        });
    });

    it('adds nothing the second time the same file is run', async () => {
        const { models, store } = build();

        await importNames(models, file([record()]));
        const again = await importNames(models, file([record()]));

        expect(again).toMatchObject({
            clusters: 0,
            names: 0,
            meanings: 0,
            unchanged: 1,
        });
        expect(store.names).toHaveLength(1);
        expect(store.readings).toHaveLength(1);
    });

    it('gives one row to a name the file itself lists twice', async () => {
        const { models, store } = build();

        const report = await importNames(
            models,
            file([record(), record({ meanings: ['அறிவாளி'] })]),
        );

        expect(report).toMatchObject({ clusters: 1, names: 1, meanings: 2 });
        expect(store.names).toHaveLength(1);
    });

    it('takes a reading a record repeats only once', async () => {
        const { models, store } = build();

        const report = await importNames(
            models,
            file([record({ meanings: ['அறிவு', 'அறிவு'] })]),
        );

        expect(report.meanings).toBe(1);
        expect(store.readings).toHaveLength(1);
    });

    it('joins a cluster the catalogue already has', async () => {
        const { models, store } = build({
            clusters: [
                { id: 9, name: 'அறிவு', gender: 'boy', sortKey: 'arivu' },
            ],
            names: [{ id: 5, clusterId: 9, sourceId: 1 }],
        });

        const report = await importNames(models, file([record()]));

        expect(report).toMatchObject({ clusters: 0, names: 1, meanings: 1 });
        expect(store.clusters).toHaveLength(1);
        expect(store.names[1]).toMatchObject({ clusterId: 9 });
    });

    // A reading is published for the cluster, so a copy of one already there is
    // nothing for a reviewer to decide.
    it('skips a reading a sibling row of the cluster already holds', async () => {
        const { models } = build({
            clusters: [
                { id: 9, name: 'அறிவு', gender: 'boy', sortKey: 'arivu' },
            ],
            names: [{ id: 5, clusterId: 9, sourceId: 1 }],
            readings: [
                {
                    id: 50,
                    nameId: 5,
                    clusterId: 9,
                    text: 'அறிவு',
                    sourceId: 1,
                    status: 'published',
                },
            ],
        });

        const report = await importNames(
            models,
            file([record({ meanings: ['அறிவு', 'ஞானம்'] })]),
        );

        expect(report).toMatchObject({ names: 1, meanings: 1 });
    });

    it('refuses a religion the catalogue does not carry, and takes the rest', async () => {
        const { models, store } = build();

        const report = await importNames(
            models,
            file([record({ religion: 'jain' }), record({ name: 'அன்பு' })]),
        );

        expect(report.names).toBe(1);
        expect(report.rejected).toEqual([
            { at: 0, name: 'அறிவு', reason: 'unknown religion "jain"' },
        ]);
        expect(store.names).toHaveLength(1);
    });

    // A source that is a list of names and nothing else. Unfiled is a question
    // for the queue; a bucket the catalogue does not carry is still a refusal.
    it('takes a record the source filed under no religion or language', async () => {
        const { models, store } = build();

        const report = await importNames(
            models,
            file([record({ religion: null, language: undefined })]),
        );

        expect(report).toMatchObject({ names: 1, rejected: [] });
        expect(store.names[0]).toMatchObject({
            name: 'அறிவு',
            religion: null,
            language: null,
            religionId: null,
            languageId: null,
            status: 'candidate',
        });
    });

    it('refuses a record the shape rejects, and names it', async () => {
        const { models } = build();

        const report = await importNames(
            models,
            file([record({ gender: 'unknown' })]),
        );

        expect(report.names).toBe(0);
        expect(report.rejected[0]).toMatchObject({ at: 0, name: 'அறிவு' });
        expect(report.rejected[0].reason).toContain('gender');
    });

    it('cites the row and every reading of a record that says where it came from', async () => {
        const { models, store } = build();

        const report = await importNames(
            models,
            file([
                record({
                    meanings: ['அறிவு', 'ஞானம்'],
                    attestation: cited,
                }),
            ]),
        );

        expect(report.attestations).toBe(3);
        expect(store.citations).toHaveLength(3);
        expect(
            store.citations.every(
                ({ locator, excerpt, sourceId }) =>
                    locator === cited.locator &&
                    excerpt === cited.excerpt &&
                    sourceId === SOURCE_ID,
            ),
        ).toBe(true);
        expect(store.citations.filter(({ nameId }) => nameId)).toHaveLength(1);
    });

    // Agreement between sources, which is the strongest thing the catalogue can
    // say about a reading — and only visible if both cite the same row.
    it('cites the reading another source already published', async () => {
        const { models, store } = build({
            clusters: [
                { id: 9, name: 'அறிவு', gender: 'boy', sortKey: 'arivu' },
            ],
            names: [{ id: 5, clusterId: 9, sourceId: 1 }],
            readings: [
                {
                    id: 50,
                    nameId: 5,
                    clusterId: 9,
                    text: 'அறிவு',
                    sourceId: 1,
                    status: 'published',
                },
            ],
        });

        const report = await importNames(
            models,
            file([record({ attestation: cited })]),
        );

        expect(report.meanings).toBe(0);
        expect(
            store.citations.map(({ meaningId }) => meaningId).filter(Boolean),
        ).toEqual([50]);
    });

    it('cites nothing for a record that does not say where it came from', async () => {
        const { models, store } = build();

        const report = await importNames(models, file([record()]));

        expect(report.attestations).toBe(0);
        expect(store.citations).toEqual([]);
    });

    it('does not cite the same thing twice when the batch is re-run', async () => {
        const { models, store } = build();
        const batch = file([record({ attestation: cited })]);

        await importNames(models, batch);
        const again = await importNames(models, batch);

        expect(again).toMatchObject({
            names: 0,
            meanings: 0,
            attestations: 0,
            unchanged: 1,
        });
        expect(store.citations).toHaveLength(2);
    });

    it('says what it would do on a dry run, and writes none of it', async () => {
        const { models, store } = build();

        const report = await importNames(models, file([record()]), {
            dryRun: true,
        });

        expect(report).toMatchObject({ clusters: 1, names: 1, meanings: 1 });
        expect(store.clusters).toEqual([]);
        expect(store.names).toEqual([]);
        expect(store.readings).toEqual([]);
    });
});
