import { Inject, Injectable, Logger } from '@nestjs/common';
import {
    getNameNumber,
    implementedNumerologies,
    NameNumerology,
} from '@tbn/shared';
import { QueryTypes, Sequelize } from 'sequelize';

import { SEQUELIZE } from '../database/database.constants.js';

const CHUNK = 500;

const TARGETS: ReadonlyArray<{
    table: string;
    columns: ReadonlyArray<{ name: string; target: string }>;
}> = [
    { table: 'names', columns: [{ name: 'name', target: 'numerology' }] },
    {
        table: 'twin_names',
        columns: [
            { name: 'name1', target: 'numerology1' },
            { name: 'name2', target: 'numerology2' },
        ],
    },
];

/** `{ enkanitham: 5 }`, omitting anything the method cannot value. */
export const numerologyOf = (name: string): NameNumerology => {
    const numbers: NameNumerology = {};

    for (const numerology of implementedNumerologies) {
        const value = getNameNumber(name, numerology)?.number;

        if (value) {
            numbers[numerology] = value;
        }
    }

    return numbers;
};

/**
 * Fills in rows whose numerology is still NULL. The migration computed every
 * row that existed then; this covers anything imported since, which would
 * otherwise be missing from a name-number search until somebody noticed.
 *
 * No DDL: the column is declared in the model and created by a migration.
 */
@Injectable()
export class NumerologyBackfillService {
    private readonly logger = new Logger(NumerologyBackfillService.name);

    constructor(@Inject(SEQUELIZE) private readonly sequelize: Sequelize) {}

    async run(): Promise<void> {
        try {
            for (const { table, columns } of TARGETS) {
                for (const { name, target } of columns) {
                    const written = await this.fill(table, name, target);

                    if (written) {
                        this.logger.log(
                            `Computed ${table}.${target} for ${written} rows.`,
                        );
                    }
                }
            }
        } catch (error) {
            this.logger.error('Failed to compute name numbers!', error);
        }
    }

    private async fill(
        table: string,
        nameColumn: string,
        target: string,
    ): Promise<number> {
        let written = 0;

        for (;;) {
            const rows = await this.sequelize.query<{
                id: number;
                name: string;
            }>(
                `SELECT "id", "${nameColumn}" AS "name" FROM "${table}"
                 WHERE "${target}" IS NULL LIMIT ${CHUNK}`,
                { type: QueryTypes.SELECT, logging: false },
            );

            if (!rows.length) {
                return written;
            }

            const values = rows.map((row) => ({
                id: Number(row.id),
                json: JSON.stringify(numerologyOf(row.name ?? '')),
            }));

            await this.sequelize.query(
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
                    logging: false,
                },
            );

            written += rows.length;
        }
    }
}
