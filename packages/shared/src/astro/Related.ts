/** Each short vowel sign and its long partner, both ways. */
const SIGN_PAIRS: Record<string, string> = {
    'ி': 'ீ',
    'ீ': 'ி',
    'ு': 'ூ',
    'ூ': 'ு',
    'ெ': 'ே',
    'ே': 'ெ',
    'ொ': 'ோ',
    'ோ': 'ொ',
};

const VOWEL_PAIRS: Record<string, string> = {
    அ: 'ஆ',
    ஆ: 'அ',
    இ: 'ஈ',
    ஈ: 'இ',
    உ: 'ஊ',
    ஊ: 'உ',
    எ: 'ஏ',
    ஏ: 'எ',
    ஒ: 'ஓ',
    ஓ: 'ஒ',
};

const AA = 'ா';

const isConsonant = (char: string) => char >= 'க' && char <= 'ஹ';

/**
 * The same letter with its vowel's length flipped — யூ for யு, பீ for பி. A
 * bare consonant carries a short அ, so க and கா are a pair too. ஐ and ஔ
 * have no partner, and neither does a Latin spelling.
 */
const partnerOf = (letter: string): string | null => {
    if (VOWEL_PAIRS[letter]) {
        return VOWEL_PAIRS[letter];
    }

    const last = letter.slice(-1);
    const stem = letter.slice(0, -1);

    if (SIGN_PAIRS[last]) {
        return stem + SIGN_PAIRS[last];
    }

    if (last === AA) {
        return stem;
    }

    return isConsonant(last) ? letter + AA : null;
};

/**
 * The partners of the given letters that are not among them already, in the
 * order their letters came.
 */
export const getRelatedLetters = (letters: readonly string[]): string[] => {
    const given = new Set(letters);
    const related = new Set<string>();

    for (const letter of letters) {
        const partner = partnerOf(letter);

        if (partner && !given.has(partner)) {
            related.add(partner);
        }
    }

    return [...related];
};
