import { locales } from './Locales';
import {
    calculateAyanamsa,
    d2r,
    longitudeToZodiac,
    toJulianDate,
} from './Utils';

export function getLongitudeOfMoon(date: Date): number {
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    const hour = date.getHours() + date.getMinutes() / 60;

    const timezoneOffset = date.getTimezoneOffset() / 60;

    const julianDate = toJulianDate(day, month, year);

    const t =
        (julianDate -
            /* Year 2000 in Julian */ 2451545 +
            /* Adjust hours for UTC */ (hour + timezoneOffset) / 24 -
            0.5) /
        36525;

    const ayanamsa = calculateAyanamsa(t);

    // Calculate Moon longitude, latitude, and distance using truncated Chapront algorithm

    // Mean longitude, referred to the mean equinox of the date
    let longitude = 218.3164591 + 481267.88134236 * t;

    // Mean elongation of the moon
    const d = (297.8502042 + 445267.1115168 * t) * d2r;

    // Sun's mean anomaly
    const m = (357.5291092 + 35999.0502909 * t) * d2r;

    // Moon's mean anomaly
    const mm = (134.9634114 + 477198.8676313 * t) * d2r;

    // Moon's argument of latitude
    const f = (93.2720993 + 483202.0175273 * t) * d2r;

    const e = 1 - 0.002516 * t - 0.0000074 * t * t;

    const p =
        6.288774 * Math.sin(mm) +
        1.274027 * Math.sin(d * 2 - mm) +
        0.658314 * Math.sin(d * 2) +
        0.213618 * Math.sin(2 * mm) -
        0.185116 * e * Math.sin(m) -
        0.114332 * Math.sin(f * 2) +
        (0.058793 * Math.sin(d * 2 - mm * 2) +
            0.057066 * e * Math.sin(d * 2 - m - mm) +
            0.053322 * Math.sin(d * 2 + mm) +
            0.045758 * e * Math.sin(d * 2 - m) -
            0.040923 * e * Math.sin(m - mm) -
            0.03472 * Math.sin(d) -
            0.030383 * e * Math.sin(m + mm)) +
        (0.015327 * Math.sin(d * 2 - f * 2) -
            0.012528 * Math.sin(mm + f * 2) +
            0.01098 * Math.sin(mm - f * 2) +
            0.010675 * Math.sin(d * 4 - mm) +
            0.010034 * Math.sin(3 * mm)) +
        (0.008548 * Math.sin(d * 4 - mm * 2) -
            0.007888 * e * Math.sin(d * 2 + m - mm) -
            0.006766 * e * Math.sin(d * 2 + m) -
            0.005163 * Math.sin(d - mm) +
            0.004987 * e * Math.sin(d + m) +
            0.004036 * e * Math.sin(d * 2 - m + mm) +
            0.003994 * Math.sin(d * 2 + mm * 2));

    longitude += p;

    // Keep within 360 degrees
    while (longitude < 0.0) {
        longitude += 360.0;
    }
    while (longitude > 360.0) {
        longitude -= 360.0;
    }

    longitude += ayanamsa;

    if (longitude < 0.0) longitude += 360.0;

    return longitude;
}

export function getMoonSignIndex(date: Date) {
    return longitudeToZodiac(getLongitudeOfMoon(date));
}

export function getLunarMansionIndex(date: Date) {
    return Math.floor((getLongitudeOfMoon(date) * 60) / 800.0);
}

export function getMoonSign(
    index: number,
    locale: keyof typeof locales
): string;
export function getMoonSign(date: Date, locale: keyof typeof locales): string;
export function getMoonSign(
    dateOrIndex: Date | number,
    locale: keyof typeof locales
): string {
    return locales[locale].moonSigns[
        dateOrIndex instanceof Date
            ? getMoonSignIndex(dateOrIndex)
            : dateOrIndex
    ];
}

export function getLunarMansion(
    index: number,
    locale: keyof typeof locales
): string;
export function getLunarMansion(
    date: Date,
    locale: keyof typeof locales
): string;
export function getLunarMansion(
    dateOrIndex: Date | number,
    locale: keyof typeof locales
): string {
    return locales[locale].lunarMansions[
        dateOrIndex instanceof Date
            ? getLunarMansionIndex(dateOrIndex)
            : dateOrIndex
    ];
}

export function getStartingLettersForName(
    index: number,
    locale: keyof typeof locales
): string[];
export function getStartingLettersForName(
    date: Date,
    locale: keyof typeof locales
): string[];
export function getStartingLettersForName(
    dateOrIndex: Date | number,
    locale: keyof typeof locales
): string[] {
    return locales[locale].namingLettersByLunarMansions[
        dateOrIndex instanceof Date
            ? getLunarMansionIndex(dateOrIndex)
            : dateOrIndex
    ];
}
