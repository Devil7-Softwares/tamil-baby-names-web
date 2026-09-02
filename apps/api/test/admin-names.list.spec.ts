import { Sequelize } from 'sequelize';
import { describe, expect, it } from 'vitest';

import { AdminNamesService } from '../src/admin/names/admin-names.service.js';
import { LookupsService } from '../src/database/lookups.service.js';
import {
    AttestationsModel,
    ClustersModel,
    LookupModel,
    MeaningsModel,
    NamesModel,
    SourcesModel,
    VerificationsModel,
} from '../src/database/models.js';
import { SortCollationService } from '../src/database/sort-collation.service.js';

const cluster = {
    id: 1,
    name: 'அகாத்',
    gender: 'boy',
    sortKey: 'அகாத்',
    createdAt: new Date(0),
    updatedAt: new Date(0),
};

/** Hindu rows carry a language; the import gave the rest a religion instead. */
const member = (
    id: number,
    religionId: number,
    languageId: number | null,
    notes: string | null = null,
) => ({
    id,
    clusterId: 1,
    gender: 'boy',
    religion: 'இந்து',
    language: 'தமிழ்',
    firstLetter: 'அ',
    name: 'அகாத்',
    numerology: null,
    sourceId: null,
    religionId,
    languageId,
    notes,
    status: 'published' as const,
});

const reading = (id: number, nameId: number, text: string) => ({
    id,
    nameId,
    text,
    status: 'candidate' as const,
    sourceId: null,
});

/** A row of `attestations`, as the queue reads it back. */
const citation = (
    id: number,
    subject: { nameId: number } | { meaningId: number },
    sourceId: number,
    locator: string,
    excerpt: string | null = null,
) => ({
    id,
    nameId: null,
    meaningId: null,
    ...subject,
    sourceId,
    locator,
    excerpt,
});

const lookup = (rows: Array<{ id: number; name: string }>) =>
    ({ findAll: async () => rows }) as unknown as LookupModel;

const rows = <T>(values: T[]) => ({
    findAll: async () => values.map((value) => ({ dataValues: value })),
});

/** A row of `verifications` written by an agent, as `verdictsFor` reads it. */
const verdict = (
    clusterId: number,
    over: Partial<{
        agent: string | null;
        confidence: number | null;
        note: string | null;
        reason: string;
    }> = {},
) => ({
    cluster_id: clusterId,
    agent: 'Local qwen3',
    confidence: 85,
    note: 'From அமுதம், nectar.',
    reason: 'decision',
    created_at: new Date('2026-09-02T08:00:00Z'),
    ...over,
});

const build = (
    members: ReturnType<typeof member>[],
    catalogue: {
        meanings?: ReturnType<typeof reading>[];
        citations?: ReturnType<typeof citation>[];
        verdicts?: ReturnType<typeof verdict>[];
    } = {},
) => {
    const service = new AdminNamesService(
        {
            query: async () => catalogue.verdicts ?? [],
        } as unknown as Sequelize,
        rows(members) as unknown as NamesModel,
        rows(catalogue.meanings ?? []) as unknown as MeaningsModel,
        {
            findAndCountAll: async () => ({
                rows: [{ dataValues: cluster }],
                count: 1,
            }),
        } as unknown as ClustersModel,
        {
            findAll: async () => [
                { id: 1, slug: 'nithra' },
                { id: 2, slug: 'peyar' },
            ],
        } as unknown as SourcesModel,
        {} as unknown as VerificationsModel,
        rows(catalogue.citations ?? []) as unknown as AttestationsModel,
        new LookupsService(
            lookup([{ id: 1, name: 'இந்து' }]),
            lookup([{ id: 4, name: 'தமிழ்' }]),
        ),
        { order: () => [] } as unknown as SortCollationService,
    );

    return service;
};

describe('AdminNamesService.list', () => {
    it('names a row’s religion and language from the lookups', async () => {
        const page = await build([member(10, 1, 4)]).list({
            page: 1,
            limit: 25,
        });

        expect(page.items[0].members[0]).toMatchObject({
            id: 10,
            religion: 'இந்து',
            language: 'தமிழ்',
        });
    });

    // 5,148 rows hold a religion in the language column and 133 hold neither,
    // so the queue has to say nothing rather than guess.
    it('says nothing where the import recorded no language', async () => {
        const page = await build([member(10, 1, null)]).list({
            page: 1,
            limit: 25,
        });

        expect(page.items[0].members[0].language).toBeNull();
    });

    it('says nothing for a lookup id that no longer resolves', async () => {
        const page = await build([member(10, 99, 4)]).list({
            page: 1,
            limit: 25,
        });

        expect(page.items[0].members[0].religion).toBeNull();
    });
});

