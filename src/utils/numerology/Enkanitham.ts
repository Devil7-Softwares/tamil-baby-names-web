/**
 * Source: தமிழ் எண் கணித சோதிடம், Tamil Wikipedia, "தமிழ் எண்கணித முறை".
 *
 * Values are per *sound*, not per character, so a name is scored the way the
 * source decomposes its own example:
 *
 *   முத்துக்கமலம் = ம்+உ+த்+த்+உ+க்+க்+அ+ம்+அ+ல்+அ+ம் = 53 = 8
 *
 * which is Tamil's Unicode structure - a consonant carries the inherent அ
 * unless a vowel sign replaces it or a pulli removes it.
 */

const SOUND_VALUES: ReadonlyArray<readonly [string, number]> = [
    ['அஆஇஈஉஊ', 3],
    ['எஏஒஓ', 7],
    ['ஐ', 5],
    ['கரஙஹஃ', 1],
    ['சஞயஸஷஜ', 7],
    ['டணள', 4],
    ['தழந', 8],
    ['பவம', 6],
    ['றலன', 2],
];

const values = new Map<string, number>();

for (const [letters, value] of SOUND_VALUES) {
    for (const letter of letters) {
        values.set(letter, value);
    }
}

// Absent from the source table. It is grouped by place of articulation and
// every other sibilant there scores 7, so ஶ joins them.
values.set('ஶ', 7);

const PULLI = '்';

const VOWEL_SIGNS: Readonly<Record<string, string>> = {
    'ா': 'ஆ',
    'ி': 'இ',
    'ீ': 'ஈ',
    'ு': 'உ',
    'ூ': 'ஊ',
    'ெ': 'எ',
    'ே': 'ஏ',
    'ை': 'ஐ',
    'ொ': 'ஒ',
    'ோ': 'ஓ',
};

// ஔ has no value of its own; the source directs it be written அவ் (3 + 6).
const AU = 'ௌ';
const AU_VALUE = 9;

const INHERENT_VOWEL = 'அ';

const CONSONANTS = 'கஙசஞடணதநபமயரலவழளறனஜஷஸஹஶ';

// The source lists the borrowed 'f' as one sound worth 6, not ஃ(1) + ப(6).
const FA = 'ஃப';
const FA_VALUE = 6;

export function getNameNumberEnkanitham(name: string): number | null {
    // Scoring a transliteration scores the English spelling's sounds rather
    // than the name's, so those names are left unvalued instead.
    if (/[a-z]/i.test(name)) {
        return null;
    }

    let total = 0;
    let index = 0;
    let scored = false;

    while (index < name.length) {
        const char = name[index];

        const isFa = name.startsWith(FA, index);
        const consonant = isFa
            ? FA_VALUE
            : CONSONANTS.includes(char)
              ? values.get(char)
              : undefined;

        if (consonant === undefined) {
            if (values.has(char)) {
                total += values.get(char) as number;
                scored = true;
            }

            index += 1;
            continue;
        }

        total += consonant;
        scored = true;
        index += isFa ? FA.length : 1;

        const next = name[index];

        if (next === PULLI) {
            index += 1;
        } else if (next === AU) {
            total += AU_VALUE;
            index += 1;
        } else if (next !== undefined && next in VOWEL_SIGNS) {
            total += values.get(VOWEL_SIGNS[next]) as number;
            index += 1;
        } else {
            total += values.get(INHERENT_VOWEL) as number;
        }
    }

    return scored ? total : null;
}
