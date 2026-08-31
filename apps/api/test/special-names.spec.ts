import { describe, expect, it } from 'vitest';

import {
    SPECIAL_NAMES,
    specialNote,
    UNCLEAR,
} from '../src/database/special-names.js';

describe('the names filed under சிறப்பு', () => {
    it('covers the rows the import put there, each once', () => {
        expect(SPECIAL_NAMES).toHaveLength(133);
        expect(new Set(SPECIAL_NAMES.map(({ name }) => name)).size).toBe(133);
    });

    it('uses only the religions the catalogue carries', () => {
        const religions = new Set(
            SPECIAL_NAMES.map(({ religion }) => religion),
        );

        expect([...religions].sort()).toEqual([
            'christian',
            'hindu',
            'muslim',
            null,
        ]);
    });

    // A null religion is a claim that the tradition is outside the three, so it
    // has to say which rather than reading as "nobody looked".
    it('says which tradition it is wherever it names no religion', () => {
        const unnamed = SPECIAL_NAMES.filter(
            ({ religion }) => religion === null,
        );

        expect(unnamed.length).toBeGreaterThan(0);
        expect(unnamed.every(({ tradition }) => Boolean(tradition))).toBe(true);
        expect(
            SPECIAL_NAMES.filter(({ tradition }) => tradition).every(
                ({ religion }) => religion === null,
            ),
        ).toBe(true);
    });

    it('says so plainly where the tradition could not be settled', () => {
        const note = specialNote({
            name: 'x',
            religion: null,
            tradition: UNCLEAR,
        });

        expect(note).not.toContain('the unclear tradition');
        expect(note).toContain('not clear enough');
    });

    it('writes the tradition into the note it leaves behind', () => {
        const sikh = SPECIAL_NAMES.find(
            ({ tradition }) => tradition === 'Sikh',
        );

        expect(specialNote(sikh!)).toContain('சிறப்பு');
        expect(specialNote(sikh!)).toContain('Sikh');
        expect(specialNote({ name: 'x', religion: 'hindu' })).not.toContain(
            'tradition, which',
        );
    });
});
