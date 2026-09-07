import { describe, expect, it } from 'vitest';

import {
    getLunarMansion,
    getLunarMansionIndex,
    getMoonSign,
    getMoonSignIndex,
    getPadhamIndex,
    getPadhamLettersForName,
    getStartingLettersForName,
} from '../src/astro/index.js';
import { locales } from '../src/astro/Locales.js';

/**
 * Instants at which the moon leaves a lunar mansion, as published by Drik
 * Panchang, which uses the same Lahiri drik ganita this app implements. Chosen
 * to span 1995-2030 so an epoch or precession error cannot pass.
 *
 * These guard the ayanamsa: a wrong constant once put every position 2.54 h
 * early, which reported the wrong mansion for one birth time in ten. Sampling
 * either side of a transition is the only way to catch that - a date picked at
 * random sits mid-mansion and looks correct however far the ayanamsa is out.
 */
const transitions = [
    {
        at: '1995-03-14T22:13:00+05:30',
        mansion: 8,
        next: 9,
        sign: 3,
        nextSign: 4,
    },
    {
        at: '2001-11-07T09:15:00+05:30',
        mansion: 6,
        next: 7,
        sign: 3,
        nextSign: 3,
    },
    {
        at: '2010-06-22T18:39:00+05:30',
        mansion: 14,
        next: 15,
        sign: 6,
        nextSign: 6,
    },
    {
        at: '2016-03-01T00:18:00+05:30',
        mansion: 15,
        next: 16,
        sign: 7,
        nextSign: 7,
    },
    {
        at: '2023-09-30T21:08:00+05:30',
        mansion: 26,
        next: 0,
        sign: 11,
        nextSign: 0,
    },
    {
        at: '2026-08-28T02:15:00+05:30',
        mansion: 22,
        next: 23,
        sign: 10,
        nextSign: 10,
    },
    {
        at: '2026-09-25T11:22:00+05:30',
        mansion: 23,
        next: 24,
        sign: 10,
        nextSign: 10,
    },
    {
        at: '2030-05-18T15:26:00+05:30',
        mansion: 16,
        next: 17,
        sign: 7,
        nextSign: 7,
    },
];

/**
 * The app agrees with those instants to within ~2 minutes, so this bracket
 * tolerates rounding while still failing on any systematic shift.
 */
const BRACKET_MS = 45 * 60 * 1000;

const before = (at: string) => new Date(Date.parse(at) - BRACKET_MS);
const after = (at: string) => new Date(Date.parse(at) + BRACKET_MS);

describe('getLunarMansionIndex', () => {
    it.each(transitions)('changes at $at', ({ at, mansion, next }) => {
        expect(getLunarMansionIndex(before(at))).toBe(mansion);
        expect(getLunarMansionIndex(after(at))).toBe(next);
    });
});

// A mansion ends exactly where its fourth padham does, so every instant that
// changes the mansion has to carry the padham from the last quarter into the
// first. Nothing here needs a published padham to check against: the two
// readings come from one longitude and must agree by construction.
describe('getPadhamIndex', () => {
    it.each(transitions)('rolls over at $at', ({ at }) => {
        expect(getPadhamIndex(before(at))).toBe(3);
        expect(getPadhamIndex(after(at))).toBe(0);
    });

    it('stays inside the four quarters', () => {
        for (let day = 0; day < 30; day++) {
            const at = new Date(
                Date.parse('2026-01-01T00:00:00+05:30') + day * 86_400_000,
            );

            expect(getPadhamIndex(at)).toBeGreaterThanOrEqual(0);
            expect(getPadhamIndex(at)).toBeLessThan(4);
        }
    });
});

describe('getMoonSignIndex', () => {
    it.each(transitions)('is consistent at $at', ({ at, sign, nextSign }) => {
        expect(getMoonSignIndex(before(at))).toBe(sign);
        expect(getMoonSignIndex(after(at))).toBe(nextSign);
    });
});

describe('naming', () => {
    const birth = new Date('2026-08-27T06:00:00+05:30');

    it('names the mansion in both locales', () => {
        expect(getLunarMansion(birth, 'en')).toBe('Avittam');
        expect(getLunarMansion(birth, 'ta')).toBe('அவிட்டம்');
    });

    it('names the moon sign in both locales', () => {
        expect(getMoonSign(birth, 'en')).toBe('Capricorn');
        expect(getMoonSign(birth, 'ta')).toBe('மகரம்');
    });

    it('maps the mansion to its starting letters', () => {
        expect(getStartingLettersForName(birth, 'ta')).toEqual([
            'க',
            'கீ',
            'கு',
            'கூ',
            'கி',
            'கே',
        ]);
    });

    it('has letters for every mansion', () => {
        for (let index = 0; index < 27; index++) {
            expect(
                getStartingLettersForName(index, 'en').length,
            ).toBeGreaterThan(0);
            expect(
                getStartingLettersForName(index, 'ta').length,
            ).toBeGreaterThan(0);
        }
    });
});

/**
 * Where the padham table came from, kept honest.
 *
 * Eleven of the twenty-seven mansions already listed exactly four letters, and
 * for those the existing list *is* the padhams in order. That is the evidence
 * the rest of the table was written against, so it is asserted rather than
 * described: if either table is edited and they stop agreeing, one of the two
 * is now wrong and this says so.
 */
describe('the padham letters', () => {
    it.each(['en', 'ta'] as const)(
        'gives four for every mansion in %s',
        (locale) => {
            const table = locales[locale].namingLettersByPadham;

            expect(table).toHaveLength(27);

            for (const mansion of table) {
                expect(mansion).toHaveLength(4);
                expect(mansion.every((letter) => letter.trim())).toBe(true);
            }
        },
    );

    it('agrees with every mansion that already listed exactly four', () => {
        const flat = locales.ta.namingLettersByLunarMansions;
        const padhams = locales.ta.namingLettersByPadham;
        const checked = flat.filter((letters) => letters.length === 4).length;

        // Fewer than this and the evidence behind the table has been thrown
        // away rather than the table being wrong.
        expect(checked).toBe(11);

        flat.forEach((letters, mansion) => {
            if (letters.length === 4) {
                expect(padhams[mansion]).toEqual(letters);
            }
        });
    });

    it('reads a birth as the quarter it fell in', () => {
        const birth = new Date('2026-08-27T06:00:00+05:30');

        // Avittam, whose four are Ga, Gi, Gu, Ge.
        expect(getPadhamLettersForName(birth, 'ta')).toEqual([
            'க',
            'கி',
            'கு',
            'கே',
        ]);
        expect(getPadhamIndex(birth)).toBe(0);
        expect(
            getPadhamLettersForName(birth, 'en')[getPadhamIndex(birth)],
        ).toBe('GA');
    });
});
