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

const LETTER_VALUES: ReadonlyArray<readonly [string, number]> = [
    ['AIJQY', 1],
    ['BKR', 2],
    ['CGLS', 3],
    ['DMT', 4],
    ['EHNX', 5],
    ['UVW', 6],
    ['OZ', 7],
    ['FP', 8],
];

const values = new Map<string, number>();

for (const [letters, value] of LETTER_VALUES) {
    for (const letter of letters) {
        values.set(letter, value);
    }
}

const TAMIL = /[஀-௿]/;

/**
 * The name's total letter value, or null when this system cannot read it.
 *
 * Chaldean scores Latin letters, and the catalogue stores most names in Tamil
 * script. Transliterating them first would score the English spelling's sounds
 * rather than the name's - the very thing the Enkanitham source objects to - so
 * a Tamil-script name is left unvalued instead. The two methods cover
 * complementary halves of the catalogue.
 */
export function getNameNumberChaldean(name: string): number | null {
    if (TAMIL.test(name)) {
        return null;
    }

    let total = 0;
    let scored = false;

    for (const char of name.toUpperCase()) {
        const value = values.get(char);

        if (value !== undefined) {
            total += value;
            scored = true;
        }
    }

    return scored ? total : null;
}
