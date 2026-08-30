import { describe, expect, it, vi } from 'vitest';

import { DatabaseBootstrap } from '../src/database/database.bootstrap.js';
import { SortCollationService } from '../src/database/sort-collation.service.js';
import { NamesBootstrap } from '../src/names/names.bootstrap.js';
import { NumerologyBackfillService } from '../src/names/numerology-backfill.service.js';

const bootstrapWith = (ready: Promise<void>) => {
    const run = vi.fn().mockResolvedValue(undefined);
    const resolve = vi.fn().mockResolvedValue(undefined);

    const bootstrap = new NamesBootstrap(
        { ready } as DatabaseBootstrap,
        { run } as unknown as NumerologyBackfillService,
        { resolve } as unknown as SortCollationService,
    );

    return { bootstrap, run, resolve };
};

describe('NamesBootstrap', () => {
    it('prepares the schema once the database answers', async () => {
        const { bootstrap, run, resolve } = bootstrapWith(Promise.resolve());

        bootstrap.onApplicationBootstrap();

        await vi.waitFor(() => expect(resolve).toHaveBeenCalled());

        expect(run).toHaveBeenCalled();
    });

    it('waits rather than giving up while the database is unreachable', async () => {
        let connect!: () => void;
        const { bootstrap, run, resolve } = bootstrapWith(
            new Promise<void>((r) => {
                connect = r;
            }),
        );

        bootstrap.onApplicationBootstrap();

        await Promise.resolve();
        await Promise.resolve();

        expect(run).not.toHaveBeenCalled();

        // The database turning up later is the case that used to be lost.
        connect();

        await vi.waitFor(() => expect(resolve).toHaveBeenCalled());

        expect(run).toHaveBeenCalled();
    });
});
