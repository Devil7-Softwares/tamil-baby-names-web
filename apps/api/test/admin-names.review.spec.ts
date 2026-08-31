import { NameStatus } from '@tbn/shared';
import { Op, Sequelize, Transaction } from 'sequelize';
import { describe, expect, it } from 'vitest';

import { AdminNamesService } from '../src/admin/names/admin-names.service.js';
import { LookupsService } from '../src/database/lookups.service.js';
import {
    ClustersModel,
    IMeaning,
    MeaningsModel,
    NamesModel,
    SourcesModel,
    VerificationDraft,
    VerificationsModel,
} from '../src/database/models.js';
import { SortCollationService } from '../src/database/sort-collation.service.js';

const ACTOR = 7;

const meaning = (id: number, status: NameStatus, nameId = 1): IMeaning => ({
    id,
    nameId,
    twinNameId: null,
    slot: 1,
    text: `reading ${id}`,
    sourceId: null,
    status,
    createdAt: new Date(0),
    updatedAt: new Date(0),
});

/** One write the service issued, in the order it issued them. */
interface Write {
    table: 'names' | 'meanings';
    values: { status?: NameStatus };
    where: Record<string, unknown>;
    transaction: unknown;
}

const transaction = {
    LOCK: { UPDATE: 'UPDATE' },
} as unknown as Transaction;

const build = (rows: IMeaning[]) => {
    const writes: Write[] = [];
    const locked: unknown[] = [];
    const ledger: VerificationDraft[] = [];
    const ledgerTransactions: unknown[] = [];

    const meanings = {
        findByPk: async (id: number) => {
            const row = rows.find((candidate) => candidate.id === id);

            return row ? { dataValues: row } : null;
        },
        findAll: async (options: { where: unknown; lock?: unknown }) => {
            locked.push(options.lock);

            return rows.map((row) => ({ dataValues: row }));
        },
        update: async (
            values: { status?: NameStatus },
            options: { where: Record<string, unknown>; transaction: unknown },
        ) => {
            writes.push({ table: 'meanings', values, ...options });

            return [1];
        },
    } as unknown as MeaningsModel;

    // A fixture with no readings stands in for a database with no rows at all,
    // which is how the catalogue lookups tell a missing row from a present one.
    const names = {
        findByPk: async (id: number) =>
            rows.length
                ? { dataValues: { id, status: 'published' as NameStatus } }
                : null,
        update: async (
            values: { status?: NameStatus },
            options: { where: Record<string, unknown>; transaction?: unknown },
        ) => {
            writes.push({
                table: 'names',
                values,
                where: options.where,
                transaction: options.transaction,
            });

            return [rows.length ? 1 : 0];
        },
    } as unknown as NamesModel;

    const verifications = {
        bulkCreate: async (
            entries: VerificationDraft[],
            options: { transaction: unknown },
        ) => {
            ledger.push(...entries);
            ledgerTransactions.push(options.transaction);

            return [];
        },
    } as unknown as VerificationsModel;

    const service = new AdminNamesService(
        {
            transaction: <T>(run: (t: Transaction) => Promise<T>) =>
                run(transaction),
        } as unknown as Sequelize,
        names,
        meanings,
        { findAll: async () => [] } as unknown as ClustersModel,
        { findAll: async () => [] } as unknown as SourcesModel,
        verifications,
        {
            labels: async () => ({
                religions: new Map(),
                languages: new Map(),
            }),
        } as unknown as LookupsService,
        { order: () => [] } as unknown as SortCollationService,
    );

    return { service, writes, locked, ledger, ledgerTransactions };
};

