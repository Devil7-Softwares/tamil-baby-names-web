/**
 * Tamil written in Latin letters, for ordering rather than for reading.
 *
 * The catalogue holds both spellings of the same name — அபி and Abi — and
 * Unicode sorts the whole Latin block away from the whole Tamil one, so the two
 * never meet however good the collation is. Romanising both puts them in one
 * space where they land together.
 *
 * ழ is `zh` and long vowels double, so ஆ is `aa`.
 */

const PULLI = '்';
const AYTHAM = 'ஃ';

/** Standing on their own, at the start of a name or after another vowel. */
const VOWELS: Record<string, string> = {
    அ: 'a',
    ஆ: 'aa',
    இ: 'i',
    ஈ: 'ii',
    உ: 'u',
    ஊ: 'uu',
    எ: 'e',
    ஏ: 'ee',
    ஐ: 'ai',
    ஒ: 'o',
    ஓ: 'oo',
    ஔ: 'au',
};

/** The same vowels hung on a consonant, which is how they mostly appear. */
const SIGNS: Record<string, string> = {
    'ா': 'aa',
    'ி': 'i',
    'ீ': 'ii',
    'ு': 'u',
    'ூ': 'uu',
    'ெ': 'e',
    'ே': 'ee',
    'ை': 'ai',
    'ொ': 'o',
    'ோ': 'oo',
    'ௌ': 'au',
};

/**
 * A consonant carries an `a` unless a vowel sign or a pulli says otherwise.
 * The four letters Tamil writes for one sound each — ண ந ன, ல ள, ர ற — are not
 * distinguished here, because the English spellings never distinguish them.
 */
const CONSONANTS: Record<string, string> = {
    க: 'k',
    ங: 'ng',
    ச: 's',
    ஞ: 'nj',
    ட: 't',
    ண: 'n',
    த: 'th',
    ந: 'n',
    ப: 'p',
    ம: 'm',
    ய: 'y',
    ர: 'r',
    ல: 'l',
    வ: 'v',
    ழ: 'zh',
    ள: 'l',
    ற: 'r',
    ன: 'n',
    // Grantha, for the Sanskrit and Urdu borrowings the catalogue is full of.
    ஜ: 'j',
    ஶ: 's',
    ஷ: 'sh',
    ஸ: 's',
    ஹ: 'h',
};

/**
 * Tamil writes one letter where English writes two: க is the k of Kavi and the
 * g of Ganesh, ப the p of Priya and the b of Abi. Folding the pairs onto the
 * letter Tamil actually has is what lets Abi meet அபி — without it they sit an
 * alphabet apart. `ch` goes first, so Chandra meets சந்திரா rather than becoming
 * a `kh`.
 */
const fold = (roman: string): string =>
    roman
        .replace(/ch/g, 's')
        .replace(/b/g, 'p')
        .replace(/g/g, 'k')
        .replace(/d/g, 't')
        .replace(/c/g, 'k');

/** Everything that is neither a letter nor a digit, which never orders a name. */
const NOISE = /[^a-z0-9]/g;

export const romanise = (name: string): string => {
    const letters = [...name];
    let roman = '';

    for (let index = 0; index < letters.length; index++) {
        const letter = letters[index];
        const consonant = CONSONANTS[letter];

        if (consonant) {
            const next = letters[index + 1];

            if (next === PULLI) {
                roman += consonant;
                index++;
            } else if (next && SIGNS[next]) {
                roman += consonant + SIGNS[next];
                index++;
            } else {
                roman += `${consonant}a`;
            }

            continue;
        }

        roman += VOWELS[letter] ?? (letter === AYTHAM ? 'h' : letter);
    }

    return roman;
};

/**
 * What a name orders by. Latin spellings pass through romanise unchanged and
 * are folded the same way, so both scripts end up in one space.
 */
export const sortKey = (name: string): string =>
    fold(romanise(name).toLowerCase()).replace(NOISE, '');
