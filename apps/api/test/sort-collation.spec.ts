import { Sequelize } from 'sequelize';
import { Literal } from 'sequelize/types/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SortCollationService } from '../src/names/sort-collation.service';

const query = vi.fn();

const service = () =>
    new SortCollationService({ query } as unknown as Sequelize);

const values = (order: unknown[]) =>
    order.map((item) =>
        typeof item === 'string' ? item : (item as Literal).val,
    );

describe('SortCollationService', () => {
    beforeEach(() => {
        query.mockReset();
    });

    it('orders on the script before the name, and breaks ties on id', async () => {
        query.mockResolvedValue([[], undefined]);

        const collation = service();

        await collation.resolve();

        expect(values(collation.order(['name']) as unknown[])).toEqual([
            "`name` REGEXP '^[A-Za-z]'",
            '`name`',
            'id',
        ]);
    });

    it('applies the collation when the server carries it', async () => {
        query.mockResolvedValue([[{ Collation: 'utf8mb4_unicode_520_ci' }]]);

        const collation = service();

        await collation.resolve();

        expect(
            values(collation.order(['name1', 'name2']) as unknown[]),
        ).toEqual([
            "`name1` REGEXP '^[A-Za-z]'",
            '`name1` COLLATE utf8mb4_unicode_520_ci',
            "`name2` REGEXP '^[A-Za-z]'",
            '`name2` COLLATE utf8mb4_unicode_520_ci',
            'id',
        ]);
    });

    it('leaves the column collation in place when the lookup fails', async () => {
        query.mockRejectedValue(new Error('no such statement'));

        const collation = service();

        await collation.resolve();

        expect(values(collation.order(['name']) as unknown[])).toEqual([
            "`name` REGEXP '^[A-Za-z]'",
            '`name`',
            'id',
        ]);
    });
});
