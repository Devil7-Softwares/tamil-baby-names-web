import { Inject, Injectable, Logger } from '@nestjs/common';
import { literal, Order, Sequelize } from 'sequelize';

import { SEQUELIZE } from './database.constants.js';

// Root ICU, not `ta-x-icu`: the Tamil tailoring orders a pure consonant
// (க், consonant + pulli) before the consonant's vowel forms, where the
// traditional alphabet puts it last — க கா கி … கோ க். Root agrees with the
// alphabet, and with the utf8mb4_unicode_520_ci this replaced.
const COLLATION = 'und-x-icu';

@Injectable()
export class SortCollationService {
    private readonly logger = new Logger(SortCollationService.name);

    /**
     * The database default orders Tamil by code point, which misplaces ன, ற,
     * ல, ள, ழ and வ. ICU knows the alphabet's order. An empty string leaves the
     * column collation in place should a server be built without ICU support.
     */
    private collation = '';

    constructor(@Inject(SEQUELIZE) private readonly sequelize: Sequelize) {}

    async resolve(): Promise<void> {
        try {
            const [rows] = await this.sequelize.query(
                `SELECT 1 FROM pg_collation WHERE collname = '${COLLATION}'`,
                { logging: false },
            );

            this.collation = rows.length ? ` COLLATE "${COLLATION}"` : '';
        } catch (error) {
            this.logger.error('Failed to resolve the sort collation!', error);
        }
    }

    /** The COLLATE clause for a raw ORDER BY; empty when ICU is unavailable. */
    get clause(): string {
        return this.collation;
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
                literal(`"${column}" ~ '^[A-Za-z]'`),
                literal(`"${column}"${this.collation}`),
            ]),
            'id',
        ];
    }
}
