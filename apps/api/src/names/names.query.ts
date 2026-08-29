import {
    getNameNumber,
    IFilterData,
    IName,
    ITwinName,
    Religion,
} from '@tbn/shared';
import { col, Op, ProjectionAlias, WhereOptions } from 'sequelize';

import { numerologyColumn, NumerologySuffix } from './numerology-column';

const TAMIL_VOWEL_SIGN = /[\u0BBE-\u0BCD]/;

const RELIGIONS: Record<Religion, string> = {
    hindu: 'இந்து',
    christian: 'கிறிஸ்துவர்',
    muslim: 'முஸ்லிம்',
};

const isBareTamilLetter = (letter: string) =>
    /[\u0B80-\u0BFF]/.test(letter) && !TAMIL_VOWEL_SIGN.test(letter.slice(-1));

export const startsWithLetter = (
    column: 'name1' | 'name2',
    letter: string,
    exactSyllable: boolean,
): WhereOptions =>
    exactSyllable && isBareTamilLetter(letter)
        ? {
              [Op.and]: [
                  { [column]: { [Op.like]: `${letter}%` } },
                  {
                      [column]: {
                          [Op.notRegexp]: `^${letter}[\\x{0BBE}-\\x{0BCD}]`,
                      },
                  },
              ],
          }
        : { [column]: { [Op.like]: `${letter}%` } };

/**
 * `/api/generate` signs the request body as it stands, so these arrive from the
 * client. Sequelize escapes them, but only 1-9 ever means anything - and 0 is
 * the "no value" marker, which must never be selectable.
 */
export const wantedNumbers = (filters: IFilterData): number[] =>
    (filters.nameNumbers || [])
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 1 && value <= 9);

export const numbersOf = (item: IName | ITwinName) =>
    'name1' in item ? [item.nameNumber1, item.nameNumber2] : [item.nameNumber];

const suffixesOf = (filters: IFilterData): ReadonlyArray<NumerologySuffix> =>
    filters.twinNames ? ['1', '2'] : [''];

/**
 * Reads the stored column, so the number shown and the number filtered on are
 * the same value. A row inserted since the last backfill has none yet, and is
 * computed rather than reported as unvalued.
 */
export const resolveNameNumber = (
    filters: IFilterData,
    name: string,
    stored: number | null | undefined,
): number | null => {
    if (stored === null || stored === undefined) {
        return getNameNumber(name, filters.numerology)?.number ?? null;
    }

    return stored === 0 ? null : stored;
};

export const nameNumberAttributes = (
    filters: IFilterData,
    ready: boolean,
): { include: ProjectionAlias[] } | undefined => {
    if (!ready) {
        return undefined;
    }

    return {
        include: suffixesOf(filters).map((suffix) => [
            col(numerologyColumn(filters.numerology, suffix)),
            `nameNumber${suffix}`,
        ]),
    };
};

// Either name qualifies a twin pair; both numbers are printed, so which one
// matched stays visible.
export const nameNumberWhere = (
    filters: IFilterData,
    wanted: number[],
): WhereOptions => ({
    [Op.or]: suffixesOf(filters).map((suffix) => ({
        [numerologyColumn(filters.numerology, suffix)]: { [Op.in]: wanted },
    })),
});

/**
 * The fallback for when the columns are not ready: filter over the rows, which
 * costs the query its own LIMIT, since the page has to be cut from the rows
 * that survive the filter rather than the ones that reached it.
 */
export function applyNameNumbers<T extends IName | ITwinName>(
    filters: IFilterData,
    rows: T[],
    total: number,
    page?: number,
    limit?: number,
): [T[], number] {
    const wanted = wantedNumbers(filters);

    if (!wanted.length) {
        return [rows, total];
    }

    const filtered = rows.filter((item) =>
        numbersOf(item).some(
            (value) =>
                value !== null && value !== undefined && wanted.includes(value),
        ),
    );

    return [
        page && limit
            ? filtered.slice((page - 1) * limit, page * limit)
            : filtered,
        filtered.length,
    ];
}

export const twinNamesWhere = (
    filters: IFilterData,
    startsWith: string[] | undefined,
    nameNumbers: WhereOptions | null,
): WhereOptions => ({
    [Op.and]: [
        startsWith && startsWith.length
            ? {
                  [Op.or]: startsWith.flatMap((char) => {
                      const exactSyllable = filters.startsWithMode === 'auto';

                      return [
                          startsWithLetter('name1', char, exactSyllable),
                          startsWithLetter('name2', char, exactSyllable),
                      ];
                  }),
              }
            : null,
        filters.gender ? { gender: filters.gender } : null,
        nameNumbers,
    ].filter((item) => item !== null),
});

export const namesWhere = (
    filters: IFilterData,
    startsWith: string[] | undefined,
    nameNumbers: WhereOptions | null,
): WhereOptions => ({
    [Op.and]: [
        startsWith && startsWith.length
            ? filters.startsWithMode === 'manual'
                ? {
                      // A picked letter means "names beginning with it":
                      // prefix-match `first_letter` (it stores whole syllables,
                      // so `க` must reach `கா`) and the name itself for Latin
                      // spellings.
                      [Op.or]: startsWith.flatMap((char) => [
                          { firstLetter: { [Op.like]: `${char}%` } },
                          { name: { [Op.like]: `${char}%` } },
                      ]),
                  }
                : {
                      // Auto mode names exact syllables, and `first_letter`
                      // already normalises Latin spellings onto them, so match
                      // it exactly.
                      firstLetter: { [Op.in]: startsWith },
                  }
            : null,
        filters.gender ? { gender: filters.gender } : null,
        filters.religion ? { religion: RELIGIONS[filters.religion] } : null,
        nameNumbers,
    ].filter((item) => item !== null),
});
