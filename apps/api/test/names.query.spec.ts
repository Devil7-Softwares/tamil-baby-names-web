import { getNameNumber, IFilterData, IName } from '@tbn/shared';
import { Op } from 'sequelize';
import { describe, expect, it } from 'vitest';

import {
    applyNameNumbers,
    nameNumberAttributes,
    namesWhere,
    resolveNameNumber,
    startsWithLetter,
    twinNamesWhere,
    wantedNumbers,
} from '../src/names/names.query.js';

const base: IFilterData = {
    startsWithMode: 'none',
    tob: '',
    tz: 'Asia/Kolkata',
    panjangam: 'thirukanitha',
    numerology: 'chaldean',
};

const clauses = (where: unknown) =>
    (where as Record<symbol, unknown[]>)[Op.and] ?? [];

describe('startsWithLetter', () => {
    it('excludes the vowel signs when the syllable has to match exactly', () => {
        const where = startsWithLetter('name1', 'க', true) as Record<
            symbol,
            Array<Record<string, Record<symbol, string>>>
        >;

        expect(where[Op.and]).toHaveLength(2);
        expect(where[Op.and][0].name1[Op.like]).toBe('க%');
        expect(where[Op.and][1].name1[Op.notRegexp]).toBe(
            '^க[\\x{0BBE}-\\x{0BCD}]',
        );
    });

    it('prefix matches a letter that already carries a vowel sign', () => {
        const where = startsWithLetter('name1', 'கா', true) as Record<
            string,
            Record<symbol, string>
        >;

        expect(where.name1[Op.like]).toBe('கா%');
    });

    it('prefix matches a latin letter', () => {
        const where = startsWithLetter('name2', 'A', true) as Record<
            string,
            Record<symbol, string>
        >;

        expect(where.name2[Op.like]).toBe('A%');
    });

    it('prefix matches when the syllable need not be exact', () => {
        const where = startsWithLetter('name1', 'க', false) as Record<
            string,
            Record<symbol, string>
        >;

        expect(where.name1[Op.like]).toBe('க%');
    });
});

describe('wantedNumbers', () => {
    it('keeps only the numbers a name can carry', () => {
        expect(
            wantedNumbers({
                ...base,
                nameNumbers: [0, 1, 5, 9, 10, -1, 3.5, NaN],
            }),
        ).toEqual([1, 5, 9]);
    });

    it('reads the numbers the signed token carried as strings', () => {
        expect(
            wantedNumbers({
                ...base,
                nameNumbers: ['5', '0'] as unknown as number[],
            }),
        ).toEqual([5]);
    });

    it('is empty when nothing was picked', () => {
        expect(wantedNumbers(base)).toEqual([]);
    });
});

describe('resolveNameNumber', () => {
    it('reports the stored value', () => {
        expect(resolveNameNumber(base, 'அறிவு', 7)).toBe(7);
    });

    it('reads 0 as the name having no value', () => {
        expect(resolveNameNumber(base, 'அறிவு', 0)).toBe(null);
    });

    it('computes a row the backfill has not reached yet', () => {
        expect(resolveNameNumber(base, 'அறிவு', null)).toBe(
            getNameNumber('அறிவு', 'chaldean')?.number ?? null,
        );
    });
});

describe('nameNumberAttributes', () => {
    it('selects nothing extra while the columns are not ready', () => {
        expect(nameNumberAttributes(base, false)).toBeUndefined();
    });

    it('aliases the column of the chosen method', () => {
        const attributes = nameNumberAttributes(base, true);

        expect(attributes?.include).toHaveLength(1);
        expect(attributes?.include[0][1]).toBe('nameNumber');
    });

    it('aliases both columns for twin names', () => {
        const attributes = nameNumberAttributes(
            { ...base, twinNames: true },
            true,
        );

        expect(attributes?.include.map(([, alias]) => alias)).toEqual([
            'nameNumber1',
            'nameNumber2',
        ]);
    });
});

describe('namesWhere', () => {
    it('matches the stored syllable exactly in auto mode', () => {
        const where = namesWhere(
            { ...base, startsWithMode: 'auto' },
            ['கா', 'கி'],
            null,
        );

        expect(clauses(where)[0]).toEqual({
            firstLetter: { [Op.in]: ['கா', 'கி'] },
        });
    });

    it('matches the syllable or the latin spelling in manual mode', () => {
        const where = namesWhere(
            { ...base, startsWithMode: 'manual', startsWith: ['க'] },
            ['க'],
            null,
        );

        const [first] = clauses(where) as Array<Record<symbol, unknown[]>>;

        expect(first[Op.or]).toEqual([
            { firstLetter: { [Op.like]: 'க%' } },
            { name: { [Op.like]: 'க%' } },
        ]);
    });

    it('translates the religion to the value the rows carry', () => {
        const where = namesWhere({ ...base, religion: 'hindu' }, [], null);

        expect(clauses(where)).toEqual([{ religion: 'இந்து' }]);
    });

    it('drops the filters that were not asked for', () => {
        expect(clauses(namesWhere(base, undefined, null))).toEqual([]);
    });
});

describe('twinNamesWhere', () => {
    it('lets either name of the pair carry the letter', () => {
        const where = twinNamesWhere(
            {
                ...base,
                twinNames: true,
                startsWithMode: 'manual',
                startsWith: ['க'],
            },
            ['க'],
            null,
        );

        const [first] = clauses(where) as Array<
            Record<symbol, Array<Record<string, Record<symbol, string>>>>
        >;

        expect(first[Op.or]).toHaveLength(2);
        expect(first[Op.or][0].name1[Op.like]).toBe('க%');
        expect(first[Op.or][1].name2[Op.like]).toBe('க%');
    });
});

describe('applyNameNumbers', () => {
    const rows = [1, 2, 3, 4, 5, 6].map(
        (nameNumber, index) =>
            ({ id: index + 1, name: `name-${index}`, nameNumber }) as IName,
    );

    it('leaves the rows alone when no number was picked', () => {
        expect(applyNameNumbers(base, rows, 6)).toEqual([rows, 6]);
    });

    it('counts what survives the filter, not what the query returned', () => {
        const filters = { ...base, nameNumbers: [2, 4, 6] };

        const [filtered, total] = applyNameNumbers(filters, rows, 6);

        expect(filtered.map((row) => row.nameNumber)).toEqual([2, 4, 6]);
        expect(total).toBe(3);
    });

    it('cuts the page from the rows that survived', () => {
        const filters = { ...base, nameNumbers: [2, 4, 6] };

        const [filtered, total] = applyNameNumbers(filters, rows, 6, 2, 2);

        expect(filtered.map((row) => row.nameNumber)).toEqual([6]);
        expect(total).toBe(3);
    });
});
