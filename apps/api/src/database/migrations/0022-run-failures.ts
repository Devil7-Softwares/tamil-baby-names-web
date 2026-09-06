import { QueryInterface } from 'sequelize';

/**
 * Which clusters a run could not ask about.
 *
 * A refused or unreachable provider is the run's problem and not the cluster's,
 * so the cluster is left untouched and stays in the queue — which is right, and
 * left the run holding a number and nothing else. Run 43 met an API usage limit
 * part way through and finished reporting 1,050 failures it could not name.
 *
 * Not the ledger, deliberately. `verifications` means "an agent judged this",
 * and the queue reads it to decide what has been answered: a failure recorded
 * there would answer the cluster and lose it. Kept beside the run instead,
 * where it says what happened without claiming anything about the name.
 *
 * The error text is kept because the failures of one run are rarely one thing —
 * a rate limit, a timeout and a malformed answer all land here, and only the
 * first of those is worth waiting out.
 */
export const up = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        CREATE TABLE IF NOT EXISTS "review_run_failures" (
            "id" SERIAL PRIMARY KEY,
            "run_id" INTEGER NOT NULL
                REFERENCES "review_runs" ("id") ON DELETE CASCADE,
            "cluster_id" INTEGER NOT NULL
                REFERENCES "clusters" ("id") ON DELETE CASCADE,
            "error" TEXT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE ("run_id", "cluster_id")
        );
    `);

    await context.sequelize.query(`
        CREATE INDEX IF NOT EXISTS "review_run_failures_run_id_idx"
            ON "review_run_failures" ("run_id");
    `);
};

export const down = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        DROP TABLE IF EXISTS "review_run_failures";
    `);
};
