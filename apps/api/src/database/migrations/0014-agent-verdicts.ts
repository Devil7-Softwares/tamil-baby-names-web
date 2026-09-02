import { QueryInterface } from 'sequelize';

/**
 * A verdict an agent reached, in the ledger that already holds everyone else's.
 *
 * 0007 anticipated this — `actor_id` is "null for whatever the pipeline decides
 * on its own" — but a null says only "not a person", and once several agents
 * are configured the question is *which* one, and how sure it was. So the
 * ledger gains three columns rather than the catalogue gaining a flag: what an
 * agent decided is an entry in the same append-only record as what a reviewer
 * decided, and "reviewed by AI" is a question about that record, not a
 * property of a name.
 *
 * `actor_id` and `agent_id` are both nullable and never both set: a row is a
 * person's or a model's. Not a CHECK, because a row with neither is what the
 * fixture and the 0011 sweep already wrote, and those stay valid.
 *
 * `confidence` is the model's own 0–100 and is null for a person, who does not
 * publish a reading they are 40% sure of. `note` is its one line of why, which
 * is the whole reason a second human pass can be selective instead of
 * re-reading everything.
 *
 * `reason` gains **abstained**: an agent that looked and did not decide. Those
 * rows carry `from_status = to_status`, because nothing moved — they record
 * that the queue was seen, which is what stops a second run asking the same
 * question and what a human filters on to find the hard ones.
 */
export const up = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        ALTER TYPE "enum_verification_reason" ADD VALUE IF NOT EXISTS 'abstained';
    `);

    await context.sequelize.query(`
        ALTER TABLE "verifications"
            ADD COLUMN IF NOT EXISTS "agent_id" INTEGER
                REFERENCES "agents" ("id") ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS "confidence" SMALLINT,
            ADD COLUMN IF NOT EXISTS "note" TEXT;

        ALTER TABLE "verifications"
            DROP CONSTRAINT IF EXISTS "verifications_confidence_range";

        ALTER TABLE "verifications"
            ADD CONSTRAINT "verifications_confidence_range" CHECK (
                "confidence" IS NULL
                OR ("confidence" >= 0 AND "confidence" <= 100)
            );

        -- "What has this agent decided, most recent first", which is both the
        -- run's own report and the queue's "reviewed by AI" filter.
        CREATE INDEX IF NOT EXISTS "verifications_agent_id_idx"
            ON "verifications" ("agent_id", "created_at" DESC);
    `);
};

/**
 * The enum value stays. Postgres cannot drop one, and rewriting the type to
 * remove it would rewrite every row of the ledger to save a word.
 */
export const down = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        DROP INDEX IF EXISTS "verifications_agent_id_idx";

        ALTER TABLE "verifications"
            DROP CONSTRAINT IF EXISTS "verifications_confidence_range";

        ALTER TABLE "verifications"
            DROP COLUMN IF EXISTS "agent_id",
            DROP COLUMN IF EXISTS "confidence",
            DROP COLUMN IF EXISTS "note";
    `);
};
