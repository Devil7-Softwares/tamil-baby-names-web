import { Global, INestApplication, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { hash } from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AdminModule } from '../src/admin/admin.module.js';
import { AdminBootstrapService } from '../src/admin/users/admin-bootstrap.service.js';
import { validateEnv } from '../src/config/env.js';
import {
    ADMIN_USERS_MODEL,
    CLUSTERS_MODEL,
    LANGUAGES_MODEL,
    MEANINGS_MODEL,
    NAMES_MODEL,
    RELIGIONS_MODEL,
    SEQUELIZE,
    SOURCES_MODEL,
    VERIFICATIONS_MODEL,
} from '../src/database/database.constants.js';
import { LookupsService } from '../src/database/lookups.service.js';
import { IAdminUser } from '../src/database/models.js';
import { SortCollationService } from '../src/database/sort-collation.service.js';
import { appOptions, configureApp } from '../src/setup.js';

const PASSWORD = 'correct horse battery staple';

const admin = {
    id: 7,
    email: 'admin@example.com',
    name: 'Admin',
    role: 'admin',
    createdAt: new Date('2026-01-02T03:04:05Z'),
    updatedAt: new Date('2026-01-02T03:04:05Z'),
} satisfies Omit<IAdminUser, 'passwordHash'>;

const usersModel = (row: IAdminUser | null) => ({
    count: async () => (row ? 1 : 0),
    findByPk: async (id: number) =>
        row && row.id === id ? { get: () => row } : null,
    findOne: async ({ where }: { where: { email: string } }) =>
        row && row.email === where.email ? { get: () => row } : null,
});

const build = async (env: Record<string, string>, row: IAdminUser | null) => {
    // Stands in for the real DatabaseModule, which is global and is what
    // AdminModule resolves the model from.
    // The catalogue tokens are unused by these tests but are what the admin
    // module's other controllers are built from.
    const catalogue = [
        SEQUELIZE,
        NAMES_MODEL,
        MEANINGS_MODEL,
        CLUSTERS_MODEL,
        RELIGIONS_MODEL,
        LANGUAGES_MODEL,
        SOURCES_MODEL,
        VERIFICATIONS_MODEL,
    ];

    @Global()
    @Module({
        providers: [
            { provide: ADMIN_USERS_MODEL, useValue: usersModel(row) },
            ...catalogue.map((token) => ({ provide: token, useValue: {} })),
            { provide: SortCollationService, useValue: { order: () => [] } },
            LookupsService,
        ],
        exports: [
            ADMIN_USERS_MODEL,
            ...catalogue,
            LookupsService,
            SortCollationService,
        ],
    })
    class StubDatabaseModule {}

    const module = await Test.createTestingModule({
        imports: [
            ConfigModule.forRoot({
                isGlobal: true,
                ignoreEnvFile: true,
                load: [() => ({ JWT_SECRET: 'test-secret', ...env })],
                validate: validateEnv,
            }),
            StubDatabaseModule,
            AdminModule,
        ],
    })
        // Reaches for the database on the bootstrap hook, which these tests
        // have no connection for.
        .overrideProvider(AdminBootstrapService)
        .useValue({ onApplicationBootstrap: () => undefined })
        .compile();

    const app = configureApp(
        module.createNestApplication({ ...appOptions, logger: false }),
    );

    await app.init();

    return app;
};

describe('admin auth', () => {
    let app: INestApplication;
    let row: IAdminUser;

    beforeAll(async () => {
        row = { ...admin, passwordHash: await hash(PASSWORD, 4) };
        app = await build({ ADMIN_JWT_SECRET: 'admin-test-secret' }, row);
    });

    afterAll(async () => {
        await app.close();
    });

    it('rejects a login with the wrong password', async () => {
        const response = await request(app.getHttpServer())
            .post('/api/admin/auth/login')
            .send({ email: admin.email, password: 'wrong' });

        expect(response.status).toBe(401);
        expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('rejects a login for an unknown email', async () => {
        const response = await request(app.getHttpServer())
            .post('/api/admin/auth/login')
            .send({ email: 'nobody@example.com', password: PASSWORD });

        expect(response.status).toBe(401);
    });

    it('rejects a malformed email before touching the database', async () => {
        const response = await request(app.getHttpServer())
            .post('/api/admin/auth/login')
            .send({ email: 'not-an-email', password: PASSWORD });

        expect(response.status).toBe(400);
    });

    it('returns the user and an httpOnly session cookie on login', async () => {
        const response = await request(app.getHttpServer())
            .post('/api/admin/auth/login')
            .send({ email: admin.email, password: PASSWORD });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            id: admin.id,
            email: admin.email,
            name: admin.name,
            role: admin.role,
            createdAt: admin.createdAt.toISOString(),
        });
        expect(response.body).not.toHaveProperty('passwordHash');

        const [cookie] = response.headers['set-cookie'];

        expect(cookie).toContain('adminToken=');
        expect(cookie).toContain('HttpOnly');
    });

    it('rejects /me without a session', async () => {
        const response = await request(app.getHttpServer()).get(
            '/api/admin/auth/me',
        );

        expect(response.status).toBe(401);
    });

    it('rejects /me with a session signed by another key', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/admin/auth/me')
            .set('Cookie', ['adminToken=not.a.token']);

        expect(response.status).toBe(401);
    });

    it('rejects the catalogue without a session', async () => {
        const response = await request(app.getHttpServer()).get(
            '/api/admin/names',
        );

        expect(response.status).toBe(401);
    });

    it('resolves /me from the session cookie', async () => {
        const agent = request.agent(app.getHttpServer());

        await agent
            .post('/api/admin/auth/login')
            .send({ email: admin.email, password: PASSWORD });

        const response = await agent.get('/api/admin/auth/me');

        expect(response.status).toBe(200);
        expect(response.body.email).toBe(admin.email);
    });

    it('clears the session cookie on logout', async () => {
        const response = await request(app.getHttpServer()).post(
            '/api/admin/auth/logout',
        );

        expect(response.status).toBe(200);
        expect(response.headers['set-cookie'][0]).toContain('adminToken=;');
    });

    describe('without ADMIN_JWT_SECRET', () => {
        let offline: INestApplication;

        beforeAll(async () => {
            offline = await build({}, row);
        });

        afterAll(async () => {
            await offline.close();
        });

        it('reports the admin area as unavailable instead of signing in', async () => {
            const response = await request(offline.getHttpServer())
                .post('/api/admin/auth/login')
                .send({ email: admin.email, password: PASSWORD });

            expect(response.status).toBe(503);
        });

        it('refuses /me', async () => {
            const response = await request(offline.getHttpServer()).get(
                '/api/admin/auth/me',
            );

            expect(response.status).toBe(503);
        });

        it('refuses the catalogue', async () => {
            const response = await request(offline.getHttpServer()).get(
                '/api/admin/names',
            );

            expect(response.status).toBe(503);
        });
    });
});
