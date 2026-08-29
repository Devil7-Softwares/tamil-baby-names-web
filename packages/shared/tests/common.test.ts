import { describe, expect, it } from 'vitest';

import {
    getBirthDate,
    getBirthNumberFor,
    getStartingLettersForFilter,
    getStateFromParams,
} from '../src/common';
import { IFilterData } from '../src/interfaces';

describe('getBirthDate', () => {
    it('reads the wall clock time in the given timezone', () => {
        expect(
            getBirthDate('2026-08-27T06:00', 'Asia/Kolkata')?.toISOString(),
        ).toBe('2026-08-27T00:30:00.000Z');
        expect(getBirthDate('2026-08-27T06:00', 'UTC')?.toISOString()).toBe(
            '2026-08-27T06:00:00.000Z',
        );
    });

    it('returns null for anything it cannot resolve', () => {
        expect(getBirthDate(undefined, 'Asia/Kolkata')).toBeNull();
        expect(getBirthDate('2026-08-27T06:00', undefined)).toBeNull();
        expect(getBirthDate('not a date', 'Asia/Kolkata')).toBeNull();
        expect(getBirthDate('2026-08-27T06:00', 'Middle/Earth')).toBeNull();
    });
});

describe('getStartingLettersForFilter', () => {
    const base = {
        tob: '2026-08-27T06:00',
        tz: 'Asia/Kolkata',
        panjangam: 'thirukanitha',
        numerology: 'enkanitham',
    } as const;

    it('passes manual letters straight through', () => {
        expect(
            getStartingLettersForFilter({
                ...base,
                startsWithMode: 'manual',
                startsWith: ['அ', 'ஆ'],
            }),
        ).toEqual(['அ', 'ஆ']);
    });

    it('derives both locales from the birth time in auto mode', () => {
        expect(
            getStartingLettersForFilter({ ...base, startsWithMode: 'auto' }),
        ).toEqual([
            'GAA',
            'GEE',
            'GOO',
            'GAY',
            'GA',
            'GI',
            'GU',
            'GE',
            'க',
            'கீ',
            'கு',
            'கூ',
            'கி',
            'கே',
        ]);
    });

    it('derives nothing when the birth time is unusable', () => {
        expect(
            getStartingLettersForFilter({
                ...base,
                tz: 'Middle/Earth',
                startsWithMode: 'auto',
            }),
        ).toBeUndefined();
        expect(
            getStartingLettersForFilter({ ...base, startsWithMode: 'none' }),
        ).toBeUndefined();
    });
});

describe('getStateFromParams', () => {
    const parse = (query: string) =>
        getStateFromParams(new URLSearchParams(query));

    it('splits manual letters', () => {
        const state = parse('startsWithMode=manual&startsWith=அ,ஆ');

        expect(state.startsWithMode).toBe('manual');
        expect(
            (state as Extract<IFilterData, { startsWithMode: 'manual' }>)
                .startsWith,
        ).toEqual(['அ', 'ஆ']);
    });

    it('keeps the birth time rather than the letters in auto mode', () => {
        const state = parse(
            'startsWithMode=auto&tob=2026-08-27T06:00&tz=Asia/Kolkata',
        );

        expect(state.startsWithMode).toBe('auto');
        expect(state.startsWith).toBeUndefined();
        expect(state.tob).toBe('2026-08-27T06:00');
        expect(state.tz).toBe('Asia/Kolkata');
    });

    it('defaults to none', () => {
        expect(parse('').startsWithMode).toBe('none');
    });

    it('keeps an implemented panjangam and rejects anything else', () => {
        expect(parse('panjangam=thirukanitha').panjangam).toBe('thirukanitha');
        expect(parse('panjangam=vakkiya').panjangam).toBe('vakkiya');
        expect(parse('panjangam=nonsense').panjangam).toBe('thirukanitha');
        expect(parse('').panjangam).toBe('thirukanitha');
    });

    it('keeps an implemented numerology and rejects anything else', () => {
        expect(parse('numerology=enkanitham').numerology).toBe('enkanitham');
        expect(parse('numerology=chaldean').numerology).toBe('chaldean');
        expect(parse('numerology=pythagorean').numerology).toBe('pythagorean');
        expect(parse('numerology=nonsense').numerology).toBe('enkanitham');
        expect(parse('').numerology).toBe('enkanitham');
    });

    it('takes name numbers in range, sorted and deduplicated', () => {
        expect(parse('nameNumbers=5,7,9').nameNumbers).toEqual([5, 7, 9]);
        expect(parse('nameNumbers=9,5,5,7').nameNumbers).toEqual([5, 7, 9]);
        expect(parse('nameNumbers= 5 , 7 ').nameNumbers).toEqual([5, 7]);
    });

    it('drops name numbers no name can carry', () => {
        expect(parse('nameNumbers=0,10,-1,abc').nameNumbers).toBeUndefined();
        expect(parse('nameNumbers=').nameNumbers).toBeUndefined();
        expect(parse('').nameNumbers).toBeUndefined();
        expect(parse('nameNumbers=3,99').nameNumbers).toEqual([3]);
    });
});

describe('getBirthNumberFor', () => {
    it('reduces the day of the month in the birth timezone', () => {
        expect(getBirthNumberFor('auto', '2026-08-27T06:00', 'UTC')).toBe(9);
        expect(
            getBirthNumberFor('auto', '2026-01-16T06:00', 'Asia/Kolkata'),
        ).toBe(7);
    });

    // A day boundary is where reading the date in the wrong zone shows up.
    it('takes the day from the birth timezone, not the local one', () => {
        expect(
            getBirthNumberFor('auto', '2026-08-27T23:30', 'Asia/Kolkata'),
        ).toBe(9);
        expect(
            getBirthNumberFor('auto', '2026-08-01T00:30', 'Pacific/Kiritimati'),
        ).toBe(1);
    });

    it('gives no number without a date of birth the user chose', () => {
        expect(getBirthNumberFor('none', '2026-08-27T06:00', 'UTC')).toBeNull();
        expect(
            getBirthNumberFor('manual', '2026-08-27T06:00', 'UTC'),
        ).toBeNull();
        expect(getBirthNumberFor('auto', undefined, 'UTC')).toBeNull();
        expect(
            getBirthNumberFor('auto', '2026-08-27T06:00', undefined),
        ).toBeNull();
        expect(getBirthNumberFor('auto', 'not a date', 'UTC')).toBeNull();
        expect(
            getBirthNumberFor('auto', '2026-08-27T06:00', 'Middle/Earth'),
        ).toBeNull();
    });
});
