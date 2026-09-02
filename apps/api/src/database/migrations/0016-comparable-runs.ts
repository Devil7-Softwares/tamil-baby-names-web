import { QueryInterface } from 'sequelize';

/**
 * Asking two agents the same question.
 *
 * A run today takes the clusters its agent has not answered on, which is right
 * for working through a queue and useless for comparing models: each agent gets
 * a different sample, and whichever went first has already changed the rows the
 * next one sees. Two things fix that, and they are deliberately separate.
 *
 * **`compare_with`** names an earlier run, and the new run takes *its* clusters
 * instead of the unreviewed ones — the re-ask. It overrides the "not already
 * answered" rule, because re-asking is the entire point.
 *
 * **`applied`** says whether the run writes. A run that only records lets three
 * models be asked about one cluster from one starting state, which is the only
 * way the answers are about the models rather than about who ran first. The
 * counts still say what it *would* have done.
 *
 * They are separate because both combinations are wanted: a better model
 * re-asking and actually applying is a legitimate second pass, and a first
 * trial that changes nothing has no earlier run to point at.
 *
 * `reason` gains **considered** — a verdict recorded and not acted on, carrying
 * `from_status = to_status` like `abstained` does. It is the whole of the
 * difference between "the model would have rejected this" and "this is
 * rejected", and keeping it in the same ledger means one place to read what any
 * reviewer, human or not, has ever said about a row.
 *
 * `verifications.run_id` is what makes a run's clusters findable at all. It is
 * backfilled by matching each verdict to the run of the same agent that was
 * going when it was written, so runs from before this migration can still be
 * re-asked.
 */
export const up = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        ALTER TYPE "enum_verification_reason" ADD VALUE IF NOT EXISTS 'considered';
    `);

    await context.sequelize.query(`
        ALTER TABLE "review_runs"
            ADD COLUMN IF NOT EXISTS "compare_with" INTEGER
                REFERENCES "review_runs" ("id") ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS "applied" BOOLEAN NOT NULL DEFAULT TRUE;

        ALTER TABLE "verifications"
            ADD COLUMN IF NOT EXISTS "run_id" INTEGER
                REFERENCES "review_runs" ("id") ON DELETE SET NULL;

        -- "Which clusters did that run look at", which is the re-ask.
        CREATE INDEX IF NOT EXISTS "verifications_run_id_idx"
            ON "verifications" ("run_id");
    `);

    // By agent and by when: a run holds its agent for its whole life — the
    // partial unique index on `running` guarantees it — so a verdict written
    // inside one run's window by that run's agent belongs to it.
    await context.sequelize.query(`
        UPDATE "verifications" v
        SET "run_id" = r."id"
        FROM "review_runs" r
        WHERE v."run_id" IS NULL
          AND v."agent_id" IS NOT NULL
          AND v."agent_id" = r."agent_id"
          AND v."created_at" >= r."started_at"
          AND v."created_at" <= COALESCE(r."finished_at", now());
    `);
};

/**
 * The enum value stays. Postgres cannot drop one, and a `considered` row is a
 * fact somebody recorded — dropping the column that explains it would be worse
 * than leaving a value nothing writes.
 */
export const down = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        DROP INDEX IF EXISTS "verifications_run_id_idx";

        ALTER TABLE "verifications" DROP COLUMN IF EXISTS "run_id";

        ALTER TABLE "review_runs"
            DROP COLUMN IF EXISTS "compare_with",
            DROP COLUMN IF EXISTS "applied";
    `);
};
