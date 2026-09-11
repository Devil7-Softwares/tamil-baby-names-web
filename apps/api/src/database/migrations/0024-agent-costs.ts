import { QueryInterface } from 'sequelize';

/**
 * What the cloud models cost.
 *
 * Prices live on the agent, in US dollars per million tokens as the providers'
 * price pages list them, and are entered by hand: they change, and nothing
 * here can check a model's price for itself. Null for a model on this machine,
 * which costs nothing per token.
 *
 * A run copies the prices when it starts. Changing an agent's price later then
 * leaves what earlier runs cost alone.
 *
 * The token counts are null on every run before this one — nothing recorded
 * them — and a new run starts them at zero. Null reads as "not recorded", which
 * is the truth; zero would read as "free".
 */
export const up = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        ALTER TABLE "agents"
            ADD COLUMN IF NOT EXISTS "input_price" DOUBLE PRECISION
                CHECK ("input_price" >= 0),
            ADD COLUMN IF NOT EXISTS "output_price" DOUBLE PRECISION
                CHECK ("output_price" >= 0);
    `);

    await context.sequelize.query(`
        ALTER TABLE "review_runs"
            ADD COLUMN IF NOT EXISTS "input_tokens" INTEGER,
            ADD COLUMN IF NOT EXISTS "output_tokens" INTEGER,
            ADD COLUMN IF NOT EXISTS "input_price" DOUBLE PRECISION,
            ADD COLUMN IF NOT EXISTS "output_price" DOUBLE PRECISION;
    `);
};

export const down = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        ALTER TABLE "review_runs"
            DROP COLUMN IF EXISTS "input_tokens",
            DROP COLUMN IF EXISTS "output_tokens",
            DROP COLUMN IF EXISTS "input_price",
            DROP COLUMN IF EXISTS "output_price";
    `);

    await context.sequelize.query(`
        ALTER TABLE "agents"
            DROP COLUMN IF EXISTS "input_price",
            DROP COLUMN IF EXISTS "output_price";
    `);
};
