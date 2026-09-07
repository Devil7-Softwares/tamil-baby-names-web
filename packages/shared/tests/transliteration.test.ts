import { describe, expect, it } from 'vitest';

import {
    firstSyllable,
    romanise,
    sortKey,
    tamilise,
} from '../src/transliteration/Tamil.js';

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

describe('firstSyllable', () => {
    it('keeps the vowel sign hanging on the consonant', () => {
        expect(firstSyllable('காசிமா')).toBe('கா');
    });

    it('stops at a vowel standing on its own', () => {
        expect(firstSyllable('அன்பு')).toBe('அ');
    });

    // A pulli joins what follows, so the conjunct the catalogue files under
    // ஸ்ரீ stays whole instead of breaking after the ஸ.
    it('carries a conjunct through the pulli that binds it', () => {
        expect(firstSyllable('ஸ்ரீவித்யா')).toBe('ஸ்ரீ');
    });

    it('says only the first letter of a name written in Latin', () => {
        expect(firstSyllable('Bexley')).toBe('B');
    });

    it('has nothing to say about an empty name', () => {
        expect(firstSyllable('')).toBe('');
    });
});

/**
 * Measured against the 1,371 Latin/Tamil pairs the shyamkumar dataset supplies,
 * where every rule below was chosen because it moved that number: 202 exact
 * matches to start with, 447 by the end, and character accuracy 72% to 82%.
 *
 * A third of names exactly right is a good suggestion and a terrible answer,
 * which is the whole design: what this produces goes in a box the reader edits
 * before anything scores it.
 */
describe('tamilise', () => {
    it('reads the ordinary English spelling of a name', () => {
        expect(tamilise('Amudhan')).toBe('அமுதன்');
        expect(tamilise('Kavi')).toBe('கவி');
        expect(tamilise('Meena')).toBe('மீனா');
        expect(tamilise('Selvi')).toBe('செல்வி');
    });

    // Tamil does not begin a word with ன, whatever the English suggests.
    it('opens a name with ந rather than ன', () => {
        expect(tamilise('Nila')).toBe('நிலா');
        expect(tamilise('Nila Nila')).toBe('நிலா நிலா');
    });

    // Tamil assimilates a nasal to what follows and writes the result.
    it('writes a nasal as the cluster it becomes', () => {
        expect(tamilise('Thango')).toBe('தங்கோ');
        expect(tamilise('Anna')).toBe('அண்ணா');
        expect(tamilise('Anjali')).toBe('அஞ்சலி');
        expect(tamilise('Sundar')).toBe('சுந்தர்');
    });

    // The bug this caught: a cluster ending in a pulli left the next vowel
    // sign hanging off it, so Thango came back as தங்ொ.
    it('never leaves a vowel sign without a letter to sit on', () => {
        expect(tamilise('Thango')).not.toContain('்ோ');
        expect(tamilise('Ponganan')).not.toContain('்ெ');
    });

    it('ends a name on the long vowel', () => {
        expect(tamilise('Farida')).toBe('ஃபரிதா');
        expect(tamilise('Priya')).toBe('ப்ரியா');
        // Not `i` though: Ravi is ரவி and never ரவீ.
        expect(tamilise('Ravi')).toBe('ரவி');
    });

    it('keeps a name that is two words two words', () => {
        expect(tamilise('Adaikalam Kaathan')).toContain(' ');
    });

    // Not an inverse, and not claimed to be: romanise folds ண, ந and ன onto
    // one letter, and nothing can unfold them. It does hold for the names whose
    // sounds survive the trip, which is most of them.
    it('round trips a name whose sounds survive romanise', () => {
        for (const name of ['அமுதன்', 'கவி', 'நிலா', 'செல்வி']) {
            expect(tamilise(romanise(name))).toBe(name);
        }
    });

    it('leaves what it cannot read rather than dropping it', () => {
        expect(tamilise('')).toBe('');
        expect(tamilise('Ram-2')).toContain('-2');
    });
});
