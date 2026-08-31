import { QueryInterface } from 'sequelize';

/**
 * Religion and language were free text repeated on every row, and the API
 * carried a hardcoded map from the slug a request sends to the Tamil the column
 * holds. That map is a lookup table written in typescript, so this makes it one.
 *
 * The backfill matches on the label and leaves what does not match alone, which
 * is what shows the import's own confusion:
 *
 *   religion   language     rows
 *   முஸ்லிம்     முஸ்லிம்      3,060
 *   கிறிஸ்துவர்  கிறிஸ்துவர்   2,088
 *   சிறப்பு     -              133
 *
 * 5,148 rows have a religion in the language column and 133 have neither, so
 * only the 6,135 Hindu rows ever recorded a language at all. Those rows get a
 * null rather than an invented answer: "the import never said" is a different
 * fact from "Tamil", and a lookup table that held முஸ்லிம் as a language would
 * make the confusion permanent.
 *
 * The text columns stay. They are what the public site still reads, and what a
 * later pass will need to decide the 133 சிறப்பு rows against.
 */
export const up = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        CREATE TABLE IF NOT EXISTS "religions" (
            "id"         SERIAL PRIMARY KEY,
            "slug"       VARCHAR(64)  NOT NULL UNIQUE,
            "name"       VARCHAR(255) NOT NULL UNIQUE,
            "created_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),
            "updated_at" TIMESTAMPTZ  NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS "languages" (
            "id"         SERIAL PRIMARY KEY,
            "slug"       VARCHAR(64)  NOT NULL UNIQUE,
            "name"       VARCHAR(255) NOT NULL UNIQUE,
            "created_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),
            "updated_at" TIMESTAMPTZ  NOT NULL DEFAULT now()
        );

        ALTER TABLE "names"
            ADD COLUMN IF NOT EXISTS "religion_id" INTEGER
            REFERENCES "religions" ("id") ON DELETE SET NULL;

        ALTER TABLE "names"
            ADD COLUMN IF NOT EXISTS "language_id" INTEGER
            REFERENCES "languages" ("id") ON DELETE SET NULL;

        ALTER TABLE "twin_names"
            ADD COLUMN IF NOT EXISTS "language_id" INTEGER
            REFERENCES "languages" ("id") ON DELETE SET NULL;

        CREATE INDEX IF NOT EXISTS "names_religion_id_idx"
            ON "names" ("religion_id");
        CREATE INDEX IF NOT EXISTS "names_language_id_idx"
            ON "names" ("language_id");
        CREATE INDEX IF NOT EXISTS "twin_names_language_id_idx"
            ON "twin_names" ("language_id");
    `);

    // The slugs are the ones the public filters already send.
    await context.sequelize.query(`
        INSERT INTO "religions" ("slug", "name") VALUES
            ('hindu', 'இந்து'),
            ('muslim', 'முஸ்லிம்'),
            ('christian', 'கிறிஸ்துவர்')
        ON CONFLICT ("slug") DO NOTHING;

        INSERT INTO "languages" ("slug", "name") VALUES
            ('tamil', 'தமிழ்'),
            ('sanskrit', 'சமஸ்கிருதம்'),
            ('english', 'ஆங்கிலம்')
        ON CONFLICT ("slug") DO NOTHING;
    `);

    await context.sequelize.query(`
        UPDATE "names" SET "religion_id" = r."id"
        FROM "religions" r
        WHERE r."name" = "names"."religion" AND "names"."religion_id" IS NULL;

        UPDATE "names" SET "language_id" = l."id"
        FROM "languages" l
        WHERE l."name" = "names"."language" AND "names"."language_id" IS NULL;

        UPDATE "twin_names" SET "language_id" = l."id"
        FROM "languages" l
        WHERE l."name" = "twin_names"."language"
          AND "twin_names"."language_id" IS NULL;
    `);
};

export const down = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        ALTER TABLE "names"      DROP COLUMN IF EXISTS "religion_id";
        ALTER TABLE "names"      DROP COLUMN IF EXISTS "language_id";
        ALTER TABLE "twin_names" DROP COLUMN IF EXISTS "language_id";
        DROP TABLE IF EXISTS "religions";
        DROP TABLE IF EXISTS "languages";
    `);
};
