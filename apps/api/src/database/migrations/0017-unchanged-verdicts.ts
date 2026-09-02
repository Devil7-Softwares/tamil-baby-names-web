import { QueryInterface } from 'sequelize';

/**
 * Telling "not sure" apart from "sure, and nothing to do".
 *
 * `abstained` has been carrying both since 0014, and they are opposite things.
 * A model below the confidence bar is where a person is worth the most; a model
 * that looked, was certain, and found the catalogue already right is the
 * cheapest possible outcome and needs nobody. Lumping them made the queue's
 * "An agent was unsure" filter lie: over 25 clusters `gpt-5.6-terra` read as
 * unsure six times while its lowest answer of the whole run was 58.
 *
 * `unchanged` is the second of the two. Like `abstained` and `considered` it
 * carries `from_status = to_status`, because nothing moved.
 *
 * The backfill re-reads the existing rows against `CONFIDENT_ENOUGH`, which is
 * the same 55 the reviewer applied when it wrote them — so this relabels what
 * was already recorded rather than deciding anything new. `review_runs` gets
 * the split too, counted from the rows themselves.
 *
 * Each statement is its own transaction here, which is what lets the backfill
 * use an enum value added moments earlier. Umzug wraps nothing.
 */
export const up = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        ALTER TYPE "enum_verification_reason" ADD VALUE IF NOT EXISTS 'unchanged';
    `);

    await context.sequelize.query(`
        ALTER TABLE "review_runs"
            ADD COLUMN IF NOT EXISTS "unchanged" INTEGER NOT NULL DEFAULT 0;
    `);

    // Runs first: once the rows are relabelled there is nothing left to count.
    await context.sequelize.query(`
        UPDATE "review_runs" r
        SET "unchanged" = counted."sure",
            "abstained" = GREATEST(r."abstained" - counted."sure", 0)
        FROM (
            SELECT "run_id", count(*) AS "sure"
            FROM "verifications"
            WHERE "reason" = 'abstained'
              AND "agent_id" IS NOT NULL
              AND "confidence" >= 55
              AND "run_id" IS NOT NULL
            GROUP BY "run_id"
        ) AS counted
        WHERE counted."run_id" = r."id";
    `);

    await context.sequelize.query(`
        UPDATE "verifications"
        SET "reason" = 'unchanged'
        WHERE "reason" = 'abstained'
          AND "agent_id" IS NOT NULL
          AND "confidence" >= 55;
    `);
};

/**
 * The enum value stays — Postgres cannot drop one — so the rows go back to
 * `abstained`, which is what they said before and still means "nothing moved".
 */
export const down = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        UPDATE "review_runs" r
        SET "abstained" = r."abstained" + r."unchanged";

        UPDATE "verifications" SET "reason" = 'abstained' WHERE "reason" = 'unchanged';

        ALTER TABLE "review_runs" DROP COLUMN IF EXISTS "unchanged";
    `);
};
