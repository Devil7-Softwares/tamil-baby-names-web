import { describe, expect, it } from 'vitest';

import {
    followOnLettersByLunarMansions,
    getFollowOnLettersForName,
    getStartingLettersForFilter,
    getStartingLettersForName,
    IFilterData,
} from '../src/index.js';

const base: IFilterData = {
    startsWithMode: 'auto',
    tob: '2026-08-27T06:00',
    tz: 'Asia/Kolkata',
    panjangam: 'thirukanitha',
    numerology: 'chaldean',
};

describe('the follow-on letters', () => {
    it('gives a row for every mansion', () => {
        expect(followOnLettersByLunarMansions).toHaveLength(27);
    });

    it('never offers a letter the mansion already searches', () => {
        for (let index = 0; index < 27; index++) {
            const own = getStartingLettersForName(index, 'ta');

            for (const letter of getFollowOnLettersForName(index)) {
                expect(own).not.toContain(letter);
            }
        }
    });

    it('drops the repeats the sources carry and keeps the rest', () => {
        // Magam: மு is one of its own letters.
        expect(getFollowOnLettersForName(9)).toEqual(['மா', 'மீ']);
        // Uthram: பி likewise.
        expect(getFollowOnLettersForName(11)).toEqual(['பா']);
        // Aswini: our table already searches செ.
        expect(getFollowOnLettersForName(0)).toEqual(['சை']);
    });
});

describe('searching by birth', () => {
    // Avittam, per the naming tests in astro.test.ts.
    const avittam = getStartingLettersForName(22, 'ta');

    it('keeps to the mansion’s own letters by default', () => {
        const letters = getStartingLettersForFilter(base) ?? [];

        expect(letters).toEqual(expect.arrayContaining(avittam));
        expect(letters).not.toContain('ஞா');
    });

    it('adds the follow-on letters when asked', () => {
        const letters =
            getStartingLettersForFilter({ ...base, followOnLetters: true }) ??
            [];

        expect(letters).toEqual(
            expect.arrayContaining([...avittam, 'ஞ', 'ஞா']),
        );
    });
});
