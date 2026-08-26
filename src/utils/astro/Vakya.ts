import { CANDRAVAKYAS } from './Candravakyas';

/** rasi, degree, arcminute, arcsecond -> degrees */
const rdms = (rasi: number, degree: number, minute: number, second = 0) =>
    rasi * 30 + degree + minute / 60 + second / 3600;

/**
 * Vakyakarana I.9-14a, in the numbering of the 1962 Kuppanna Sastri and Sarma
 * edition (English translation, pp. 253-4):
 *
 *   subtract the khanda from the ahargana, divide the remainder by 12372, 3031
 *   and 248 in turn, and the last remainder is the candravakya to look up. Each
 *   quotient contributes its own dhruva.
 */
const KHANDA = 1600984;
const EPOCH_MOON = rdms(7, 2, 0, 7);
const CYCLES = [
    { days: 12372, dhruva: rdms(9, 27, 48, 10) },
    { days: 3031, dhruva: rdms(11, 7, 31, 1) },
    { days: 248, dhruva: rdms(0, 27, 44, 6) },
];

/** The daily motion the vinadi correction is measured against. */
const REFERENCE_MOTION = rdms(0, 13, 11);

const KALI_EPOCH_JD = 588465.5;
const JD_UNIX_EPOCH = 2440587.5;

/**
 * The vakyas are for mean sunrise at the text's own meridian, which the Kali
 * day count above does not quite reproduce.
 */
const SUNRISE_OFFSET_DAYS = 12 / (24 * 60);

const norm = (degrees: number) => ((degrees % 360) + 360) % 360;

const vakya = (index: number) => CANDRAVAKYAS[index] / 60;

/** True Moon at the mean sunrise ending the given Kali ahargana. */
function trueMoonAtSunrise(ahargana: number): number {
    let rest = ahargana - KHANDA;
    const quotients = CYCLES.map((cycle) => {
        const quotient = Math.floor(rest / cycle.days);

        rest -= quotient * cycle.days;

        return quotient;
    });

    const dhruva = quotients.reduce(
        (sum, quotient, index) => sum + quotient * CYCLES[index].dhruva,
        EPOCH_MOON,
    );

    // Remainder zero is the dhruva alone, one cycle on from vakya 248, so the
    // step into it comes from the end of the previous cycle. Reduced modulo a
    // revolution either way: consecutive vakyas straddle 360 degrees twice per
    // cycle, where a raw subtraction would read as -348 rather than +12.
    const dailyMotion = norm(
        rest === 0 ? vakya(248) - vakya(247) : vakya(rest) - vakya(rest - 1),
    );

    const [, second, third] = quotients;
    const vinadis = third === 0 ? -second * 8 : third * 32 - second * 8;

    return (
        dhruva +
        vakya(rest) +
        ((dailyMotion - REFERENCE_MOTION) * vinadis) / 3600
    );
}

/**
 * The vakyas give the Moon only at sunrise, which is how the almanacs use them,
 * so a time of day is interpolated across the day it falls in.
 */
export function getLongitudeOfMoonVakkiya(date: Date): number {
    const ahargana =
        JD_UNIX_EPOCH +
        date.getTime() / 86400000 -
        KALI_EPOCH_JD -
        SUNRISE_OFFSET_DAYS;

    const day = Math.floor(ahargana);
    const start = norm(trueMoonAtSunrise(day));
    const end = norm(trueMoonAtSunrise(day + 1));

    return norm(start + norm(end - start) * (ahargana - day));
}
