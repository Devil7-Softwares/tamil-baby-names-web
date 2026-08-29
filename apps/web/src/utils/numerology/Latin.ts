/**
 * Both Latin-letter systems score a name the same way and differ only in their
 * table, so the walk lives here.
 */

const TAMIL = /[஀-௿]/;

/**
 * Builds a valuer from a grouped table. It returns null when the system cannot
 * read the name.
 *
 * The catalogue stores most names in Tamil script, and transliterating one
 * first would score the English spelling's sounds rather than the name's - the
 * very thing the Enkanitham source objects to - so a Tamil-script name is left
 * unvalued instead.
 */
export const latinLetterValuer = (
    groups: ReadonlyArray<readonly [string, number]>,
) => {
    const values = new Map<string, number>();

    for (const [letters, value] of groups) {
        for (const letter of letters) {
            values.set(letter, value);
        }
    }

    return (name: string): number | null => {
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
    };
};
