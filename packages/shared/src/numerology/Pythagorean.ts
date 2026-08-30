import { latinLetterValuer } from './Latin.js';

/**
 * The Western system, which tamildailycalendar.com carries beside the Chaldean
 * one as its "Standard Numerology System".
 *
 * Unlike Chaldean it is positional - each letter is worth its place in the
 * alphabet reduced to 1-9 - so every digit including 9 is a letter value. The
 * table is written out as the source prints it; a test checks it against the
 * alphabet.
 */
export const getNameNumberPythagorean = latinLetterValuer([
    ['AJS', 1],
    ['BKT', 2],
    ['CLU', 3],
    ['DMV', 4],
    ['ENW', 5],
    ['FOX', 6],
    ['GPY', 7],
    ['HQZ', 8],
    ['IR', 9],
]);
