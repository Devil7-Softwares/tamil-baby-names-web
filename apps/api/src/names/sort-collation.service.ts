import { Inject, Injectable, Logger } from '@nestjs/common';
import { literal, Order, Sequelize } from 'sequelize';

import { SEQUELIZE } from '../database/database.constants.js';

@Injectable()
export class SortCollationService {
    private readonly logger = new Logger(SortCollationService.name);

    /**
     * The column's own `utf8mb4_unicode_ci` (UCA 4.0.0) orders Tamil by code
     * point, which misplaces ன, ற, ல, ள, ழ and வ. 5.2.0 knows the alphabet's
     * order, and unlike `utf8mb4_uca1400_ai_ci` it exists on the 10.11 the host
     * runs; an empty string leaves the column collation in place should a
     * server not carry it.
     */
    private collation = '';

    constructor(@Inject(SEQUELIZE) private readonly sequelize: Sequelize) {}

    async resolve(): Promise<void> {
        try {
            const [rows] = await this.sequelize.query(
                "SHOW COLLATION LIKE 'utf8mb4_unicode_520_ci'",
                { logging: false },
            );

            this.collation = rows.length
                ? ' COLLATE utf8mb4_unicode_520_ci'
                : '';
        } catch (error) {
            this.logger.error('Failed to resolve the sort collation!', error);
        }
    }

    /**
     * Unicode sorts the whole Latin block ahead of the whole Tamil one, so
     * leaving it at that buries every Tamil name pages deep behind the English
     * spellings. Ordering on the script first keeps each block whole, Tamil
     * first. `id` breaks ties, without which two rows sharing a name could swap
     * places between pages.
     */
    order(columns: string[]): Order {
        return [
            ...columns.flatMap((column) => [
                literal(`\`${column}\` REGEXP '^[A-Za-z]'`),
                literal(`\`${column}\`${this.collation}`),
            ]),
            'id',
        ];
    }
}
