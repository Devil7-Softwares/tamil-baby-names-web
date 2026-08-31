import { QueryInterface } from 'sequelize';

import { SPECIAL_NAMES, specialNote } from '../special-names.js';

/**
 * `சிறப்பு` was never a religion. The import used it for the 133 names borrowed
 * from notable people — அப்துல்கலாம், அம்பேத்கர், மேரி கியூரி — and 0008 left
 * them with no religion at all rather than invent one.
 *
 * A note column gives the classification somewhere to live once the free-text
 * religion column goes, and each row's religion is set from the tradition its
 * name comes from. The four whose tradition the catalogue does not carry — Sikh,
 * Parsi, Luo — keep a null religion and say so in the note instead of being
 * rounded into the nearest of the three.
 *
 * The names are matched by spelling rather than by id, so a database built from
 * a different import is left alone rather than half-updated.
 */
export const up = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(
        `ALTER TABLE "names" ADD COLUMN IF NOT EXISTS "notes" TEXT;`,
    );

    for (const entry of SPECIAL_NAMES) {
        await context.sequelize.query(
            `UPDATE "names" SET
                 "notes" = :note,
                 "religion_id" = (
                     SELECT "id" FROM "religions" WHERE "slug" = :religion
                 )
             WHERE "name" = :name AND "religion" = 'சிறப்பு'`,
            {
                replacements: {
                    note: specialNote(entry),
                    religion: entry.religion,
                    name: entry.name,
                },
            },
        );
    }
};

export const down = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        UPDATE "names" SET "religion_id" = NULL WHERE "religion" = 'சிறப்பு';
        ALTER TABLE "names" DROP COLUMN IF EXISTS "notes";
    `);
};
