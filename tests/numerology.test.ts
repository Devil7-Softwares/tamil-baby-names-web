import { describe, expect, it } from 'vitest';

import {
    DEFAULT_NUMEROLOGY,
    getBirthNumber,
    getNameNumber,
    implementedNumerologies,
    isImplementedNumerology,
    numerologyLocales,
    reduceToSingleDigit,
} from '../src/utils/numerology';

describe('enkanitham name values', () => {
    // Every worked example printed in the source, which pins the letter values
    // and the decomposition together.
    it.each([
        ['முத்துக்கமலம்', 53, 8],
        ['ஞாயிறு', 25, 7],
        ['திங்கள்', 20, 2],
        ['செவ்வாய்', 36, 9],
    ])('scores %s as %i', (name, total, number) => {
        expect(getNameNumber(name)).toEqual({ total, number });
    });

    it('gives a consonant its inherent அ, and none after a pulli', () => {
        expect(getNameNumber('க')?.total).toBe(1 + 3);
        expect(getNameNumber('க்')?.total).toBe(1);
    });

    it('replaces the inherent அ with the vowel sign', () => {
        expect(getNameNumber('கா')?.total).toBe(1 + 3);
        expect(getNameNumber('கே')?.total).toBe(1 + 7);
        expect(getNameNumber('கை')?.total).toBe(1 + 5);
    });

    it('reads ஔ as அவ்', () => {
        expect(getNameNumber('கௌ')?.total).toBe(1 + 3 + 6);
    });

    it('separates the aytham from the borrowed f', () => {
        expect(getNameNumber('சனாஃ')?.total).toBe(7 + 3 + 2 + 3 + 1);
        expect(getNameNumber('ஃப்')?.total).toBe(6);
        expect(getNameNumber('ஃபா')?.total).toBe(6 + 3);
    });

    it('scores ஶ with the other sibilants', () => {
        expect(getNameNumber('ஶ்')?.total).toBe(7);
        expect(getNameNumber('ஶ்ரீமதி')).toEqual(getNameNumber('ஷ்ரீமதி'));
    });

    // Around a third of the catalogue is Latin script; a wrong number there
    // would be worse than no number.
    it('leaves names it cannot read unvalued', () => {
        expect(getNameNumber('Amiya')).toBeNull();
        expect(getNameNumber('')).toBeNull();
        expect(getNameNumber('123')).toBeNull();
        // Three catalogue rows are mojibake that mixes the two scripts.
        expect(getNameNumber('தமிழௌpழன்')).toBeNull();
    });

    it('ignores spacing and punctuation between sounds', () => {
        expect(getNameNumber('அ ன்')).toEqual(getNameNumber('அன்'));
    });
});

describe('reduction', () => {
    it('sums digits until one is left', () => {
        expect(reduceToSingleDigit(53)).toBe(8);
        expect(reduceToSingleDigit(9)).toBe(9);
        expect(reduceToSingleDigit(0)).toBe(0);
        expect(reduceToSingleDigit(999999999)).toBe(9);
    });

    // No letter is worth 9, but a total can be, so the filter has to offer it.
    it('reaches every digit a name can hold', () => {
        expect(reduceToSingleDigit(36)).toBe(9);
    });
});

describe('birth number', () => {
    // The source's example: born on the 21st, birth number 3.
    it('reduces the day of the month', () => {
        expect(getBirthNumber(21)).toBe(3);
        expect(getBirthNumber(16)).toBe(7);
        expect(getBirthNumber(9)).toBe(9);
    });
});

describe('numerology registration', () => {
    it('offers enkanitham by default', () => {
        expect(DEFAULT_NUMEROLOGY).toBe('enkanitham');
        expect(implementedNumerologies).toEqual(['enkanitham']);
        expect(isImplementedNumerology('enkanitham')).toBe(true);
        expect(isImplementedNumerology('chaldean')).toBe(false);
        expect(isImplementedNumerology('nonsense')).toBe(false);
    });

    it('returns nothing for a method that is not implemented yet', () => {
        expect(getNameNumber('முத்துக்கமலம்', 'chaldean')).toBeNull();
    });

    // The exported PDF prints these, so a missing one reaches the user as the
    // word "undefined" rather than as an error.
    it('names every method it offers, in both locales', () => {
        for (const numerology of implementedNumerologies) {
            expect(numerologyLocales.en.numerologies[numerology]).toBeTruthy();
            expect(numerologyLocales.ta.numerologies[numerology]).toBeTruthy();
        }
    });
});
