import { describe, expect, it } from 'vitest';

import { IFilterData } from '../src/interfaces';
import {
    getBirthDate,
    getStartingLettersForFilter,
    getStateFromParams,
} from '../src/utils/Common';

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
});
