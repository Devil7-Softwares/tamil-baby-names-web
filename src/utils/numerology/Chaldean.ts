import { latinLetterValuer } from './Latin';

/**
 * Chaldean values, the system Tamil Nadu numerology applies to a name's English
 * spelling. Published identically by தமிழ் எண் கணித சோதிடம், Tamil Wikipedia
 * ("ஆங்கில எழுத்துக்களுக்கான எண்கள்") and by tamildailycalendar.com, which calls
 * it Indian Numerology.
 *
 *   MUTHUKAMALAM = 4+6+4+5+6+2+1+4+1+3+1+4 = 41 = 5
 *
 * No letter is worth 9, which the tradition holds apart; a total still reduces
 * to it.
 */
export const getNameNumberChaldean = latinLetterValuer([
    ['AIJQY', 1],
    ['BKR', 2],
    ['CGLS', 3],
    ['DMT', 4],
    ['EHNX', 5],
    ['UVW', 6],
    ['OZ', 7],
    ['FP', 8],
]);
