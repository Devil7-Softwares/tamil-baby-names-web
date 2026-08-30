import { QueryInterface } from 'sequelize';

/**
 * Lets a row exist without being served. Everything the pipeline proposes lands
 * as `candidate` and waits for a reviewer; nothing it decides ever destroys a
 * row, so a bad model run is reversible with an UPDATE.
 *
 * Existing rows are published — they are what the site already serves — but the
 * column default is `candidate`, so anything imported from here on has to be
 * looked at before it appears.
 */
export const up = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        DO $$ BEGIN
            CREATE TYPE "enum_name_status"
                AS ENUM ('published', 'candidate', 'rejected');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;

        ALTER TABLE "names"
            ADD COLUMN IF NOT EXISTS "status" "enum_name_status"
            NOT NULL DEFAULT 'published';

        ALTER TABLE "twin_names"
            ADD COLUMN IF NOT EXISTS "status" "enum_name_status"
            NOT NULL DEFAULT 'published';
    `);

    // Only now, so the statements above published what was already there.
    await context.sequelize.query(`
        ALTER TABLE "names"      ALTER COLUMN "status" SET DEFAULT 'candidate';
        ALTER TABLE "twin_names" ALTER COLUMN "status" SET DEFAULT 'candidate';
    `);

    // Partial, because the public queries only ever read one status and the
    // other two are expected to outgrow it once the pipeline is running.
    await context.sequelize.query(`
        CREATE INDEX IF NOT EXISTS "names_published_idx"
            ON "names" ("gender", "religion") WHERE "status" = 'published';

        CREATE INDEX IF NOT EXISTS "twin_names_published_idx"
            ON "twin_names" ("gender") WHERE "status" = 'published';
    `);
};

export const down = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        DROP INDEX IF EXISTS "names_published_idx";
        DROP INDEX IF EXISTS "twin_names_published_idx";
        ALTER TABLE "names"      DROP COLUMN IF EXISTS "status";
        ALTER TABLE "twin_names" DROP COLUMN IF EXISTS "status";
        DROP TYPE IF EXISTS "enum_name_status";
    `);
};