describe('the notes a row carries', () => {
    it('hands the reviewer what no column could hold', async () => {
        const page = await build([
            member(10, 1, 4, 'Imported under "சிறப்பு" (special).'),
        ]).list({ page: 1, limit: 25 });

        expect(page.items[0].members[0].notes).toBe(
            'Imported under "சிறப்பு" (special).',
        );
    });
});

describe('the evidence behind a reading', () => {
    it('hands the reviewer where a source said it', async () => {
        const page = await build([member(10, 1, 4)], {
            meanings: [reading(50, 10, 'அறிவு')],
            citations: [
                citation(1, { meaningId: 50 }, 1, 'p. 17', 'அறிவு, ஞானம்'),
            ],
        }).list({ page: 1, limit: 25 });

        expect(page.items[0].meanings[0].citations).toEqual([
            {
                id: 1,
                source: 'nithra',
                locator: 'p. 17',
                excerpt: 'அறிவு, ஞானம்',
            },
        ]);
    });

    // Two sources landing on one reading is agreement, and a reviewer deciding
    // between readings is exactly who that is worth showing.
    it('keeps both sources where they agree', async () => {
        const page = await build([member(10, 1, 4)], {
            meanings: [reading(50, 10, 'அறிவு')],
            citations: [
                citation(1, { meaningId: 50 }, 1, 'p. 17'),
                citation(2, { meaningId: 50 }, 2, '#4021'),
            ],
        }).list({ page: 1, limit: 25 });

        expect(
            page.items[0].meanings[0].citations.map(({ source }) => source),
        ).toEqual(['nithra', 'peyar']);
    });

    it('cites the spelling on the row, not on its readings', async () => {
        const page = await build([member(10, 1, 4)], {
            meanings: [reading(50, 10, 'அறிவு')],
            citations: [citation(1, { nameId: 10 }, 1, 'p. 17')],
        }).list({ page: 1, limit: 25 });

        expect(page.items[0].members[0].citations).toHaveLength(1);
        expect(page.items[0].meanings[0].citations).toEqual([]);
    });

    it('says nothing for a reading nothing cites', async () => {
        const page = await build([member(10, 1, 4)], {
            meanings: [reading(50, 10, 'அறிவு')],
        }).list({ page: 1, limit: 25 });

        expect(page.items[0].meanings[0].citations).toEqual([]);
        expect(page.items[0].members[0].citations).toEqual([]);
    });
});

describe('what an agent made of a cluster', () => {
    it('hands the reviewer the model’s own claim, not a fact', async () => {
        const page = await build([member(10, 1, 4)], {
            verdicts: [verdict(1)],
        }).list({ page: 1, limit: 25 });

        expect(page.items[0].verdict).toEqual({
            agent: 'Local qwen3',
            confidence: 85,
            note: 'From அமுதம், nectar.',
            abstained: false,
            at: '2026-09-02T08:00:00.000Z',
        });
    });

    it('marks the ones it would not decide on', async () => {
        const page = await build([member(10, 1, 4)], {
            verdicts: [verdict(1, { reason: 'abstained', confidence: 20 })],
        }).list({ page: 1, limit: 25 });

        expect(page.items[0].verdict).toMatchObject({
            abstained: true,
            confidence: 20,
        });
    });

    // The ledger nulls the reference when an agent is removed rather than
    // losing the verdict, so the queue has to say something for it.
    it('still says a verdict happened when the agent is gone', async () => {
        const page = await build([member(10, 1, 4)], {
            verdicts: [verdict(1, { agent: null })],
        }).list({ page: 1, limit: 25 });

        expect(page.items[0].verdict?.agent).toBe('an agent since removed');
    });

    it('says nothing for a cluster no agent has looked at', async () => {
        const page = await build([member(10, 1, 4)]).list({
            page: 1,
            limit: 25,
        });

        expect(page.items[0].verdict).toBeNull();
    });
});
