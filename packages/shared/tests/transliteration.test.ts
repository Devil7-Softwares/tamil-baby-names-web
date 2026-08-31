import { describe, expect, it } from 'vitest';

import { romanise, sortKey } from '../src/transliteration/Tamil.js';

describe('romanise', () => {
    it('carries the a a consonant is written with', () => {
        expect(romanise('கம')).toBe('kama');
    });

    it('drops it where the pulli does', () => {
        expect(romanise('கம்')).toBe('kam');
    });

    it('reads a vowel sign in place of that a', () => {
        expect(romanise('கா')).toBe('kaa');
        expect(romanise('கி')).toBe('ki');
        expect(romanise('கை')).toBe('kai');
    });

    it('doubles a long vowel and writes ழ as zh', () => {
        expect(romanise('ஆ')).toBe('aa');
        expect(romanise('ஈ')).toBe('ii');
        expect(romanise('தமிழ்')).toBe('thamizh');
    });

    it('reads the grantha letters the borrowings are full of', () => {
        expect(romanise('ஜாகீர்')).toBe('jaakiir');
        expect(romanise('ஷ')).toBe('sha');
    });

    it('leaves a name already in Latin letters alone', () => {
        expect(romanise('Richard')).toBe('Richard');
    });
});

describe('sortKey', () => {
    // The whole point: Unicode puts these two an entire script apart.
    it('lands both spellings of a name on the same key', () => {
        expect(sortKey('Abi')).toBe(sortKey('அபி'));
    });

    it('folds the letters Tamil writes one of and English writes two', () => {
        expect(sortKey('Gopi')).toBe('kopi');
        expect(sortKey('Devi')).toBe('tevi');
        expect(sortKey('Bala')).toBe('pala');
    });

    // Chandra would otherwise fold into a kh and meet nothing.
    it('reads ch as the ச it stands for', () => {
        expect(sortKey('Chandra')).toBe('santra');
    });

    it('drops what never ordered a name', () => {
        expect(sortKey('Ram Mohan!')).toBe('rammohan');
    });

    it('keeps the vowel length the scheme spells out', () => {
        expect(sortKey('கோபி')).toBe('koopi');
        expect(sortKey('Gopi')).toBe('kopi');
    });
});
