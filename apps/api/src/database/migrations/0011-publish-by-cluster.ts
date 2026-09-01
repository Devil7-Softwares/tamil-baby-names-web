import { QueryInterface } from 'sequelize';

/**
 * The site shows one reading per name, but a reviewer decides per cluster, and
 * the two disagreed: 725 clusters hold more than one published reading because
 * the import filed the same spelling once per source and published all of them.
 * 130 of those agree word for word and 595 do not, so what the site shows for
 * a name depends on which of its rows a query happened to reach.
 *
 * `meanings.cluster_id` is denormalised from `names` so a partial unique index
 * has a column to sit on — a unique index cannot span a join — and two triggers
 * keep it in step in both directions, so it can never drift from the name's.
 *
 * The sweep keeps the lowest id in each cluster, which is what the import filed
 * first, and sends the rest back to the pool as candidates. Not rejected: no
 * one has read them, and a cluster that disagrees with itself is queue work,
 * not a settled question. Every demotion is written to the ledger with a null
 * actor, which reads as the pipeline's doing rather than a reviewer's.
 */
export const up = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        ALTER TABLE "meanings"
            ADD COLUMN IF NOT EXISTS "cluster_id" INTEGER
            REFERENCES "clusters" ("id") ON DELETE SET NULL;

        UPDATE "meanings" SET "cluster_id" = n."cluster_id"
        FROM "names" n
        WHERE n."id" = "meanings"."name_id";
    `);

    await context.sequelize.query(`
        CREATE OR REPLACE FUNCTION "meanings_cluster_id"() RETURNS trigger AS $$
        BEGIN
            NEW."cluster_id" := (
                SELECT "cluster_id" FROM "names" WHERE "id" = NEW."name_id"
            );
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS "meanings_cluster_id" ON "meanings";
        CREATE TRIGGER "meanings_cluster_id"
            BEFORE INSERT OR UPDATE OF "name_id" ON "meanings"
            FOR EACH ROW EXECUTE FUNCTION "meanings_cluster_id"();

        CREATE OR REPLACE FUNCTION "names_cluster_id_to_meanings"()
        RETURNS trigger AS $$
        BEGIN
            UPDATE "meanings" SET "cluster_id" = NEW."cluster_id"
            WHERE "name_id" = NEW."id";
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS "names_cluster_id" ON "names";
        CREATE TRIGGER "names_cluster_id"
            AFTER UPDATE OF "cluster_id" ON "names"
            FOR EACH ROW WHEN (OLD."cluster_id" IS DISTINCT FROM NEW."cluster_id")
            EXECUTE FUNCTION "names_cluster_id_to_meanings"();
    `);

    // One statement, so a demotion and its ledger row cannot land apart.
    await context.sequelize.query(`
        WITH ranked AS (
            SELECT "id", row_number() OVER (
                PARTITION BY "cluster_id" ORDER BY "id"
            ) AS "rank"
            FROM "meanings"
            WHERE "status" = 'published' AND "cluster_id" IS NOT NULL
        ), demoted AS (
            UPDATE "meanings" SET "status" = 'candidate', "updated_at" = now()
            WHERE "id" IN (SELECT "id" FROM ranked WHERE "rank" > 1)
            RETURNING "id"
        )
        INSERT INTO "verifications"
            ("meaning_id", "from_status", "to_status", "reason", "actor_id")
        SELECT "id", 'published', 'candidate', 'displacement', NULL FROM demoted;
    `);

    await context.sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "meanings_published_cluster_idx"
            ON "meanings" ("cluster_id")
            WHERE "status" = 'published' AND "cluster_id" IS NOT NULL;

        CREATE INDEX IF NOT EXISTS "meanings_cluster_id_idx"
            ON "meanings" ("cluster_id");
    `);
};

/**
 * The sweep is undone from the ledger it wrote rather than by guesswork: a
 * displacement with no actor is this migration's, and a reviewer's always
 * carries one. Readings a reviewer has since decided about keep that decision —
 * only names left with nothing published are put back.
 */
export const down = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        DROP INDEX IF EXISTS "meanings_published_cluster_idx";
        DROP INDEX IF EXISTS "meanings_cluster_id_idx";

        DROP TRIGGER IF EXISTS "meanings_cluster_id" ON "meanings";
        DROP TRIGGER IF EXISTS "names_cluster_id" ON "names";
        DROP FUNCTION IF EXISTS "meanings_cluster_id"();
        DROP FUNCTION IF EXISTS "names_cluster_id_to_meanings"();
    `);

    await context.sequelize.query(`
        WITH swept AS (
            SELECT v."id" AS "verification_id", m."id"
            FROM "verifications" v
            JOIN "meanings" m ON m."id" = v."meaning_id"
            WHERE v."reason" = 'displacement'
              AND v."actor_id" IS NULL
              AND m."status" = 'candidate'
              AND NOT EXISTS (
                  SELECT 1 FROM "meanings" p
                  WHERE p."name_id" = m."name_id" AND p."status" = 'published'
              )
        ), restored AS (
            UPDATE "meanings" SET "status" = 'published', "updated_at" = now()
            WHERE "id" IN (SELECT "id" FROM swept)
            RETURNING "id"
        )
        DELETE FROM "verifications"
        WHERE "id" IN (SELECT "verification_id" FROM swept);
    `);

    await context.sequelize.query(`
        ALTER TABLE "meanings" DROP COLUMN IF EXISTS "cluster_id";
    `);
};
