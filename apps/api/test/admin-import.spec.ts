import { createHash } from 'node:crypto';

import { Sequelize } from 'sequelize';
import { describe, expect, it } from 'vitest';

import { AdminImportService } from '../src/admin/import/admin-import.service.js';
import {
    ClustersModel,
    LookupModel,
    MeaningsModel,
    NamesModel,
    SourcesModel,
} from '../src/database/models.js';

const batch = {
    source: { slug: 'nithra', kind: 'app' },
    names: [
        {
            name: 'அறிவு',
            gender: 'boy',
            religion: 'hindu',
            language: 'tamil',
            meanings: ['அறிவு'],
        },
    ],
};

const build = () => {
    const sources: Array<{ checksum: string | null }> = [];
    let rolledBack = false;

    const service = new AdminImportService(
        {
            transaction: async (run: (transaction: unknown) => unknown) => {
                try {
                    return await run({});
                } catch (error) {
                    rolledBack = true;

                    throw error;
                }
            },
        } as unknown as Sequelize,
        {
            findOne: async () => null,
            create: async (draft: Record<string, unknown>) => ({
                dataValues: { ...draft, id: 1 },
            }),
        } as unknown as NamesModel,
        {
            findAll: async () => [],
            bulkCreate: async () => [],
        } as unknown as MeaningsModel,
        {
            findOrCreate: async () => [{ dataValues: { id: 9 } }, true],
        } as unknown as ClustersModel,
        {
            findOrCreate: async () => [{ dataValues: { id: 3 } }, true],
            update: async (values: { checksum: string | null }) => {
                sources.push(values);

                return [1];
            },
        } as unknown as SourcesModel,
        {
            findAll: async () => [{ id: 1, slug: 'hindu', name: 'இந்து' }],
        } as unknown as LookupModel,
        {
            findAll: async () => [{ id: 1, slug: 'tamil', name: 'தமிழ்' }],
        } as unknown as LookupModel,
    );

    return { service, sources, rolledBack: () => rolledBack };
};

describe('AdminImportService', () => {
    it('imports a batch and reports what it did', async () => {
        const { service } = build();

        const outcome = await service.run({
            content: JSON.stringify(batch),
            dryRun: false,
        });

        expect(outcome).toEqual({
            report: {
                source: 'nithra',
                clusters: 1,
                names: 1,
                meanings: 1,
                unchanged: 0,
                rejected: [],
            },
        });
    });

    // The dashboard sends the file's text, so the checksum on the source row is
    // the one the command line computes for the same bytes.
    it('records what the file itself hashed to', async () => {
        const { service, sources } = build();
        const content = JSON.stringify(batch);

        await service.run({ content, dryRun: false });

        expect(sources[0].checksum).toBe(
            createHash('sha256').update(content).digest('hex'),
        );
    });

    it('rolls a dry run back and still says what it would have done', async () => {
        const { service, rolledBack } = build();

        const outcome = await service.run({
            content: JSON.stringify(batch),
            dryRun: true,
        });

        expect(outcome).toMatchObject({ report: { names: 1 } });
        expect(rolledBack()).toBe(true);
    });

    it('names what is wrong with a file it cannot read', async () => {
        const { service } = build();

        expect(
            await service.run({ content: 'not json', dryRun: true }),
        ).toEqual({ unreadable: 'The file is not valid JSON.' });
    });

    it('names what is wrong with a batch that is the wrong shape', async () => {
        const { service } = build();

        const outcome = await service.run({
            content: JSON.stringify({ names: [] }),
            dryRun: true,
        });

        expect(outcome).toHaveProperty('unreadable');
        expect((outcome as { unreadable: string }).unreadable).toContain(
            'source',
        );
    });
});
