/**
 * Diameter to radius
 */
export const d2r = Math.PI / 180;

/**
 * Convert date to julian date
 *
 * @param day Day of month
 * @param month Month of year
 * @param year Year
 * @returns Julian date
 */
export function toJulianDate(day: number, month: number, year: number): number {
    const im = 12 * (year + 4800) + month - 3;
    const j = Math.floor((2 * (im - Math.floor(im / 12) * 12) + 7 + 365 * im) / 12) + day + Math.floor(im / 48) - 32083;
    return j + (j > 2299171 ? Math.floor(im / 4800) - Math.floor(im / 1200) + 38 : 0);
}

/**
 * Calculate Ayanamsa using J2000 Epoch
 *
 * @param epoch J2000 epoch
 * @returns Ayanamsa
 */
export function calculateAyanamsa(epoch: number): number {
    const ln = 125.044555 - 1934.1361849 * epoch + 0.0020762 * epoch * epoch;
    let off = 280.466449 + 36000.7698231 * epoch + 0.0003106 * epoch * epoch;
    off = 17.23 * Math.sin(d2r * ln) + 1.27 * Math.sin(d2r * off) - (5025.64 + 1.11 * epoch) * epoch;
    off = (off - 80861.27) / 3600.0;
    return off;
}

/**
 * Calculate zodiac from longitude
 *
 * @param lon Longitude
 * @returns Zodiac Index
 */
export function longitudeToZodiac(lon: number): number {
    return Math.floor(Math.floor(Math.abs(lon)) / 30);
}
