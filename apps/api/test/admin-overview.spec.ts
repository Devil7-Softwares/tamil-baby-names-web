import { Sequelize } from 'sequelize';
import { describe, expect, it } from 'vitest';

import { AdminOverviewService } from '../src/admin/overview/admin-overview.service.js';
import {
    AdminUsersModel,
    ClustersModel,
    IVerification,
    MeaningsModel,
    NamesModel,
    VerificationsModel,
} from '../src/database/models.js';

const entry = (overrides: Partial<IVerification>): IVerification => ({
    id: 1,
    nameId: null,
    meaningId: null,
    fromStatus: 'candidate',
    toStatus: 'published',
    reason: 'decision',
    actorId: null,
    createdAt: new Date('2026-08-31T10:00:00Z'),
    ...overrides,
});

const build = ({
    names = [] as Array<{ status: string; count: number }>,
    meanings = [] as Array<{ status: string; count: number }>,
    entries = [] as IVerification[],
}) =>
    new AdminOverviewService(
        {
            query: async () => [{ duplicated: '726' }],
        } as unknown as Sequelize,
        {
            count: async () => names,
            findAll: async () => [{ id: 5, name: 'அகாத்' }],
        } as unknown as NamesModel,
        {
            count: async () => meanings,
            findAll: async () => [{ id: 9, text: 'அழிப்பவர்' }],
        } as unknown as MeaningsModel,
        { count: async () => 10_655 } as unknown as ClustersModel,
        {
            findAll: async () => entries.map((dataValues) => ({ dataValues })),
        } as unknown as VerificationsModel,
        {
            findAll: async () => [{ id: 7, name: 'Admin' }],
        } as unknown as AdminUsersModel,
    );

describe('AdminOverviewService', () => {
    // Grouping returns a row per status that exists, so an empty status has to
    // read as zero rather than as missing.
    it('counts a status nothing sits at as zero', async () => {
        const overview = await build({
            names: [{ status: 'published', count: 11_416 }],
        }).get();

        expect(overview.names).toEqual({
            published: 11_416,
            candidate: 0,
            rejected: 0,
        });
    });

    it('reports the clusters worth reviewing separately from the total', async () => {
        const overview = await build({}).get();

        expect(overview.clusters).toEqual({ total: 10_655, duplicated: 726 });
    });

    it('names the reading a decision was about, and who made it', async () => {
        const overview = await build({
            entries: [entry({ id: 3, meaningId: 9, actorId: 7 })],
        }).get();

        expect(overview.activity).toEqual([
            {
                id: 3,
                kind: 'meaning',
                subject: 'அழிப்பவர்',
                fromStatus: 'candidate',
                toStatus: 'published',
                reason: 'decision',
                actor: 'Admin',
                at: '2026-08-31T10:00:00.000Z',
            },
        ]);
    });

    it('reads a catalogue row’s entry off the other table', async () => {
        const overview = await build({
            entries: [entry({ nameId: 5, toStatus: 'rejected', actorId: 7 })],
        }).get();

        expect(overview.activity[0]).toMatchObject({
            kind: 'name',
            subject: 'அகாத்',
        });
    });

    // Whatever the pipeline decides on its own has no admin user behind it.
    it('leaves the actor unnamed when the ledger has none', async () => {
        const overview = await build({
            entries: [entry({ meaningId: 9 })],
        }).get();

        expect(overview.activity[0].actor).toBeNull();
    });

    it('asks for no subjects when nothing has been decided', async () => {
        const overview = await build({}).get();

        expect(overview.activity).toEqual([]);
    });
});
