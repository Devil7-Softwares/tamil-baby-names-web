import { Inject, Injectable, Logger } from '@nestjs/common';
import {
    getNameNumber,
    implementedNumerologies,
    Numerology,
} from '@tbn/shared';
import { Sequelize } from 'sequelize';

import { SEQUELIZE } from '../database/database.constants.js';
import { numerologyColumn, NumerologySuffix } from './numerology-column.js';

const NUMEROLOGY_TABLES: ReadonlyArray<{
    table: string;
    columns: ReadonlyArray<{ name: string; suffix: NumerologySuffix }>;
}> = [
    { table: 'names', columns: [{ name: 'name', suffix: '' }] },
    {
        table: 'twin_names',
        columns: [
            { name: 'name1', suffix: '1' },
            { name: 'name2', suffix: '2' },
        ],
    },
];

const BACKFILL_CHUNK = 1000;

@Injectable()
export class NumerologyColumnsService {
    private readonly logger = new Logger(NumerologyColumnsService.name);
    private ready = false;

    constructor(@Inject(SEQUELIZE) private readonly sequelize: Sequelize) {}

    /**
     * True once the precomputed columns exist and hold no NULLs. Until then the
     * numerology filter reads every matching row instead, so a database that
     * refuses the ALTER costs performance rather than correctness.
     */
    get isReady(): boolean {
        return this.ready;
    }

    async prepare(): Promise<void> {
        try {
            for (const numerology of implementedNumerologies) {
                for (const { table, columns } of NUMEROLOGY_TABLES) {
                    for (const { name, suffix } of columns) {
                        await this.ensureColumn(
                            table,
                            name,
                            numerology,
                            suffix,
                        );
                    }
                }
            }

            this.ready = true;
        } catch (error) {
            this.logger.error('Failed to prepare numerology columns!', error);
        }
    }

    private async ensureColumn(
        table: string,
        nameColumn: string,
        numerology: Numerology,
        suffix: NumerologySuffix,
    ): Promise<void> {
        const target = numerologyColumn(numerology, suffix);

        await this.sequelize.query(
            `ALTER TABLE \`${table}\`
             ADD COLUMN IF NOT EXISTS \`${target}\` TINYINT NULL`,
            { logging: false },
        );

        const written = await this.backfill(
            table,
            nameColumn,
            target,
            numerology,
        );

        if (written) {
            this.logger.log(
                `Backfilled ${table}.${target} for ${written} rows.`,
            );
        }
    }

    /**
     * 0 records "this method gives the name no value", which keeps it distinct
     * from NULL, "not computed yet" - so this can resume on IS NULL alone.
     */
    private async backfill(
        table: string,
        nameColumn: string,
        target: string,
        numerology: Numerology,
    ): Promise<number> {
        let written = 0;

        for (;;) {
            const [rows] = (await this.sequelize.query(
                `SELECT \`id\`, \`${nameColumn}\` AS \`name\` FROM \`${table}\`
                 WHERE \`${target}\` IS NULL LIMIT ${BACKFILL_CHUNK}`,
                { logging: false },
            )) as [Array<{ id: number; name: string }>, unknown];

            if (!rows.length) {
                return written;
            }

            const ids = new Map<number, number[]>();

            for (const row of rows) {
                const value = getNameNumber(row.name, numerology)?.number ?? 0;

                ids.set(value, [...(ids.get(value) || []), row.id]);
            }

            // One statement per distinct number rather than per row: at most
            // ten, whatever the chunk size.
            for (const [value, rowIds] of ids) {
                await this.sequelize.query(
                    `UPDATE \`${table}\` SET \`${target}\` = ${value}
                     WHERE \`id\` IN (${rowIds.join(',')})`,
                    { logging: false },
                );
            }

            written += rows.length;
        }
    }
}
