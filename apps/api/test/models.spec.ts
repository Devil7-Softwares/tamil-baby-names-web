import { Sequelize } from 'sequelize';
import { describe, expect, it } from 'vitest';

import {
    defineClusters,
    defineMeanings,
    defineNames,
    defineSources,
    defineTwinNames,
    defineVerifications,
} from '../src/database/models.js';

const sequelize = new Sequelize({ dialect: 'postgres' });
const names = defineNames(sequelize);
const twinNames = defineTwinNames(sequelize);
const meanings = defineMeanings(sequelize);
const clusters = defineClusters(sequelize);
const sources = defineSources(sequelize);
const verifications = defineVerifications(sequelize);

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

    // The numerology columns used to be added by ALTER TABLE at boot and were
    // never declared, so typescript could not see what the queries read.
    it('exposes every column the queries read, numerology included', () => {
        expect(Object.keys(names.getAttributes()).sort()).toEqual([
            'clusterId',
            'firstLetter',
            'gender',
            'id',
            'language',
            'name',
            'numerology',
            'religion',
            'sourceId',
            'status',
        ]);
        expect(Object.keys(twinNames.getAttributes()).sort()).toEqual([
            'gender',
            'id',
            'language',
            'name1',
            'name2',
            'numerology1',
            'numerology2',
            'sourceId',
            'status',
        ]);
    });

    it('keeps meanings out of the catalogue rows, where one had to win', () => {
        expect(Object.keys(names.getAttributes())).not.toContain('meaning');
        expect(Object.keys(twinNames.getAttributes())).not.toContain(
            'meaning1',
        );
    });

    it('points a meaning at a single name or one side of a twin pair', () => {
        expect(meanings.tableName).toBe('meanings');
        expect(Object.keys(meanings.getAttributes()).sort()).toEqual([
            'createdAt',
            'id',
            'nameId',
            'slot',
            'sourceId',
            'status',
            'text',
            'twinNameId',
            'updatedAt',
        ]);
        expect(meanings.getAttributes().twinNameId.field).toBe('twin_name_id');
    });

    it('proposes a meaning rather than publishing it', () => {
        expect(meanings.getAttributes().status.defaultValue).toBe('candidate');
    });

    it('gathers the rows a reviewer decides about together', () => {
        expect(clusters.tableName).toBe('clusters');
        expect(Object.keys(clusters.getAttributes()).sort()).toEqual([
            'createdAt',
            'gender',
            'id',
            'name',
            'sortKey',
            'updatedAt',
        ]);
        expect(clusters.getAttributes().sortKey.field).toBe('sort_key');
    });

    // Name alone would pool Abi the boy with Abi the girl, whose readings
    // disagree in all 121 groups that span both genders.
    it('keys a cluster on the gender as well as the spelling', () => {
        expect(clusters.getAttributes().gender.allowNull).toBe(false);
        expect(clusters.getAttributes().name.allowNull).toBe(false);
    });

    it('points a catalogue row at its cluster', () => {
        expect(names.getAttributes().clusterId.field).toBe('cluster_id');
    });

    it('records a transition rather than a state', () => {
        expect(verifications.tableName).toBe('verifications');
        expect(Object.keys(verifications.getAttributes()).sort()).toEqual([
            'actorId',
            'createdAt',
            'fromStatus',
            'id',
            'meaningId',
            'nameId',
            'reason',
            'toStatus',
        ]);
        expect(verifications.getAttributes().fromStatus.field).toBe(
            'from_status',
        );
    });

    // A ledger entry is written once and never revised.
    it('keeps no updated_at on a verification', () => {
        expect(Object.keys(verifications.getAttributes())).not.toContain(
            'updatedAt',
        );
    });

    it('attributes a decision to a reviewer unless the pipeline made it', () => {
        expect(verifications.getAttributes().actorId.allowNull).not.toBe(false);
        expect(verifications.getAttributes().reason.defaultValue).toBe(
            'decision',
        );
    });

    it('reads the source each row was imported from', () => {
        expect(sources.tableName).toBe('sources');
        expect(sources.getAttributes().scannedAt.field).toBe('scanned_at');
        expect(sources.getAttributes().trust.defaultValue).toBe(50);
    });
});
