import { IFilterData } from '@tbn/shared';
import { Op, Sequelize } from 'sequelize';
import { describe, expect, it } from 'vitest';

import {
    IMeaning,
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

/** Two catalogue rows of one spelling, which is what the import filed. */
const rows = [
    { id: 1, name: 'அபி', clusterId: 7, numerology: null },
    { id: 2, name: 'அபி', clusterId: 7, numerology: null },
];

const reading = {
    id: 40,
    nameId: 1,
    twinNameId: null,
    clusterId: 7,
    slot: 1,
    text: 'தந்தையின் அன்புக்குரியவள்',
    status: 'published',
} as unknown as IMeaning;

const build = () => {
    const queried: Array<Record<string, unknown>> = [];

    const service = new NamesService(
        {} as unknown as Sequelize,
        {
            findAndCountAll: async () => ({
                rows: rows.map((dataValues) => ({ dataValues })),
                count: rows.length,
            }),
        } as unknown as NamesModel,
        {} as unknown as TwinNamesModel,
        {
            findAll: async (options: { where: Record<string, unknown> }) => {
                queried.push(options.where);

                return [{ dataValues: reading }];
            },
        } as unknown as MeaningsModel,
        { order: () => [] } as unknown as SortCollationService,
    );

    return { service, queried };
};

describe('the reading a name is shown with', () => {
    // The reading is published once per spelling, so looking it up by row left
    // the 725 clusters the import filed twice showing a blank second row.
    it('reads by cluster, so both rows of one spelling carry it', async () => {
        const { service } = build();

        const [names] = await service.getNamesForFilter(filters, 1, 10);

        expect(
            names.map((row) => (row as { meaning: string }).meaning),
        ).toEqual([reading.text, reading.text]);
    });

    it('asks for the clusters on the page, not the rows', async () => {
        const { service, queried } = build();

        await service.getNamesForFilter(filters, 1, 10);

        expect(queried).toEqual([
            { clusterId: { [Op.in]: [7, 7] }, status: 'published' },
        ]);
    });
});
