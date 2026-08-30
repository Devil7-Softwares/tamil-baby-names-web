import { getNameNumber, IFilterData } from '@tbn/shared';
import { Op } from 'sequelize';
import { describe, expect, it } from 'vitest';

import {
    nameNumberWhere,
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

const allClauses = (where: unknown) =>
    (where as Record<symbol, unknown[]>)[Op.and] ?? [];

/** Everything but the published filter, which every query carries. */
const clauses = (where: unknown) =>
    allClauses(where).filter(
        (clause) =>
            !(
                clause &&
                typeof clause === 'object' &&
                'status' in (clause as object)
            ),
    );

describe('startsWithLetter', () => {
    it('excludes the vowel signs when the syllable has to match exactly', () => {
        const where = startsWithLetter('name1', 'க', true) as Record<
            symbol,
            Array<Record<string, Record<symbol, string>>>
        >;

        expect(where[Op.and]).toHaveLength(2);
        expect(where[Op.and][0].name1[Op.iLike]).toBe('க%');
        expect(where[Op.and][1].name1[Op.notRegexp]).toBe('^க[\u0BBE-\u0BCD]');
    });

    it('prefix matches a letter that already carries a vowel sign', () => {
        const where = startsWithLetter('name1', 'கா', true) as Record<
            string,
            Record<symbol, string>
        >;

        expect(where.name1[Op.iLike]).toBe('கா%');
    });

    it('prefix matches a latin letter', () => {
        const where = startsWithLetter('name2', 'A', true) as Record<
            string,
            Record<symbol, string>
        >;

        expect(where.name2[Op.iLike]).toBe('A%');
    });

    it('prefix matches when the syllable need not be exact', () => {
        const where = startsWithLetter('name1', 'க', false) as Record<
            string,
            Record<symbol, string>
        >;

        expect(where.name1[Op.iLike]).toBe('க%');
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
    it('reports the number stored for the chosen method', () => {
        expect(
            resolveNameNumber(base, 'அறிவு', { chaldean: 7, enkanitham: 3 }),
        ).toBe(7);
    });

    it('reads an absent method as the name having no value', () => {
        expect(resolveNameNumber(base, 'அறிவு', { enkanitham: 3 })).toBe(null);
    });

    it('computes a row the backfill has not reached yet', () => {
        expect(resolveNameNumber(base, 'அறிவு', null)).toBe(
            getNameNumber('அறிவு', 'chaldean')?.number ?? null,
        );
    });
});

describe('nameNumberWhere', () => {
    it('asks for containment, which the gin index can answer', () => {
        const where = nameNumberWhere(base, [3, 7]) as Record<
            symbol,
            unknown[]
        >;

        expect(where[Op.or]).toEqual([
            { numerology: { [Op.contains]: { chaldean: 3 } } },
            { numerology: { [Op.contains]: { chaldean: 7 } } },
        ]);
    });

    it('lets either name of a twin pair carry the number', () => {
        const where = nameNumberWhere(
            { ...base, twinNames: true },
            [5],
        ) as Record<symbol, Array<Record<string, unknown>>>;

        expect(Object.keys(Object.assign({}, ...where[Op.or]))).toEqual([
            'numerology1',
            'numerology2',
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
            { firstLetter: { [Op.iLike]: 'க%' } },
            { name: { [Op.iLike]: 'க%' } },
        ]);
    });

    it('translates the religion to the value the rows carry', () => {
        const where = namesWhere({ ...base, religion: 'hindu' }, [], null);

        expect(clauses(where)).toEqual([{ religion: 'இந்து' }]);
    });

    it('drops the filters that were not asked for', () => {
        expect(clauses(namesWhere(base, undefined, null))).toEqual([]);
    });

    it('serves published rows only, whatever else was asked for', () => {
        expect(allClauses(namesWhere(base, undefined, null))).toContainEqual({
            status: 'published',
        });

        expect(
            allClauses(namesWhere({ ...base, religion: 'hindu' }, ['க'], null)),
        ).toContainEqual({ status: 'published' });

        expect(
            allClauses(twinNamesWhere({ ...base, twinNames: true }, [], null)),
        ).toContainEqual({ status: 'published' });
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
        expect(first[Op.or][0].name1[Op.iLike]).toBe('க%');
        expect(first[Op.or][1].name2[Op.iLike]).toBe('க%');
    });
});
