import { sortKey } from '@tbn/shared';
import { QueryInterface, QueryTypes } from 'sequelize';

/**
 * Orders a cluster by what its name sounds like rather than by which script it
 * is written in. Unicode sorts the whole Latin block away from the whole Tamil
 * one, so Abi and அபி — the same name, filed twice — could never appear near
 * each other however good the collation was. Romanised, both are `api`.
 *
 * This is what `sort_key` was added for in 0006, where it backfilled to the
 * name itself.
 *
 * Recomputed here rather than in SQL: the transliteration is a table of Tamil
 * letters that the site will want too, so it lives in shared.
 */
const CHUNK = 500;

export const up = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    const clusters = await context.sequelize.query<{
        id: number;
        name: string;
    }>(`SELECT "id", "name" FROM "clusters" ORDER BY "id"`, {
        type: QueryTypes.SELECT,
    });

    for (let at = 0; at < clusters.length; at += CHUNK) {
        const chunk = clusters.slice(at, at + CHUNK);

        await context.sequelize.query(
            `UPDATE "clusters" SET "sort_key" = keys."sort_key"
             FROM (VALUES ${chunk
                 .map((_, index) => `(:id${index}::integer, :key${index})`)
                 .join(', ')}) AS keys ("id", "sort_key")
             WHERE "clusters"."id" = keys."id"`,
            {
                replacements: Object.fromEntries(
                    chunk.flatMap(({ id, name }, index) => [
                        [`id${index}`, id],
                        [`key${index}`, sortKey(name) || name],
                    ]),
                ),
            },
        );
    }
};

/** Back to the name, which is what 0006 put there. */
export const down = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`UPDATE "clusters" SET "sort_key" = "name"`);
};
