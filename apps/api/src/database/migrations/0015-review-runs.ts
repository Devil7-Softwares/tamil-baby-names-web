import { QueryInterface } from 'sequelize';

/**
 * One run of an agent over the queue.
 *
 * Reviewing 160,000 scraped rows is hours of work at a second a name, so a run
 * cannot live in a request: the browser tab would have to stay open and a
 * reload would lose it. A row here is what the dashboard watches, what the
 * Cancel button reaches, and what says afterwards how the last run went.
 *
 * The counts are the same ones the CLI prints, written after each cluster
 * rather than at the end — a run that breaks half way still says what it did
 * before it broke, and that work is already committed, because each verdict is
 * its own transaction.
 *
 * `total` is what was actually queued and `requested` what was asked for; they
 * differ when the queue held fewer clusters than the batch size, which is worth
 * showing rather than a progress bar that stops at 40%.
 *
 * A run interrupted by the server stopping is marked failed on the next boot.
 * Nothing else can tell the difference between "still going" and "the process
 * that was going died", and a row that says `running` forever blocks the agent.
 */
export const up = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        DO $$ BEGIN
            CREATE TYPE "enum_review_run_status"
                AS ENUM ('running', 'finished', 'cancelled', 'failed');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;

        CREATE TABLE IF NOT EXISTS "review_runs" (
            "id"          SERIAL PRIMARY KEY,
            -- Cascades: a run of an agent the catalogue no longer holds cannot
            -- say whose run it was. The verdicts it left behind keep their own
            -- record, which is the ledger's job rather than this table's.
            "agent_id"    INTEGER NOT NULL
                          REFERENCES "agents" ("id") ON DELETE CASCADE,
            "status"      "enum_review_run_status" NOT NULL DEFAULT 'running',
            "requested"   INTEGER NOT NULL,
            "total"       INTEGER NOT NULL DEFAULT 0,
            "reviewed"    INTEGER NOT NULL DEFAULT 0,
            "abstained"   INTEGER NOT NULL DEFAULT 0,
            "published"   INTEGER NOT NULL DEFAULT 0,
            "rejected"    INTEGER NOT NULL DEFAULT 0,
            "added"       INTEGER NOT NULL DEFAULT 0,
            "dropped"     INTEGER NOT NULL DEFAULT 0,
            "failed"      INTEGER NOT NULL DEFAULT 0,
            "error"       TEXT,
            "started_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
            "finished_at" TIMESTAMPTZ
        );

        -- "the newest runs", which is the whole of what the page asks for.
        CREATE INDEX IF NOT EXISTS "review_runs_started_at_idx"
            ON "review_runs" ("started_at" DESC);

        -- One run per agent at a time. Two would hand the same clusters to the
        -- same model twice, because a verdict only excludes a cluster once it
        -- has been written.
        CREATE UNIQUE INDEX IF NOT EXISTS "review_runs_one_running_idx"
            ON "review_runs" ("agent_id") WHERE "status" = 'running';
    `);
};

export const down = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        DROP TABLE IF EXISTS "review_runs";
        DROP TYPE IF EXISTS "enum_review_run_status";
    `);
};
