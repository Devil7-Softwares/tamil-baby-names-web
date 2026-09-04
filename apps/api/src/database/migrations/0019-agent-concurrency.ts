import { QueryInterface } from 'sequelize';

/**
 * How many clusters an agent may be asked about at once.
 *
 * A run has always been one request at a time, and the reason given was that a
 * local model answers one at a time anyway and a hosted one rate-limits. The
 * first half is still true; the second is a reason to bound concurrency, not to
 * refuse it. At one request at a time `claude-sonnet-5` needs ~17 hours for the
 * 11,912 names with no reading, nearly all of it spent waiting.
 *
 * Null means "whatever the provider says", which is 1 for Ollama — a model on
 * this machine has one set of weights and answering four questions at once only
 * makes each slower — and 4 for the hosted ones.
 *
 * This is deliberately **not** in `options`. That column is per-provider dials
 * the provider itself reads; how many requests we choose to have in flight is
 * our scheduling decision and belongs where it can be seen and validated.
 */
export const up = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        ALTER TABLE "agents"
            ADD COLUMN IF NOT EXISTS "concurrency" INTEGER;

        ALTER TABLE "agents"
            DROP CONSTRAINT IF EXISTS "agents_concurrency_range";

        ALTER TABLE "agents"
            ADD CONSTRAINT "agents_concurrency_range" CHECK (
                "concurrency" IS NULL
                OR ("concurrency" >= 1 AND "concurrency" <= 32)
            );
    `);
};

export const down = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        ALTER TABLE "agents" DROP CONSTRAINT IF EXISTS "agents_concurrency_range";
        ALTER TABLE "agents" DROP COLUMN IF EXISTS "concurrency";
    `);
};
