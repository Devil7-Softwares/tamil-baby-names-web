import { QueryInterface } from 'sequelize';

/**
 * The unit a reviewer decides about. The import filed a name once per reading
 * it found, so 1,710 rows in 828 groups hold a name the catalogue already has,
 * and settling them row by row asks for the same judgment two, three or four
 * times over. A cluster gathers those rows so their readings pool into one
 * decision.
 *
 * Keyed on name *and* gender rather than name alone. 121 of the duplicate
 * groups span both genders and every one of them disagrees about the meaning:
 * Abi reads தெய்வ ஆலொசனை பெற்றவர் for a boy and தந்தையின் அன்புக்குரியவள் for a girl.
 * They are different names wearing one spelling, and pooling them would ask a
 * reviewer to publish one reading over a distinction the language is making.
 *
 * `sort_key` is what the catalogue orders by, so ordering can move off the
 * member rows onto the cluster. It backfills to the name, and is the seam for
 * the transliterated key that will one day let Abi and அபி sort next to each
 * other instead of in separate script blocks.
 *
 * Twin pairs are left alone: a pair is a different subject, and nothing has
 * shown the 487 of them to duplicate.
 */
export const up = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        CREATE TABLE IF NOT EXISTS "clusters" (
            "id"         SERIAL PRIMARY KEY,
            "name"       VARCHAR(255) NOT NULL,
            "gender"     VARCHAR(255) NOT NULL,
            "sort_key"   TEXT         NOT NULL,
            "created_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),
            "updated_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),
            CONSTRAINT "clusters_name_gender_key" UNIQUE ("name", "gender")
        );

        ALTER TABLE "names"
            ADD COLUMN IF NOT EXISTS "cluster_id" INTEGER
            REFERENCES "clusters" ("id") ON DELETE SET NULL;

        CREATE INDEX IF NOT EXISTS "names_cluster_id_idx"
            ON "names" ("cluster_id");
        CREATE INDEX IF NOT EXISTS "clusters_sort_key_idx"
            ON "clusters" ("sort_key");
    `);

    // Idempotent, so a database that has already been through this keeps the
    // cluster ids its rows point at.
    await context.sequelize.query(`
        INSERT INTO "clusters" ("name", "gender", "sort_key")
        SELECT "name", "gender", "name"
        FROM "names"
        GROUP BY "name", "gender"
        ON CONFLICT ("name", "gender") DO NOTHING;

        UPDATE "names" SET "cluster_id" = c."id"
        FROM "clusters" c
        WHERE c."name" = "names"."name"
          AND c."gender" = "names"."gender"
          AND "names"."cluster_id" IS NULL;
    `);
};

export const down = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        ALTER TABLE "names" DROP COLUMN IF EXISTS "cluster_id";
        DROP TABLE IF EXISTS "clusters";
    `);
};
