import { QueryInterface } from 'sequelize';

/**
 * What a verdict would have written, kept.
 *
 * 0016 made a run able to record without acting, and 0017 kept the status a row
 * would have reached — but a verdict whose act is *writing a reading* has no
 * status to record, and the text itself was thrown away. So "which model writes
 * the better meaning" was a question the ledger could not answer: the counts
 * said a reading would have been added and nothing said what it said.
 *
 * That is the whole question for the 12,562 clusters that now hold a name and
 * no reading at all. Comparing models there means comparing their prose.
 *
 * Stamped on every row of the verdict, the way `note` and `confidence` already
 * are, and written whether or not the run applied — for an applied run it is
 * the same text as the reading it created, which costs a column and makes the
 * ledger answer "what did it write" without a join.
 */
export const up = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        ALTER TABLE "verifications"
            ADD COLUMN IF NOT EXISTS "proposed" TEXT;
    `);
};

export const down = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        ALTER TABLE "verifications" DROP COLUMN IF EXISTS "proposed";
    `);
};
