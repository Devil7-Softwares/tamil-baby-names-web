import { describe, expect, it } from 'vitest';

import { ClusterReader, knownNames } from '../src/database/known-names.js';

type FindOptions = {
    attributes?: string[];
    order?: [string, string][];
    raw?: boolean;
};

const clusters = (rows: Record<string, unknown>[]) => {
    const asked: FindOptions[] = [];

    return {
        asked,
        model: {
            findAll: async (options: FindOptions) => {
                asked.push(options);

                return rows;
            },
        } as ClusterReader,
    };
};

describe('knownNames', () => {
    it('gives a spelling and a gender per cluster, and nothing else', async () => {
        const { model } = clusters([
            { name: 'அபி', gender: 'girl', sortKey: 'அபி', id: 3 },
            { name: 'அபி', gender: 'boy', sortKey: 'அபி', id: 4 },
        ]);

        expect(await knownNames(model)).toEqual([
            { name: 'அபி', gender: 'girl' },
            { name: 'அபி', gender: 'boy' },
        ]);
    });

    it('asks the database for the two columns only, in catalogue order', async () => {
        const { model, asked } = clusters([]);

        await knownNames(model);

        expect(asked[0]).toMatchObject({
            attributes: ['name', 'gender'],
            order: [
                ['sortKey', 'ASC'],
                ['gender', 'ASC'],
            ],
        });
    });

    it('does not filter on review status', async () => {
        const { model, asked } = clusters([]);

        await knownNames(model);

        expect(asked[0]).not.toHaveProperty('where');
    });
});
