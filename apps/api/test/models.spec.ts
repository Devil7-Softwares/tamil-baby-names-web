import { Sequelize } from 'sequelize';
import { describe, expect, it } from 'vitest';

import { defineNames, defineTwinNames } from '../src/database/models';

const sequelize = new Sequelize({ dialect: 'mysql' });
const names = defineNames(sequelize);
const twinNames = defineTwinNames(sequelize);

describe('models', () => {
    it('reads the tables the catalogue already uses', () => {
        expect(names.tableName).toBe('names');
        expect(twinNames.tableName).toBe('twin_names');
    });

    it('maps firstLetter onto the snake case column', () => {
        expect(names.getAttributes().firstLetter.field).toBe('first_letter');
    });

    it('claims no timestamp columns, which the tables do not have', () => {
        expect(names.options.timestamps).toBe(false);
        expect(twinNames.options.timestamps).toBe(false);
        expect(Object.keys(names.getAttributes())).not.toContain('createdAt');
        expect(Object.keys(twinNames.getAttributes())).not.toContain(
            'createdAt',
        );
    });

    it('exposes every column the shared interfaces declare', () => {
        expect(Object.keys(names.getAttributes()).sort()).toEqual([
            'firstLetter',
            'gender',
            'id',
            'language',
            'meaning',
            'name',
            'religion',
        ]);
        expect(Object.keys(twinNames.getAttributes()).sort()).toEqual([
            'gender',
            'id',
            'language',
            'meaning1',
            'meaning2',
            'name1',
            'name2',
        ]);
    });
});
