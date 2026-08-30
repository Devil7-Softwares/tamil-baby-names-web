import { getNameNumber, implementedNumerologies } from '@tbn/shared';
import { Sequelize } from 'sequelize';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { numerologyColumn } from '../src/names/numerology-column.js';
import { NumerologyColumnsService } from '../src/names/numerology-columns.service.js';

class FakeSequelize {
    readonly statements: string[] = [];
    readonly pending = new Map<string, Array<{ id: number; name: string }>>();

    query = vi.fn(async (sql: string) => {
        this.statements.push(sql);

        const target = /WHERE "(\w+)" IS NULL/.exec(sql)?.[1];

        if (!target) {
            return [[], undefined];
        }

        const rows = this.pending.get(target) ?? [];

        this.pending.delete(target);

        return [rows, undefined];
    });
}

const serviceOn = (sequelize: FakeSequelize) =>
    new NumerologyColumnsService(sequelize as unknown as Sequelize);

const statementsOfType = (sequelize: FakeSequelize, type: string) =>
    sequelize.statements.filter((sql) => sql.trimStart().startsWith(type));

describe('numerologyColumn', () => {
    it('derives the column from the method name', () => {
        expect(numerologyColumn('chaldean', '')).toBe('chaldean_number');
        expect(numerologyColumn('chaldean', '1')).toBe('chaldean_number1');
        expect(numerologyColumn('pythagorean', '2')).toBe(
            'pythagorean_number2',
        );
    });

    it('refuses a method name it would have to interpolate blindly', () => {
        expect(() =>
            numerologyColumn('chaldean`; DROP TABLE names; --' as never, ''),
        ).toThrow(/Unsafe numerology name/);
    });
});

describe('NumerologyColumnsService', () => {
    let sequelize: FakeSequelize;

    beforeEach(() => {
        sequelize = new FakeSequelize();
    });

    it('adds a column for every method and name column', async () => {
        const service = serviceOn(sequelize);

        await service.prepare();

        const altered = statementsOfType(sequelize, 'ALTER');

        expect(altered).toHaveLength(implementedNumerologies.length * 3);

        for (const numerology of implementedNumerologies) {
            expect(
                altered.some(
                    (sql) =>
                        sql.includes('"names"') &&
                        sql.includes(`"${numerologyColumn(numerology, '')}"`),
                ),
            ).toBe(true);
            expect(
                altered.some(
                    (sql) =>
                        sql.includes('"twin_names"') &&
                        sql.includes(`"${numerologyColumn(numerology, '2')}"`),
                ),
            ).toBe(true);
        }

        expect(service.isReady).toBe(true);
    });

    it('writes one statement per distinct number, not per row', async () => {
        const names = ['அறிவு', 'கண்ணன்', 'முருகன்', 'வேலன்'];
        const rows = names.map((name, index) => ({ id: index + 1, name }));

        sequelize.pending.set(numerologyColumn('chaldean', ''), rows);

        await serviceOn(sequelize).prepare();

        const updates = statementsOfType(sequelize, 'UPDATE');
        const expected = new Map<number, number[]>();

        for (const row of rows) {
            const value = getNameNumber(row.name, 'chaldean')?.number ?? 0;

            expected.set(value, [...(expected.get(value) ?? []), row.id]);
        }

        expect(updates).toHaveLength(expected.size);

        for (const [value, ids] of expected) {
            expect(
                updates.some(
                    (sql) =>
                        sql.includes(`= ${value}`) &&
                        sql.includes(`IN (${ids.join(',')})`),
                ),
            ).toBe(true);
        }
    });

    it('reads again until a chunk comes back empty', async () => {
        const target = numerologyColumn('chaldean', '');

        sequelize.pending.set(target, [{ id: 1, name: 'அறிவு' }]);

        await serviceOn(sequelize).prepare();

        const reads = statementsOfType(sequelize, 'SELECT').filter((sql) =>
            sql.includes(`"${target}" IS NULL`),
        );

        expect(reads).toHaveLength(2);
    });

    it('stays unready when the database refuses the column', async () => {
        sequelize.query.mockRejectedValue(new Error('ALTER denied'));

        const service = serviceOn(sequelize);

        await service.prepare();

        expect(service.isReady).toBe(false);
    });
});
