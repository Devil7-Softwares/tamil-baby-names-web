import {
    getNameNumber,
    IFilterData,
    IName,
    ITwinName,
    NameNumerology,
    PUBLISHED,
    Religion,
} from '@tbn/shared';
import { Op, WhereOptions } from 'sequelize';

const TAMIL_VOWEL_SIGN = /[\u0BBE-\u0BCD]/;

const RELIGIONS: Record<Religion, string> = {
    hindu: 'இந்து',
    christian: 'கிறிஸ்துவர்',
    muslim: 'முஸ்லிம்',
};

const isBareTamilLetter = (letter: string) =>
    /[\u0B80-\u0BFF]/.test(letter) && !TAMIL_VOWEL_SIGN.test(letter.slice(-1));

// iLike, not like: postgres LIKE is case-sensitive where the MySQL column's
// utf8mb4_unicode_ci was not, and the Latin spellings relied on that.
export const startsWithLetter = (
    column: 'name1' | 'name2',
    letter: string,
    exactSyllable: boolean,
): WhereOptions =>
    exactSyllable && isBareTamilLetter(letter)
        ? {
              [Op.and]: [
                  { [column]: { [Op.iLike]: `${letter}%` } },
                  {
                      [column]: {
                          [Op.notRegexp]: `^${letter}[\u0BBE-\u0BCD]`,
                      },
                  },
              ],
          }
        : { [column]: { [Op.iLike]: `${letter}%` } };

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

/** The jsonb columns holding each name's numbers, one per name in the row. */
const numerologyColumnsOf = (
    filters: IFilterData,
): ReadonlyArray<'numerology' | 'numerology1' | 'numerology2'> =>
    filters.twinNames ? ['numerology1', 'numerology2'] : ['numerology'];

/**
 * Reads the stored object, so the number shown and the number filtered on are
 * the same value. A row inserted since the last backfill has none yet, and is
 * computed rather than reported as unvalued.
 */
export const resolveNameNumber = (
    filters: IFilterData,
    name: string,
    stored: NameNumerology | null | undefined,
): number | null => {
    if (!stored) {
        return getNameNumber(name, filters.numerology)?.number ?? null;
    }

    return stored[filters.numerology] ?? null;
};

/**
 * Containment rather than an equality on an extracted key, because `@>` is what
 * the GIN index on the column can answer. Either name qualifies a twin pair;
 * both numbers are printed, so which one matched stays visible.
 */
export const nameNumberWhere = (
    filters: IFilterData,
    wanted: number[],
): WhereOptions => ({
    [Op.or]: numerologyColumnsOf(filters).flatMap((column) =>
        wanted.map((number) => ({
            [column]: { [Op.contains]: { [filters.numerology]: number } },
        })),
    ),
});

// The public site serves published rows only; a candidate exists but is not
// on the site until a reviewer says so.
export const twinNamesWhere = (
    filters: IFilterData,
    startsWith: string[] | undefined,
    nameNumbers: WhereOptions | null,
): WhereOptions => ({
    [Op.and]: [
        { status: PUBLISHED },
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
        { status: PUBLISHED },
        startsWith && startsWith.length
            ? filters.startsWithMode === 'manual'
                ? {
                      // A picked letter means "names beginning with it":
                      // prefix-match `first_letter` (it stores whole syllables,
                      // so `க` must reach `கா`) and the name itself for Latin
                      // spellings.
                      [Op.or]: startsWith.flatMap((char) => [
                          { firstLetter: { [Op.iLike]: `${char}%` } },
                          { name: { [Op.iLike]: `${char}%` } },
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
