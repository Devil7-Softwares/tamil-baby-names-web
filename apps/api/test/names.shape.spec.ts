import { IFilterData } from '@tbn/shared';
import { Sequelize } from 'sequelize';
import { describe, expect, it } from 'vitest';

import {
    MeaningsModel,
    NamesModel,
    TwinNamesModel,
} from '../src/database/models.js';
import { SortCollationService } from '../src/database/sort-collation.service.js';
import { NamesService } from '../src/names/names.service.js';

const filters: IFilterData = {
    gender: 'boy',
    startsWithMode: 'none',
    tob: '',
    tz: 'Asia/Kolkata',
    panjangam: 'thirukanitha',
    numerology: 'chaldean',
};

/** Everything the catalogue holds about a row, review columns included. */
const name = {
    id: 1,
    gender: 'boy',
    religion: 'இந்து',
    firstLetter: 'அ',
    language: 'தமிழ்',
    name: 'அறிவு',
    numerology: { chaldean: 5 },
    sourceId: 1,
    clusterId: 7,
    religionId: 1,
    languageId: 1,
    notes: 'Imported under "சிறப்பு" (special).',
    status: 'published',
};

const twin = {
    id: 2,
    gender: 'boy',
    language: 'தமிழ்',
    name1: 'அறிவு',
    name2: 'அன்பு',
    numerology1: { chaldean: 5 },
    numerology2: { chaldean: 3 },
    sourceId: 1,
    languageId: 1,
    status: 'published',
};

const build = () =>
    new NamesService(
        {} as unknown as Sequelize,
        {
            findAndCountAll: async () => ({
                rows: [{ dataValues: name }],
                count: 1,
            }),
        } as unknown as NamesModel,
        {
            findAndCountAll: async () => ({
                rows: [{ dataValues: twin }],
                count: 1,
            }),
        } as unknown as TwinNamesModel,
        {
            findAll: async () => [],
        } as unknown as MeaningsModel,
        { order: () => [] } as unknown as SortCollationService,
    );

describe('what a client is sent', () => {
    // The columns review needs kept arriving in the public rows as they were
    // added: source_id and status, then cluster_id, religion_id, language_id
    // and the reviewer's notes.
    it('carries a name and nothing the review pipeline needs', async () => {
        const [rows] = await build().getNamesForFilter(filters, 1, 1);

        expect(Object.keys(rows[0]).sort()).toEqual([
            'firstLetter',
            'gender',
            'id',
            'language',
            'meaning',
            'name',
            'nameNumber',
            'religion',
        ]);
    });

    it('carries a twin pair and nothing else either', async () => {
        const [rows] = await build().getNamesForFilter(
            { ...filters, twinNames: true },
            1,
            1,
        );

        expect(Object.keys(rows[0]).sort()).toEqual([
            'gender',
            'id',
            'language',
            'meaning1',
            'meaning2',
            'name1',
            'name2',
            'nameNumber1',
            'nameNumber2',
        ]);
    });
});
