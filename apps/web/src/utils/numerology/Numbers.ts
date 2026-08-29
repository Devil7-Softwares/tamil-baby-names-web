import { Numerology } from '@tbn/shared';

import { getNameNumberChaldean } from './Chaldean';
import { getNameNumberEnkanitham } from './Enkanitham';
import { getNameNumberPythagorean } from './Pythagorean';

export const DEFAULT_NUMEROLOGY: Numerology = 'enkanitham';

/**
 * Methods are registered as they are implemented; `getStateFromParams` only
 * accepts the ones listed, so an unimplemented method cannot reach a name.
 */
const nameValueByNumerology: Partial<
    Record<Numerology, (name: string) => number | null>
> = {
    enkanitham: getNameNumberEnkanitham,
    chaldean: getNameNumberChaldean,
    pythagorean: getNameNumberPythagorean,
};

export const implementedNumerologies = Object.keys(
    nameValueByNumerology,
) as Numerology[];

export const isImplementedNumerology = (value: string): value is Numerology =>
    implementedNumerologies.includes(value as Numerology);

export function reduceToSingleDigit(value: number): number {
    let result = Math.abs(Math.trunc(value));

    while (result > 9) {
        let sum = 0;

        for (let rest = result; rest > 0; rest = Math.floor(rest / 10)) {
            sum += rest % 10;
        }

        result = sum;
    }

    return result;
}

export interface INameNumber {
    /** The summed letter values, before reduction. */
    total: number;
    /** That total reduced to 1-9. */
    number: number;
}

/**
 * Null when the method assigns the name no value. Each method reads one script -
 * Enkanitham Tamil, the other two Latin - so which names are valued depends on
 * the method as much as on the name.
 */
export function getNameNumber(
    name: string,
    numerology: Numerology = DEFAULT_NUMEROLOGY,
): INameNumber | null {
    const value = nameValueByNumerology[numerology];

    if (!value) {
        return null;
    }

    const total = value(name);

    return total === null
        ? null
        : { total, number: reduceToSingleDigit(total) };
}

// Every method reads the birth number the same way, so it is not pluggable.
export const getBirthNumber = (dayOfMonth: number) =>
    reduceToSingleDigit(dayOfMonth);

export const NAME_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
