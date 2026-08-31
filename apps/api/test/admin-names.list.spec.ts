import { Sequelize } from 'sequelize';
import { describe, expect, it } from 'vitest';

import { AdminNamesService } from '../src/admin/names/admin-names.service.js';
import { LookupsService } from '../src/database/lookups.service.js';
import {
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

const lookup = (rows: Array<{ id: number; name: string }>) =>
    ({ findAll: async () => rows }) as unknown as LookupModel;

const build = (members: ReturnType<typeof member>[]) => {
    const service = new AdminNamesService(
        {} as unknown as Sequelize,
        {
            findAll: async () => members.map((row) => ({ dataValues: row })),
        } as unknown as NamesModel,
        { findAll: async () => [] } as unknown as MeaningsModel,
        {
            findAndCountAll: async () => ({
                rows: [{ dataValues: cluster }],
                count: 1,
            }),
        } as unknown as ClustersModel,
        { findAll: async () => [] } as unknown as SourcesModel,
        {} as unknown as VerificationsModel,
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
