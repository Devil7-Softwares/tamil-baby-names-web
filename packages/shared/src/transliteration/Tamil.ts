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

/**
 * The syllable a name begins with, which is what `names.first_letter` holds and
 * what the nakshatra letter tables are written in: கா rather than க, and ஸ்ரீ
 * rather than ஸ். A vowel sign belongs to the consonant it hangs on, and a
 * pulli binds the consonant after it into the same syllable, so a conjunct
 * stays whole.
 *
 * A name already in Latin letters gets its first character, which is all that
 * can honestly be said about it.
 */
export const firstSyllable = (name: string): string => {
    const letters = [...name];
    let end = 1;

    while (end < letters.length) {
        if (SIGNS[letters[end]]) {
            end++;
            break;
        }

        if (letters[end] !== PULLI) {
            break;
        }

        end += 2;
    }

    return letters.slice(0, end).join('');
};

/**
 * A Tamil spelling for a name written in Latin letters — a suggestion, never an
 * answer.
 *
 * `romanise` throws information away on purpose: ண, ந and ன all become `n`, ல
 * and ள both `l`, ர and ற both `r`, and every voiced consonant folds onto its
 * unvoiced Tamil letter. Coming back the other way cannot put that information
 * back, so this picks the commonest letter of each set and says so. `Aravind`
 * returns அரவிந்த், which is right; `Arun` returns அருன் where a Tamil writer
 * puts அருண்.
 *
 * Which is why nothing here scores a name by itself. The numerology methods
 * read one script each and refuse the other, precisely so that a Chaldean
 * number is never computed from a guess — what this produces has to be put in
 * front of somebody who knows the name, and corrected, before it counts.
 */

/**
 * Longest first, so `th` is never read as `t` then `h`.
 *
 * The nasal pairs earn their place: Tamil assimilates a nasal to whatever
 * follows it and writes the result, so `nk` is ங்க and never ன்க, `nj` is ஞ்ச,
 * and `mb` is ம்ப. English spellings keep writing `n`, which is why Anganan
 * came back as அஙனன் instead of அங்கணன் until these were added. `nth` is the
 * dental cluster ந்த and bare `nd` the retroflex ண்ட — Achuthananthan against
 * Andiran, and the two are not interchangeable.
 *
 * A vowel sign lands on the last consonant of whatever is emitted, so a
 * two-letter value needs no special handling — but it must end in one, which
 * is why `ng` is ங்க and not a bare ங்: Thango came back as தங்ொ, the sign
 * hanging off a pulli with nothing to attach to.
 */
const CLUSTERS: ReadonlyArray<readonly [string, string]> = [
    ['nch', 'ஞ்ச'],
    ['ndh', 'ந்த'],
    ['nth', 'ந்த'],
    ['nk', 'ங்க'],
    ['ng', 'ங்க'],
    ['nn', 'ண்ண'],
    ['nj', 'ஞ்ச'],
    ['nd', 'ந்த'],
    ['nt', 'ந்த'],
    ['mb', 'ம்ப'],
    ['mp', 'ம்ப'],
    ['zh', 'ழ'],
    ['ch', 'ச'],
    ['sh', 'ஷ'],
    ['th', 'த'],
    ['dh', 'த'],
    ['ph', 'ப'],
    ['bh', 'ப'],
    ['kh', 'க'],
    ['gh', 'க'],
    ['jh', 'ஜ'],
    ['f', 'ஃப'],
    ['z', 'ஜ'],
    ['k', 'க'],
    ['g', 'க'],
    ['c', 'க'],
    ['s', 'ச'],
    ['j', 'ஜ'],
    ['t', 'த'],
    ['d', 'த'],
    ['n', 'ன'],
    ['p', 'ப'],
    ['b', 'ப'],
    ['m', 'ம'],
    ['y', 'ய'],
    ['r', 'ர'],
    ['l', 'ல'],
    ['v', 'வ'],
    ['w', 'வ'],
    ['h', 'ஹ'],
];

/** Also longest first: `aa` before `a`, `ai` before `a`. */
const READ_VOWELS: ReadonlyArray<readonly [string, string, string]> = [
    ['aa', 'ஆ', 'ா'],
    ['ai', 'ஐ', 'ை'],
    ['au', 'ஔ', 'ௌ'],
    // `ee` and `oo` are the long close vowels in an English spelling of a Tamil
    // name — Azeem is அஜீம், Poongodi பூங்கொடி — even though `romanise` writes
    // ஏ as `ee` going the other way. This reads what people type, not what that
    // function emits.
    ['ee', 'ஈ', 'ீ'],
    ['ii', 'ஈ', 'ீ'],
    ['oo', 'ஊ', 'ூ'],
    ['uu', 'ஊ', 'ூ'],
    ['ae', 'ஏ', 'ே'],
    ['a', 'அ', ''],
    ['e', 'எ', 'ெ'],
    ['i', 'இ', 'ி'],
    ['o', 'ஒ', 'ொ'],
    ['u', 'உ', 'ு'],
];

/**
 * Tamil does not begin a word with ன, ண, ர, ல or ழ, whatever the English
 * spelling suggests: Nila is நில and never னில. Only the nasal is worth
 * correcting here — it is the one an English `n` lands on most often.
 */
const OPENS: Record<string, string> = { ன: 'ந' };

/**
 * A name ending in one of these ends in the long vowel far more often than the
 * short one - Farida is ஃபரிதா, Thango தங்கோ - and for `a` the inherent vowel a
 * bare consonant already carries would write the short one by saying nothing at
 * all. `i` is deliberately absent: Ravi is ரவி.
 */
const LONG: Record<string, string> = { a: 'ா', o: 'ோ' };

const at = <T extends readonly [string, ...string[]]>(
    table: readonly T[],
    text: string,
    index: number,
): T | undefined => table.find(([key]) => text.startsWith(key, index));

export const tamilise = (name: string): string => {
    const latin = name.toLowerCase();
    let tamil = '';
    let index = 0;

    while (index < latin.length) {
        const consonant = at(CLUSTERS, latin, index);

        if (consonant) {
            const [read, spelt] = consonant;
            const opening = !tamil || tamil.endsWith(' ');
            const letter = (opening && OPENS[spelt]) || spelt;
            index += read.length;

            const vowel = at(READ_VOWELS, latin, index);

            if (!vowel) {
                // No vowel of its own, so the consonant is bare. Tamil marks
                // that rather than leaving the inherent `a` to be read.
                tamil += letter + PULLI;
                continue;
            }

            const [sound, , sign] = vowel;
            const ends =
                index + sound.length >= latin.length ||
                latin[index + sound.length] === ' ';

            // A name ending in `a` ends in the long vowel far more often than
            // the short one - Farida is ஃபரிதா, Fatima ஃபாத்திமா - and the
            // inherent `a` a bare consonant already carries would write the
            // short one by saying nothing at all.
            tamil += letter + (ends ? (LONG[sound] ?? sign) : sign);
            index += sound.length;

            continue;
        }

        const vowel = at(READ_VOWELS, latin, index);

        if (vowel) {
            const [sound, standing] = vowel;
            tamil += standing;
            index += sound.length;

            continue;
        }

        // A space, a hyphen, anything else: kept, so a two-part name stays two
        // parts rather than being silently joined.
        tamil += latin[index];
        index++;
    }

    return tamil.normalize('NFC');
};
