import { QueryInterface } from 'sequelize';

/**
 * Where a row came from. Nothing recorded it before, so a bad import could not
 * be traced or rolled back, and there was no way to weigh one source against
 * another when two disagree.
 *
 * The catalogue as it stands is a single source: everything currently in
 * `names` and `twin_names` traces to the nithra.babyname android app.
 */
export const up = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        CREATE TABLE IF NOT EXISTS "sources" (
            "id"         SERIAL PRIMARY KEY,
            "slug"       VARCHAR(128) NOT NULL UNIQUE,
            "kind"       VARCHAR(32)  NOT NULL,
            "title"      VARCHAR(255),
            "version"    VARCHAR(64),
            -- sha256 of the artefact the rows were extracted from, so a
            -- re-scan of the same file is recognisable as the same source.
            "checksum"   CHAR(64),
            -- 0-100. Lets a hand-curated source outweigh a scraped aggregator
            -- when the two disagree about a meaning.
            "trust"      SMALLINT     NOT NULL DEFAULT 50,
            "scanned_at" TIMESTAMPTZ,
            -- Whatever the extractor knows that this table does not model:
            -- package id, store url, locale, and so on.
            "metadata"   JSONB,
            "created_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),
            "updated_at" TIMESTAMPTZ  NOT NULL DEFAULT now()
        );

        ALTER TABLE "names"
            ADD COLUMN IF NOT EXISTS "source_id" INTEGER
            REFERENCES "sources" ("id") ON DELETE SET NULL;

        ALTER TABLE "twin_names"
            ADD COLUMN IF NOT EXISTS "source_id" INTEGER
            REFERENCES "sources" ("id") ON DELETE SET NULL;

        CREATE INDEX IF NOT EXISTS "names_source_id_idx"
            ON "names" ("source_id");
        CREATE INDEX IF NOT EXISTS "twin_names_source_id_idx"
            ON "twin_names" ("source_id");
    `);

    // Idempotent: a database that already carries the row keeps its id.
    await context.sequelize.query(`
        INSERT INTO "sources" ("slug", "kind", "title", "trust")
        VALUES (
            'nithra.babyname',
            'android-app',
            'Nithra Baby Names (Tamil)',
            60
        )
        ON CONFLICT ("slug") DO NOTHING;
    `);

    await context.sequelize.query(`
        UPDATE "names" SET "source_id" = s."id"
        FROM "sources" s WHERE s."slug" = 'nithra.babyname'
          AND "names"."source_id" IS NULL;

        UPDATE "twin_names" SET "source_id" = s."id"
        FROM "sources" s WHERE s."slug" = 'nithra.babyname'
          AND "twin_names"."source_id" IS NULL;
    `);
};

export const down = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        ALTER TABLE "names"      DROP COLUMN IF EXISTS "source_id";
        ALTER TABLE "twin_names" DROP COLUMN IF EXISTS "source_id";
        DROP TABLE IF EXISTS "sources";
    `);
};
