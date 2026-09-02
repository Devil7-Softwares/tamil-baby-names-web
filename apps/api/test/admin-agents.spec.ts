import { randomBytes } from 'node:crypto';

import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';

import { AdminAgentsService } from '../src/admin/agents/admin-agents.service.js';
import { open } from '../src/agents/agent-keys.js';
import { AgentsService } from '../src/agents/agents.service.js';
import { AgentsModel, IAgent } from '../src/database/models.js';

const SECRET = randomBytes(32).toString('base64');

const agent = (over: Partial<IAgent> = {}): IAgent => ({
    id: 1,
    slug: 'claude',
    name: 'Claude',
    provider: 'anthropic',
    baseUrl: null,
    model: 'claude-opus-5',
    keyCiphertext: null,
    keyIv: null,
    keyTag: null,
    options: {},
    enabled: true,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...over,
});

/** An in-memory `agents` table, enough for what the service does to one. */
// `undefined` as an argument selects a default parameter, so "no secret" has
// to be said with a value of its own.
const NO_SECRET = null;

const build = (rows: IAgent[] = [], secret: string | null = SECRET) => {
    const store = [...rows];
    let nextId = store.length + 1;

    const model = {
        findAll: async () => store.map((dataValues) => ({ dataValues })),
        findByPk: async (id: number) => {
            const found = store.find((row) => row.id === id);

            return found ? { dataValues: found } : null;
        },
        findOne: async ({ where }: { where: { slug: string } }) => {
            const found = store.find((row) => row.slug === where.slug);

            return found ? { dataValues: found } : null;
        },
        create: async (draft: Partial<IAgent>) => {
            const row = agent({ ...draft, id: nextId++ });

            store.push(row);

            return { dataValues: row };
        },
        update: async (
            values: Partial<IAgent>,
            { where }: { where: { id: number } },
        ) => {
            const index = store.findIndex((row) => row.id === where.id);

            store[index] = { ...store[index], ...values };

            return [1];
        },
        destroy: async ({ where }: { where: { id: number } }) => {
            const index = store.findIndex((row) => row.id === where.id);

            if (index < 0) {
                return 0;
            }

            store.splice(index, 1);

            return 1;
        },
    } as unknown as AgentsModel;

    const runtime = new AgentsService(model, {
        get: () => secret ?? undefined,
    } as unknown as ConfigService);

    return { service: new AdminAgentsService(model, runtime), store };
};

const created = {
    name: 'Claude',
    provider: 'anthropic' as const,
    model: 'claude-opus-5',
    baseUrl: null,
    options: {},
    enabled: true,
};

describe('configuring an agent', () => {
    it('seals the key and never hands it back', async () => {
        const { service, store } = build();

        const saved = await service.create({ ...created, apiKey: 'sk-secret' });

        expect(saved).not.toHaveProperty('apiKey');
        expect(saved.hasKey).toBe(true);
        expect(store[0].keyCiphertext?.toString('utf8')).not.toContain(
            'sk-secret',
        );
        expect(
            open(SECRET, {
                keyCiphertext: store[0].keyCiphertext as Buffer,
                keyIv: store[0].keyIv as Buffer,
                keyTag: store[0].keyTag as Buffer,
            }),
        ).toBe('sk-secret');
    });

    it('names a row after what it is called', async () => {
        const { service } = build();

        expect(
            (await service.create({ ...created, name: 'Claude Opus 5' })).slug,
        ).toBe('claude-opus-5');
    });

    // Two agents may share a display name; their slugs cannot, because an
    // agent's own readings are attributed to a source named after it.
    it('does not reuse a slug', async () => {
        const { service } = build([agent({ slug: 'claude' })]);

        expect((await service.create(created)).slug).toBe('claude-2');
    });

    it('refuses to save a key it cannot seal', async () => {
        const { service } = build([], NO_SECRET);

        await expect(
            service.create({ ...created, apiKey: 'sk-secret' }),
        ).rejects.toThrow(/AGENT_KEY_SECRET is not set/);
    });

    it('saves an agent that needs no key without the secret', async () => {
        const { service } = build([], NO_SECRET);

        const saved = await service.create({
            ...created,
            name: 'Local',
            provider: 'ollama',
            model: 'qwen3:8b',
        });

        expect(saved.hasKey).toBe(false);
    });
});

describe('changing an agent', () => {
    it('leaves the saved key alone when none is sent', async () => {
        const { service, store } = build();

        await service.create({ ...created, apiKey: 'sk-secret' });

        const before = store[0].keyCiphertext;

        const saved = await service.update({ id: 1, model: 'claude-sonnet-5' });

        expect(saved?.model).toBe('claude-sonnet-5');
        expect(saved?.hasKey).toBe(true);
        expect(store[0].keyCiphertext).toBe(before);
    });

    it('replaces the key when a new one is sent', async () => {
        const { service, store } = build();

        await service.create({ ...created, apiKey: 'sk-first' });

        const before = store[0].keyCiphertext;

        await service.update({ id: 1, apiKey: 'sk-second' });

        expect(store[0].keyCiphertext).not.toBe(before);
        expect(
            open(SECRET, {
                keyCiphertext: store[0].keyCiphertext as Buffer,
                keyIv: store[0].keyIv as Buffer,
                keyTag: store[0].keyTag as Buffer,
            }),
        ).toBe('sk-second');
    });

    it('clears the key when told to', async () => {
        const { service, store } = build();

        await service.create({ ...created, apiKey: 'sk-secret' });
        await service.update({ id: 1, apiKey: null });

        expect(store[0].keyCiphertext).toBeNull();
        expect(store[0].keyIv).toBeNull();
        expect(store[0].keyTag).toBeNull();
    });

    // The slug is what an agent's own readings are attributed to, so a rename
    // must not orphan them.
    it('keeps the slug when the name changes', async () => {
        const { service } = build([agent()]);

        expect(
            (await service.update({ id: 1, name: 'Claude, again' }))?.slug,
        ).toBe('claude');
    });

    it('says nothing when there is no such agent', async () => {
        const { service } = build();

        expect(await service.update({ id: 99, name: 'Nobody' })).toBeNull();
        expect(await service.remove(99)).toBeNull();
        expect(await service.check(99)).toBeNull();
    });
});

describe('what the dashboard is told about providers', () => {
    it('marks a keyed provider unusable while no secret is set', () => {
        const { service } = build([], NO_SECRET);

        const { canSealKeys, providers } = service.providers();
        const usable = Object.fromEntries(
            providers.map(({ id, usable: can }) => [id, can]),
        );

        expect(canSealKeys).toBe(false);
        expect(usable).toEqual({
            anthropic: false,
            openai: false,
            ollama: true,
        });
    });

    it('marks them all usable once one is', () => {
        const { service } = build();

        expect(
            service.providers().providers.every(({ usable }) => usable),
        ).toBe(true);
    });
});
