import { describe, expect, it } from 'vitest';

import {
    DEFAULT_NUMEROLOGY,
    getBirthNumber,
    getNameNumber,
    implementedNumerologies,
    isImplementedNumerology,
    numerologyLocales,
    reduceToSingleDigit,
} from '../src/numerology';

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

describe('chaldean name values', () => {
    // The worked example printed in the source.
    it('scores MUTHUKAMALAM as 41', () => {
        expect(getNameNumber('MUTHUKAMALAM', 'chaldean')).toEqual({
            total: 41,
            number: 5,
        });
    });

    it('reads every letter, either case', () => {
        expect(getNameNumber('Muthukamalam', 'chaldean')?.total).toBe(41);
        // A-Z once: 5(1) + 3(2) + 4(3) + 3(4) + 4(5) + 3(6) + 2(7) + 2(8)
        expect(
            getNameNumber('abcdefghijklmnopqrstuvwxyz', 'chaldean')?.total,
        ).toBe(5 * 1 + 3 * 2 + 4 * 3 + 3 * 4 + 4 * 5 + 3 * 6 + 2 * 7 + 2 * 8);
    });

    it('ignores spacing and punctuation', () => {
        expect(getNameNumber("Mary-Anne O'Neil", 'chaldean')).toEqual(
            getNameNumber('MaryAnneONeil', 'chaldean'),
        );
    });

    // Scoring a transliteration scores the English spelling's sounds, not the
    // name's - the objection the Enkanitham source raises. The two methods read
    // one script each and cover complementary halves of the catalogue.
    it('leaves Tamil-script names to enkanitham', () => {
        expect(getNameNumber('முத்துக்கமலம்', 'chaldean')).toBeNull();
        expect(getNameNumber('ஶ்ரீமதி', 'chaldean')).toBeNull();
        expect(getNameNumber('', 'chaldean')).toBeNull();
        expect(getNameNumber('123', 'chaldean')).toBeNull();
    });

    // Enkanitham cannot read a Latin name and chaldean cannot read a Tamil one,
    // so between them every name is valued exactly once.
    it('picks up where enkanitham stops', () => {
        expect(getNameNumber('Amiya', 'enkanitham')).toBeNull();
        // A+M+I+Y+A = 1+4+1+1+1
        expect(getNameNumber('Amiya', 'chaldean')).toEqual({
            total: 8,
            number: 8,
        });
    });
});

describe('pythagorean name values', () => {
    const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    // The table is positional, so it can be checked rather than trusted: each
    // letter is worth its place in the alphabet reduced to 1-9. A transcription
    // slip in the table would break this.
    it('gives every letter its alphabet position reduced', () => {
        for (const [index, letter] of [...LETTERS].entries()) {
            expect(getNameNumber(letter, 'pythagorean')?.total).toBe(
                (index % 9) + 1,
            );
        }
    });

    it('sums the letters of a name', () => {
        // M=4 A=1 R=9 Y=7
        expect(getNameNumber('Mary', 'pythagorean')).toEqual({
            total: 21,
            number: 3,
        });
        expect(getNameNumber('mary', 'pythagorean')?.total).toBe(21);
    });

    // Chaldean assigns no letter 9 and holds a different table, so the two
    // Latin systems disagree on most names.
    it('reads the same name differently from chaldean', () => {
        expect(getNameNumber('MUTHUKAMALAM', 'chaldean')?.total).toBe(41);
        expect(getNameNumber('MUTHUKAMALAM', 'pythagorean')?.total).not.toBe(
            41,
        );
    });

    it('leaves Tamil-script names to enkanitham', () => {
        expect(getNameNumber('முத்துக்கமலம்', 'pythagorean')).toBeNull();
        expect(getNameNumber('', 'pythagorean')).toBeNull();
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
    it('offers every method, enkanitham by default', () => {
        expect(DEFAULT_NUMEROLOGY).toBe('enkanitham');
        expect(implementedNumerologies).toEqual([
            'enkanitham',
            'chaldean',
            'pythagorean',
        ]);
        expect(isImplementedNumerology('nonsense')).toBe(false);
    });

    it('returns nothing for a method it does not know', () => {
        expect(
            getNameNumber(
                'Amiya',
                'kabbalah' as (typeof implementedNumerologies)[number],
            ),
        ).toBeNull();
    });

    // The precomputed DB column is named after the method, so a name SQL cannot
    // quote would break the migration rather than be rejected.
    it('names every method safely for a column name', () => {
        for (const numerology of implementedNumerologies) {
            expect(numerology).toMatch(/^[a-z]+$/);
        }
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
