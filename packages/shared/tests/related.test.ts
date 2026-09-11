import { describe, expect, it } from 'vitest';

import {
    getRelatedLetters,
    getStartingLettersForFilter,
    IFilterData,
} from '../src/index.js';

describe('getRelatedLetters', () => {
    it('flips the vowel sign both ways', () => {
        expect(getRelatedLetters(['யூ', 'பி'])).toEqual(['யு', 'பீ']);
        expect(getRelatedLetters(['யு', 'பீ'])).toEqual(['யூ', 'பி']);
        expect(getRelatedLetters(['கெ', 'கோ'])).toEqual(['கே', 'கொ']);
    });

    it('pairs the bare vowels', () => {
        expect(getRelatedLetters(['அ', 'ஈ', 'ஊ', 'ஏ', 'ஒ'])).toEqual([
            'ஆ',
            'இ',
            'உ',
            'எ',
            'ஓ',
        ]);
    });

    it('pairs a bare consonant with its ா', () => {
        expect(getRelatedLetters(['க', 'டா'])).toEqual(['கா', 'ட']);
    });

    it('leaves the letters with no partner, and Latin spellings, alone', () => {
        expect(getRelatedLetters(['சை', 'கௌ', 'ஐ', 'ஔ', 'YU', 'GA'])).toEqual(
            [],
        );
    });

    it('offers nothing the letters already hold', () => {
        expect(getRelatedLetters(['யு', 'யூ'])).toEqual([]);
    });
});

describe('searching by birth', () => {
    const base: IFilterData = {
        startsWithMode: 'auto',
        // Moolam, whose follow-on letters include யூ.
        tob: '2026-09-18T23:30',
        tz: 'Asia/Kolkata',
        panjangam: 'thirukanitha',
        numerology: 'chaldean',
    };

    it('keeps to the letters shown by default', () => {
        const letters = getStartingLettersForFilter(base) ?? [];

        expect(letters).not.toContain('யு');
    });

    it('brings in the partner of a follow-on letter when both are on', () => {
        const letters =
            getStartingLettersForFilter({
                ...base,
                followOnLetters: true,
                relatedLetters: true,
            }) ?? [];

        expect(letters).toEqual(expect.arrayContaining(['யூ', 'யு']));
    });
});
