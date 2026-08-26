import { describe, expect, it } from 'vitest';

import {
    CANDRAVAKYAS,
    getLongitudeOfMoon,
    getLunarMansion,
    getLunarMansionIndex,
    implementedPanjangams,
    isImplementedPanjangam,
} from '../src/utils/astro';

describe('candravakya table', () => {
    const V = (n: number) => CANDRAVAKYAS[n];
    const TOTAL = V(248);

    it('has 248 vakyas plus the empty remainder', () => {
        expect(CANDRAVAKYAS).toHaveLength(249);
        expect(V(0)).toBe(0);
    });

    // The edition states both of these as its own way of catching a corrupt
    // vakya, so they catch a corrupt transcription just as well.
    it("closes at 0r 27deg 44'", () => {
        expect(TOTAL).toBe(27 * 60 + 44);
    });

    it('pairs summing to 248 add up to the total', () => {
        for (let n = 1; n < 248; n++) {
            expect((V(n) + V(248 - n)) % (360 * 60)).toBe(TOTAL);
        }
    });

    it('has six rasis plus half the total as its middle vakya', () => {
        expect(V(124)).toBe(180 * 60 + TOTAL / 2);
    });

    it("keeps the daily motion inside the Moon's range", () => {
        for (let n = 1; n <= 248; n++) {
            const motion =
                (((V(n) - V(n - 1)) % (360 * 60)) + 360 * 60) % (360 * 60);

            expect(motion / 60).toBeGreaterThan(11.5);
            expect(motion / 60).toBeLessThan(15.5);
        }
    });
});

describe('vakkiya longitude', () => {
    /**
     * The Vakyakarana's own worked example (I.12-14a, example 3): the True Moon
     * for Kali day 18,44,004 is 4r 11deg 17' 32". That ahargana is JD 24,32,469.5,
     * plus the twelve minute sunrise offset the implementation carries.
     */
    it("reproduces the edition's worked example", () => {
        const atThatSunrise = new Date('1947-10-11T00:12:00Z');
        const expected = 4 * 30 + 11 + 17 / 60 + 32 / 3600;

        expect(getLongitudeOfMoon(atThatSunrise, 'vakkiya')).toBeCloseTo(
            expected,
            3,
        );
    });

    /**
     * Nakshatra end times printed by the Srirangam temple Vakya almanac for
     * Purattasi 2026, converted from naazhigai after sunrise. The app tracks
     * them to a mean of 0.02 minutes with a 3 minute spread, so a 30 minute
     * bracket is comfortable and still fails on any real drift.
     */
    const published = [
        { end: '2026-09-19T21:28:48Z', mansion: 18 },
        { end: '2026-09-25T06:38:24Z', mansion: 23 },
        { end: '2026-10-01T03:30:00Z', mansion: 2 },
        { end: '2026-10-08T17:02:24Z', mansion: 10 },
        { end: '2026-10-17T04:28:48Z', mansion: 18 },
    ];
    const BRACKET_MS = 30 * 60 * 1000;

    it.each(published)('changes lunar mansion at $end', ({ end, mansion }) => {
        const at = Date.parse(end);

        expect(getLunarMansionIndex(new Date(at - BRACKET_MS), 'vakkiya')).toBe(
            mansion,
        );
        expect(getLunarMansionIndex(new Date(at + BRACKET_MS), 'vakkiya')).toBe(
            (mansion + 1) % 27,
        );
    });

    it('differs from thirukanitha, which is the point of offering it', () => {
        const birth = new Date('2026-01-16T00:30:00Z');

        expect(
            getLunarMansion(getLunarMansionIndex(birth, 'thirukanitha'), 'en'),
        ).toBe('Moolam');
        expect(
            getLunarMansion(getLunarMansionIndex(birth, 'vakkiya'), 'en'),
        ).toBe('Kettai');
    });
});

describe('panjangam registration', () => {
    it('offers both methods', () => {
        expect(implementedPanjangams).toEqual(['thirukanitha', 'vakkiya']);
        expect(isImplementedPanjangam('vakkiya')).toBe(true);
        expect(isImplementedPanjangam('nonsense')).toBe(false);
    });
});
