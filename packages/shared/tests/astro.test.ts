import { describe, expect, it } from 'vitest';

import {
    getLunarMansion,
    getLunarMansionIndex,
    getMoonSign,
    getMoonSignIndex,
    getStartingLettersForName,
} from '../src/astro/index.js';

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
