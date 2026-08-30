import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

import {
    DEFAULT_PANJANGAM,
    getLunarMansion,
    getLunarMansionIndex,
    getStartingLettersForName,
    isImplementedPanjangam,
} from '../astro';
import { IFilterData } from '../interfaces';
import {
    DEFAULT_NUMEROLOGY,
    getBirthNumber,
    isImplementedNumerology,
    NAME_NUMBERS,
} from '../numerology';
import { getDefaultTimezone } from '../timezones';

// Extended here rather than only in the entry points, since the astro helpers
// below are shared by the browser bundle and the server bundle.
dayjs.extend(utc);
dayjs.extend(timezone);

export const sentenseCase = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Birth date as an absolute instant. `tob` is a wall-clock value, so it only
 * identifies a moment once it is read in the selected timezone.
 */
export const getBirthDate = (tob?: string, tz?: string): Date | null => {
    if (!tob || !tz) {
        return null;
    }

    try {
        const date = dayjs.tz(tob, tz);

        return date.isValid() ? date.toDate() : null;
    } catch {
        // dayjs.tz throws on an unknown timezone name.
        return null;
    }
};

export const getStartingLettersForFilter = (
    filter: IFilterData,
): string[] | undefined => {
    if (filter.startsWithMode === 'manual') {
        return filter.startsWith;
    }

    if (filter.startsWithMode === 'auto') {
        const date = getBirthDate(filter.tob, filter.tz);

        if (date) {
            const lunarMansionIndex = getLunarMansionIndex(
                date,
                filter.panjangam,
            );

            return [
                ...getStartingLettersForName(lunarMansionIndex, 'en'),
                ...getStartingLettersForName(lunarMansionIndex, 'ta'),
            ];
        }
    }

    return undefined;
};

/**
 * The day of the month has to be read in the timezone of birth, not wherever
 * the server runs. Only auto mode asks for a date of birth; anywhere else
 * `tob` is just today's date and the number would be confidently wrong.
 */
export const getBirthNumberFor = (
    startsWithMode: IFilterData['startsWithMode'],
    tob?: string,
    tz?: string,
): number | null => {
    if (startsWithMode !== 'auto' || !tob || !tz) {
        return null;
    }

    try {
        const date = dayjs.tz(tob, tz);

        return date.isValid() ? getBirthNumber(date.date()) : null;
    } catch {
        return null;
    }
};

const parseNameNumbers = (value: string | null): number[] | undefined => {
    if (!value) {
        return undefined;
    }

    const numbers = [
        ...new Set(
            value
                .split(',')
                .map((item) => Number(item.trim()))
                .filter((item) =>
                    (NAME_NUMBERS as readonly number[]).includes(item),
                ),
        ),
    ].sort((a, b) => a - b);

    return numbers.length ? numbers : undefined;
};

export const getStateFromParams = (params: URLSearchParams): IFilterData => {
    const panjangam = params.get('panjangam');
    const numerology = params.get('numerology');

    const twinNames = params.get('twinNames') === 'true';

    const base = {
        gender: (params.get('gender') as IFilterData['gender']) || undefined,
        twinNames,
        // `twin_names` has no religion column, so the filter cannot be applied
        // to a twin search. Dropping it here keeps the title, the access token
        // and the PDF header from claiming a religion the query never used.
        religion: twinNames
            ? undefined
            : (params.get('religion') as IFilterData['religion']) || undefined,
        tob: params.get('tob') || dayjs().format('YYYY-MM-DDTHH:mm'),
        tz: params.get('tz') || getDefaultTimezone(),
        // Anything unknown (or not implemented yet) falls back to the default,
        // so an unsupported method can never reach the calculation.
        panjangam:
            panjangam && isImplementedPanjangam(panjangam)
                ? panjangam
                : DEFAULT_PANJANGAM,
        numerology:
            numerology && isImplementedNumerology(numerology)
                ? numerology
                : DEFAULT_NUMEROLOGY,
        nameNumbers: parseNameNumbers(params.get('nameNumbers')),
    };

    const startsWithMode =
        (params.get('startsWithMode') as IFilterData['startsWithMode']) ||
        'none';

    if (startsWithMode === 'manual') {
        return {
            ...base,
            startsWithMode,
            startsWith: params.get('startsWith')?.split(',') || [],
        };
    }

    return { ...base, startsWithMode };
};

export const getDocumentTitleByFilter = (filter: IFilterData) => {
    const documentTitle = [];

    if (filter.twinNames) {
        if (filter.gender) {
            if (filter.religion) {
                documentTitle.push(
                    `Twin Names for ${sentenseCase(
                        filter.religion,
                    )} ${sentenseCase(filter.gender)}s`,
                );
            } else {
                documentTitle.push(
                    `Twin Names for ${sentenseCase(filter.gender)}s`,
                );
            }
        } else if (filter.religion) {
            documentTitle.push(`${sentenseCase(filter.religion)} Names`);
        } else {
            documentTitle.push('Twin Names');
        }
    } else {
        if (filter.gender) {
            if (filter.religion) {
                documentTitle.push(
                    `${sentenseCase(filter.religion)} ${sentenseCase(
                        filter.gender,
                    )} Names`,
                );
            } else {
                documentTitle.push(`${sentenseCase(filter.gender)} Names`);
            }
        } else if (filter.religion) {
            documentTitle.push(`${sentenseCase(filter.religion)} Names`);
        }
    }

    if (
        filter.startsWithMode === 'manual' &&
        filter.startsWith &&
        filter.startsWith.length > 0
    ) {
        documentTitle.push(`Starting with ${filter.startsWith}`);
    } else if (filter.startsWithMode === 'auto') {
        const date = getBirthDate(filter.tob, filter.tz);

        if (date) {
            const lunarMansionIndex = getLunarMansionIndex(
                date,
                filter.panjangam,
            );
            const lunarMansion = getLunarMansion(lunarMansionIndex, 'en');

            documentTitle.push(`For ${lunarMansion} Nakshatra`);
        }
    }

    documentTitle.push('Tamil Baby Names');

    return documentTitle.join(' | ');
};