describe('AdminNamesService.setMeaningStatus', () => {
    it('demotes the incumbent before promoting, which the unique index requires', async () => {
        const { service, writes } = build([
            meaning(1, 'published'),
            meaning(2, 'candidate'),
        ]);

        await service.setMeaningStatus({ id: 2, status: 'published' }, ACTOR);

        expect(writes).toEqual([
            {
                table: 'meanings',
                values: { status: 'candidate' },
                where: { id: { [Op.in]: [1] } },
                transaction,
            },
            {
                table: 'meanings',
                values: { status: 'published' },
                where: { id: 2 },
                transaction,
            },
        ]);
    });

    it('returns the incumbent to the pool rather than rejecting it', async () => {
        const { service } = build([
            meaning(1, 'published'),
            meaning(2, 'candidate'),
        ]);

        const updated = await service.setMeaningStatus(
            { id: 2, status: 'published' },
            ACTOR,
        );

        expect(updated?.meanings).toEqual([
            {
                id: 2,
                text: 'reading 2',
                status: 'published',
                source: null,
                nameId: 1,
            },
            {
                id: 1,
                text: 'reading 1',
                status: 'candidate',
                source: null,
                nameId: 1,
            },
        ]);
    });

    it('locks the subject’s readings so two reviewers cannot both promote', async () => {
        const { service, locked } = build([
            meaning(1, 'published'),
            meaning(2, 'candidate'),
        ]);

        await service.setMeaningStatus({ id: 2, status: 'published' }, ACTOR);

        expect(locked).toEqual(['UPDATE']);
    });

    it('leaves the other readings alone when rejecting one', async () => {
        const { service, writes, locked } = build([
            meaning(1, 'published'),
            meaning(2, 'candidate'),
        ]);

        const updated = await service.setMeaningStatus(
            { id: 2, status: 'rejected' },
            ACTOR,
        );

        expect(locked).toEqual([]);
        expect(writes).toEqual([
            {
                table: 'meanings',
                values: { status: 'rejected' },
                where: { id: 2 },
                transaction,
            },
        ]);
        expect(updated?.meanings).toHaveLength(1);
    });

    it('promotes a reading that is already the only one without displacing itself', async () => {
        const { service, writes } = build([meaning(1, 'published')]);

        const updated = await service.setMeaningStatus(
            { id: 1, status: 'published' },
            ACTOR,
        );

        expect(writes).toEqual([
            {
                table: 'meanings',
                values: { status: 'published' },
                where: { id: 1 },
                transaction,
            },
        ]);
        expect(updated?.meanings).toHaveLength(1);
    });

    it('reports an unknown reading rather than writing anything', async () => {
        const { service, writes, ledger } = build([meaning(1, 'published')]);

        expect(
            await service.setMeaningStatus(
                { id: 99, status: 'published' },
                ACTOR,
            ),
        ).toBeNull();
        expect(writes).toEqual([]);
        expect(ledger).toEqual([]);
    });
});

describe('AdminNamesService verification ledger', () => {
    it('records the reading a reviewer judged, and where it moved from', async () => {
        const { service, ledger } = build([meaning(1, 'candidate')]);

        await service.setMeaningStatus({ id: 1, status: 'rejected' }, ACTOR);

        expect(ledger).toEqual([
            {
                meaningId: 1,
                fromStatus: 'candidate',
                toStatus: 'rejected',
                actorId: ACTOR,
            },
        ]);
    });

    // The incumbent went back to the pool because someone else was promoted,
    // not because a reviewer looked at it.
    it('separates the reading nobody judged from the decision that displaced it', async () => {
        const { service, ledger } = build([
            meaning(1, 'published'),
            meaning(2, 'candidate'),
        ]);

        await service.setMeaningStatus({ id: 2, status: 'published' }, ACTOR);

        expect(ledger).toEqual([
            {
                meaningId: 2,
                fromStatus: 'candidate',
                toStatus: 'published',
                actorId: ACTOR,
            },
            {
                meaningId: 1,
                fromStatus: 'published',
                toStatus: 'candidate',
                reason: 'displacement',
                actorId: ACTOR,
            },
        ]);
    });

    it('writes the entry in the transaction that made the change', async () => {
        const { service, ledgerTransactions } = build([
            meaning(1, 'candidate'),
        ]);

        await service.setMeaningStatus({ id: 1, status: 'published' }, ACTOR);

        expect(ledgerTransactions).toEqual([transaction]);
    });

    it('records a catalogue row the same way', async () => {
        const { service, ledger } = build([meaning(1, 'published')]);

        await service.setStatus({ id: 5, status: 'rejected' }, ACTOR);

        expect(ledger).toEqual([
            {
                nameId: 5,
                fromStatus: 'published',
                toStatus: 'rejected',
                actorId: ACTOR,
            },
        ]);
    });
});

describe('AdminNamesService.setStatus', () => {
    it('echoes the status it stored', async () => {
        const { service, writes } = build([meaning(1, 'published')]);

        expect(
            await service.setStatus({ id: 5, status: 'rejected' }, ACTOR),
        ).toEqual({
            id: 5,
            status: 'rejected',
        });
        expect(writes).toEqual([
            {
                table: 'names',
                values: { status: 'rejected' },
                where: { id: 5 },
                transaction,
            },
        ]);
    });

    it('reports a row that no longer exists', async () => {
        const { service, ledger } = build([]);

        expect(
            await service.setStatus({ id: 5, status: 'rejected' }, ACTOR),
        ).toBeNull();
        expect(ledger).toEqual([]);
    });
});
