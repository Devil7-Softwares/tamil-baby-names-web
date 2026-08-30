import { getNameNumber, implementedNumerologies } from '@tbn/shared';
import { QueryInterface, QueryTypes } from 'sequelize';

/**
 * Replaces the per-method `<method>_number` columns with a single jsonb object
 * per name. The old columns were added by `ALTER TABLE` on every boot, so their
 * set was a function of `implementedNumerologies` and they were never declared
 * in the model; a method can now be added without touching the schema.
 *
 * A method that gives a name no value is left out of the object rather than
 * stored as 0. The column itself being NULL is what "not computed yet" means.
 */

const CHUNK = 500;

/** `{ enkanitham: 5, chaldean: 3 }`, omitting anything the method cannot value. */
const numerologyOf = (name: string): Record<string, number> => {
    const numbers: Record<string, number> = {};

    for (const numerology of implementedNumerologies) {
        const value = getNameNumber(name, numerology)?.number;

        if (value) {
            numbers[numerology] = value;
        }
    }

    return numbers;
};

const backfill = async (
    context: QueryInterface,
    table: string,
    columns: ReadonlyArray<{ name: string; target: string }>,
): Promise<void> => {
    const rows = await context.sequelize.query<Record<string, string | number>>(
        `SELECT "id", ${columns.map((c) => `"${c.name}"`).join(', ')} FROM "${table}"`,
        { type: QueryTypes.SELECT },
    );

    for (let start = 0; start < rows.length; start += CHUNK) {
        const chunk = rows.slice(start, start + CHUNK);

        for (const { name, target } of columns) {
            const values = chunk.map((row) => ({
                id: Number(row.id),
                json: JSON.stringify(numerologyOf(String(row[name] ?? ''))),
            }));

            await context.sequelize.query(
                `UPDATE "${table}" AS t SET "${target}" = v.json::jsonb
                 FROM (VALUES ${values.map((_, i) => `(:id${i}::int, :json${i}::text)`).join(', ')}) AS v(id, json)
                 WHERE t."id" = v.id`,
                {
                    replacements: Object.fromEntries(
                        values.flatMap((value, i) => [
                            [`id${i}`, value.id],
                            [`json${i}`, value.json],
                        ]),
                    ),
                },
            );
        }
    }
};

export const up = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        ALTER TABLE "names"      ADD COLUMN IF NOT EXISTS "numerology"  JSONB;
        ALTER TABLE "twin_names" ADD COLUMN IF NOT EXISTS "numerology1" JSONB;
        ALTER TABLE "twin_names" ADD COLUMN IF NOT EXISTS "numerology2" JSONB;
    `);

    await backfill(context, 'names', [{ name: 'name', target: 'numerology' }]);
    await backfill(context, 'twin_names', [
        { name: 'name1', target: 'numerology1' },
        { name: 'name2', target: 'numerology2' },
    ]);

    // One index per column covers every method and every value, because
    // containment (`@>`) is what the filter asks. Adding a method needs no
    // further index.
    await context.sequelize.query(`
        CREATE INDEX IF NOT EXISTS "names_numerology_idx"
            ON "names" USING GIN ("numerology" jsonb_path_ops);
        CREATE INDEX IF NOT EXISTS "twin_names_numerology1_idx"
            ON "twin_names" USING GIN ("numerology1" jsonb_path_ops);
        CREATE INDEX IF NOT EXISTS "twin_names_numerology2_idx"
            ON "twin_names" USING GIN ("numerology2" jsonb_path_ops);
    `);

    // Dropped last, so a failure above leaves the old values in place.
    const dropped = implementedNumerologies.flatMap((numerology) => [
        `ALTER TABLE "names" DROP COLUMN IF EXISTS "${numerology}_number";`,
        `ALTER TABLE "twin_names" DROP COLUMN IF EXISTS "${numerology}_number1";`,
        `ALTER TABLE "twin_names" DROP COLUMN IF EXISTS "${numerology}_number2";`,
    ]);

    await context.sequelize.query(dropped.join('\n'));
};

export const down = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        ALTER TABLE "names"      DROP COLUMN IF EXISTS "numerology";
        ALTER TABLE "twin_names" DROP COLUMN IF EXISTS "numerology1";
        ALTER TABLE "twin_names" DROP COLUMN IF EXISTS "numerology2";
    `);
};
