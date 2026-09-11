import { IFilterData } from '@tbn/shared';
import { Op, Sequelize } from 'sequelize';
import { describe, expect, it } from 'vitest';

import {
    IMeaning,
    MeaningsModel,
    NamesModel,
    TwinNamesModel,
} from '../src/database/models.js';
import { SiteSettingsService } from '../src/database/site-settings.service.js';
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

/**
 * The one row the database gives back for a spelling the import filed twice,
 * once under each religion.
 */
const grouped = {
    id: 1,
    name: 'அபி',
    gender: 'boy',
    clusterId: 7,
    numerology: null,
    firstLetter: 'அ',
    religion: 'இந்து, முஸ்லிம்',
    language: 'தமிழ்',
};

const reading = {
    id: 40,
    nameId: 1,
    twinNameId: null,
    clusterId: 7,
    slot: 1,
    text: 'தந்தையின் அன்புக்குரியவள்',
    status: 'published',
} as unknown as IMeaning;

interface Captured {
    list?: { group?: string[] };
    count?: { distinct?: boolean; col?: string };
    meanings: Array<Record<string, unknown>>;
}

const build = (showUnreviewed = false) => {
    const captured: Captured = { meanings: [] };

    const service = new NamesService(
        {} as unknown as Sequelize,
        {
            findAll: async (options: Captured['list']) => {
                captured.list = options;

                return [grouped];
            },
            count: async (options: Captured['count']) => {
                captured.count = options;

                return 1;
            },
        } as unknown as NamesModel,
        {} as unknown as TwinNamesModel,
        {
            findAll: async (options: { where: Record<string, unknown> }) => {
                captured.meanings.push(options.where);

                return [{ dataValues: reading }];
            },
        } as unknown as MeaningsModel,
        { order: () => [] } as unknown as SortCollationService,
        {
            get: async () => ({ showUnreviewed }),
        } as unknown as SiteSettingsService,
    );

    return { service, captured };
};

describe('a spelling the import filed more than once', () => {
    it('is listed once', async () => {
        const { service, captured } = build();

        const [names, total] = await service.getNamesForFilter(filters, 1, 10);

        expect(captured.list?.group).toContain('clusterId');
        expect(names).toHaveLength(1);
        expect(total).toBe(1);
    });

    it('is counted once, so the pages match what is shown', async () => {
        const { service, captured } = build();

        await service.getNamesForFilter(filters, 1, 10);

        expect(captured.count).toMatchObject({
            distinct: true,
            col: 'clusterId',
        });
    });

    it('keeps every religion its rows were filed under', async () => {
        const { service } = build();

        const [[name]] = await service.getNamesForFilter(filters, 1, 10);

        expect((name as { religion: string }).religion).toBe('இந்து, முஸ்லிம்');
    });
});

describe('the reading a name is shown with', () => {
    it('is read by cluster', async () => {
        const { service, captured } = build();

        const [[name]] = await service.getNamesForFilter(filters, 1, 10);

        expect((name as { meaning: string }).meaning).toBe(reading.text);
        expect(captured.meanings).toEqual([
            {
                clusterId: { [Op.in]: [7] },
                status: { [Op.in]: ['published'] },
            },
        ]);
    });

    it('includes candidate readings once an admin puts them on the site', async () => {
        const { service, captured } = build(true);

        await service.getNamesForFilter(filters, 1, 10);

        expect(captured.meanings[0]?.status).toEqual({
            [Op.in]: ['published', 'candidate'],
        });
    });
});
