import { QueryInterface } from 'sequelize';

/**
 * Takes the religion back out of the language column.
 *
 * `nithra.babyname` filed its Muslim and Christian names with the religion in
 * both columns — 3,060 முஸ்லிம் and 2,088 கிறிஸ்துவர் rows. 0008 gave those
 * rows no `language_id`, because "the import never said" is a different fact
 * from any language, but it kept the text column for the public site to read.
 * The site still read it, and listed முஸ்லிம் as a name's language.
 *
 * Cleared to null to match 0008, not filled from the other rows of the same
 * name: most of those say English, which for a Muslim or Christian name more
 * likely meant "has an English gloss" than where the name comes from. The
 * public list gathers a name's rows, so a real language on any of them still
 * shows.
 *
 * Their religion column is right and is left alone.
 */
export const up = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        UPDATE "names" SET "language" = NULL
        WHERE "language_id" IS NULL
          AND "language" IN (SELECT "name" FROM "religions");
    `);
};

/**
 * Nothing to undo. Once cleared these rows look like the 624 other nithra
 * rows that already had a religion and no language, and putting the religion
 * back into all of them would write the mistake into rows that never had it.
 */
export const down = async (): Promise<void> => undefined;
