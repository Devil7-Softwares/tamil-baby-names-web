import { describe, expect, it, vi } from 'vitest';

import { DatabaseBootstrap } from '../src/database/database.bootstrap.js';
import { NamesBootstrap } from '../src/names/names.bootstrap.js';
import { NumerologyColumnsService } from '../src/names/numerology-columns.service.js';
import { SortCollationService } from '../src/names/sort-collation.service.js';

const bootstrapWith = (connected: boolean) => {
    const prepare = vi.fn().mockResolvedValue(undefined);
    const resolve = vi.fn().mockResolvedValue(undefined);

    const bootstrap = new NamesBootstrap(
        { ready: Promise.resolve(connected) } as DatabaseBootstrap,
        { prepare } as unknown as NumerologyColumnsService,
        { resolve } as unknown as SortCollationService,
    );

    return { bootstrap, prepare, resolve };
};

describe('NamesBootstrap', () => {
    it('prepares the schema once the database answers', async () => {
        const { bootstrap, prepare, resolve } = bootstrapWith(true);

        bootstrap.onApplicationBootstrap();

        await vi.waitFor(() => expect(resolve).toHaveBeenCalled());

        expect(prepare).toHaveBeenCalled();
    });

    it('prepares nothing when the database never came up', async () => {
        const { bootstrap, prepare, resolve } = bootstrapWith(false);

        bootstrap.onApplicationBootstrap();

        await Promise.resolve();
        await Promise.resolve();

        expect(prepare).not.toHaveBeenCalled();
        expect(resolve).not.toHaveBeenCalled();
    });
});
