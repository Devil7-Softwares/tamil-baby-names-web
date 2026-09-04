import { QueryInterface } from 'sequelize';

/**
 * How many clusters a run put in each request.
 *
 * Recorded for the same reason `applied` and `compare_with` are: a run's counts
 * mean different things depending on how it was made, and two runs are only
 * comparable if you can see that one asked about a name on its own and the
 * other asked about it alongside nine others.
 *
 * It matters more here than it looks. Every calibration figure the model
 * comparison rests on — abstention rates, confidence spread — was measured one
 * cluster per request. Asking about ten at once is a different question put to
 * the model, and a run that does it should say so rather than being averaged in
 * with runs that did not.
 *
 * 1 is the old behaviour and stays the default.
 */
export const up = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        ALTER TABLE "review_runs"
            ADD COLUMN IF NOT EXISTS "batch" INTEGER NOT NULL DEFAULT 1;

        ALTER TABLE "review_runs"
            DROP CONSTRAINT IF EXISTS "review_runs_batch_range";

        ALTER TABLE "review_runs"
            ADD CONSTRAINT "review_runs_batch_range"
                CHECK ("batch" >= 1 AND "batch" <= 25);
    `);
};

export const down = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        ALTER TABLE "review_runs" DROP CONSTRAINT IF EXISTS "review_runs_batch_range";
        ALTER TABLE "review_runs" DROP COLUMN IF EXISTS "batch";
    `);
};
