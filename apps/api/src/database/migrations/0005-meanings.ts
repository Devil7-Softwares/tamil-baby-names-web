import { QueryInterface } from 'sequelize';

/**
 * A meaning per row rather than per name, because a name has as many meanings
 * as it has sources and the single column forced one to win silently. 701 of
 * the 10,534 distinct names already disagree with themselves across the rows
 * the import produced, and the losing text was unrecoverable.
 *
 * A subject is one `names` row or one side of a `twin_names` pair, so the
 * table carries an exclusive arc rather than a table/id pair: both sides keep
 * real referential integrity, and the check constraint keeps a row from
 * claiming to belong to both.
 *
 * Forward only. A reviewed meaning outgrows the VARCHAR(255) the old columns
 * were, so a `down` that put them back would fail on exactly the rows worth
 * keeping.
 */
export const up = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        CREATE TABLE IF NOT EXISTS "meanings" (
            "id"           SERIAL PRIMARY KEY,
            "name_id"      INTEGER REFERENCES "names" ("id") ON DELETE CASCADE,
            "twin_name_id" INTEGER REFERENCES "twin_names" ("id") ON DELETE CASCADE,
            -- Which side of a twin pair. Always 1 for a single name.
            "slot"         SMALLINT NOT NULL DEFAULT 1,
            "text"         TEXT NOT NULL,
            "source_id"    INTEGER REFERENCES "sources" ("id") ON DELETE SET NULL,
            "status"       "enum_name_status" NOT NULL DEFAULT 'candidate',
            "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
            "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT "meanings_one_subject" CHECK (
                ("name_id" IS NOT NULL AND "twin_name_id" IS NULL AND "slot" = 1)
                OR
                ("name_id" IS NULL AND "twin_name_id" IS NOT NULL AND "slot" IN (1, 2))
            )
        );
    `);

    await context.sequelize.query(`
        INSERT INTO "meanings" ("name_id", "text", "source_id", "status")
        SELECT "id", "meaning", "source_id", 'published'
        FROM "names"
        WHERE "meaning" IS NOT NULL AND "meaning" <> '';

        INSERT INTO "meanings" ("twin_name_id", "slot", "text", "source_id", "status")
        SELECT "id", 1, "meaning1", "source_id", 'published'
        FROM "twin_names"
        WHERE "meaning1" IS NOT NULL AND "meaning1" <> '';

        INSERT INTO "meanings" ("twin_name_id", "slot", "text", "source_id", "status")
        SELECT "id", 2, "meaning2", "source_id", 'published'
        FROM "twin_names"
        WHERE "meaning2" IS NOT NULL AND "meaning2" <> '';
    `);

    // Unique, so the database itself guarantees the site can never be
    // ambiguous about which of a name's meanings it shows. These are also the
    // lookup the public read path makes.
    await context.sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "meanings_published_name_idx"
            ON "meanings" ("name_id")
            WHERE "status" = 'published' AND "name_id" IS NOT NULL;

        CREATE UNIQUE INDEX IF NOT EXISTS "meanings_published_twin_idx"
            ON "meanings" ("twin_name_id", "slot")
            WHERE "status" = 'published' AND "twin_name_id" IS NOT NULL;

        CREATE INDEX IF NOT EXISTS "meanings_name_id_idx"
            ON "meanings" ("name_id");
        CREATE INDEX IF NOT EXISTS "meanings_twin_name_id_idx"
            ON "meanings" ("twin_name_id");
        CREATE INDEX IF NOT EXISTS "meanings_source_id_idx"
            ON "meanings" ("source_id");
    `);

    // Last, so everything above read the columns as they were.
    await context.sequelize.query(`
        ALTER TABLE "names"      DROP COLUMN IF EXISTS "meaning";
        ALTER TABLE "twin_names" DROP COLUMN IF EXISTS "meaning1";
        ALTER TABLE "twin_names" DROP COLUMN IF EXISTS "meaning2";
    `);
};
