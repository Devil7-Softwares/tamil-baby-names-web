import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDocumentTitleByFilter, getStateFromParams } from '@tbn/shared';
import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { brotliCompressSync } from 'zlib';

import { AppModule } from '../src/app.module.js';
import { DatabaseBootstrap } from '../src/database/database.bootstrap.js';
import { appOptions, configureApp } from '../src/setup.js';

const publicDir = mkdtempSync(join(tmpdir(), 'tbn-public-'));
const adminDir = mkdtempSync(join(tmpdir(), 'tbn-admin-'));

const indexHtml =
    '<!doctype html><html><head><title>Tamil Baby Names</title></head><body><div id="root"></div></body></html>';

const adminIndexHtml =
    '<!doctype html><html><head><title>Tamil Baby Names Admin</title></head><body><div id="root"></div></body></html>';

writeFileSync(join(publicDir, 'index.html'), indexHtml);
mkdirSync(join(publicDir, 'assets'));
writeFileSync(join(publicDir, 'assets', 'app.js'), 'console.log("app");');
writeFileSync(
    join(publicDir, 'assets', 'app.js.br'),
    brotliCompressSync(Buffer.from('console.log("app");')),
);

writeFileSync(join(adminDir, 'index.html'), adminIndexHtml);
mkdirSync(join(adminDir, 'assets'));
writeFileSync(
    join(adminDir, 'assets', 'dashboard.js'),
    'console.log("dashboard");',
);

const title = (body: string) => /<title>(.*?)<\/title>/.exec(body)?.[1] ?? null;

describe('the single page app', () => {
    let app: INestApplication;

    beforeAll(async () => {
        process.env.PUBLIC_DIR = publicDir;
        process.env.ADMIN_PUBLIC_DIR = adminDir;

        const module = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideProvider(DatabaseBootstrap)
            .useValue({
                onApplicationBootstrap: () => undefined,
                isConnected: false,
            })
            .compile();

        app = configureApp(
            module.createNestApplication({ ...appOptions, logger: false }),
        );

        await app.init();
    });

    afterAll(async () => {
        await app.close();
        delete process.env.PUBLIC_DIR;
        delete process.env.ADMIN_PUBLIC_DIR;
    });

    it('answers the root with the page', async () => {
        const response = await request(app.getHttpServer()).get('/');

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toContain('text/html');
        expect(response.headers['cache-control']).toBe('no-cache');
        expect(title(response.text)).toBe('Tamil Baby Names');
    });

    it('answers a route the client owns with the same page', async () => {
        const response = await request(app.getHttpServer()).get('/names');

        expect(response.status).toBe(200);
        expect(response.text).toBe(indexHtml);
    });

    it('writes the title the filters describe into the page', async () => {
        const search = 'gender=boy&religion=hindu&twinNames=true';

        const response = await request(app.getHttpServer()).get(
            `/names?${search}`,
        );

        const expected = getDocumentTitleByFilter(
            getStateFromParams(new URLSearchParams(search)),
        );

        expect(expected).not.toBe('Tamil Baby Names');
        expect(title(response.text)).toBe(expected);
    });

    it('serves the files the page asks for', async () => {
        const response = await request(app.getHttpServer()).get(
            '/assets/app.js',
        );

        expect(response.status).toBe(200);
        expect(response.text).toBe('console.log("app");');
    });

    it('prefers the brotli copy when the browser takes it', async () => {
        const response = await request(app.getHttpServer())
            .get('/assets/app.js')
            .set('Accept-Encoding', 'br');

        expect(response.status).toBe(200);
        expect(response.headers['content-encoding']).toBe('br');
    });

    it('leaves the api alone', async () => {
        const response = await request(app.getHttpServer()).get('/api/health');

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
    });

    it('does not answer an unknown api route with the page', async () => {
        const response = await request(app.getHttpServer()).get(
            '/api/nothing-here',
        );

        expect(response.status).toBe(404);
        expect(response.text).not.toContain('id="root"');
    });

    it('does not answer a post with the page', async () => {
        const response = await request(app.getHttpServer()).post('/names');

        expect(response.status).toBe(404);
    });

    describe('the dashboard under /admin', () => {
        it('redirects the bare prefix so relative urls resolve', async () => {
            const response = await request(app.getHttpServer()).get('/admin');

            expect(response.status).toBe(301);
            expect(response.headers.location).toBe('/admin/');
        });

        it('answers the prefix with the dashboard, not the public page', async () => {
            const response = await request(app.getHttpServer()).get('/admin/');

            expect(response.status).toBe(200);
            expect(title(response.text)).toBe('Tamil Baby Names Admin');
        });

        it('answers a route the dashboard owns with the same page', async () => {
            const response = await request(app.getHttpServer()).get(
                '/admin/login',
            );

            expect(response.status).toBe(200);
            expect(response.text).toBe(adminIndexHtml);
        });

        it('serves the dashboard files from under the prefix', async () => {
            const response = await request(app.getHttpServer()).get(
                '/admin/assets/dashboard.js',
            );

            expect(response.status).toBe(200);
            expect(response.text).toBe('console.log("dashboard");');
        });

        it('keeps the two clients apart', async () => {
            const mine = await request(app.getHttpServer()).get(
                '/admin/assets/app.js',
            );

            // The public client's bundle is not the dashboard's to serve, so
            // the dashboard's own page comes back instead.
            expect(mine.text).toBe(adminIndexHtml);

            const theirs = await request(app.getHttpServer()).get(
                '/assets/app.js',
            );

            expect(theirs.text).toBe('console.log("app");');
        });

        it('still leaves the api alone', async () => {
            const response = await request(app.getHttpServer()).get(
                '/api/health',
            );

            expect(response.status).toBe(200);
        });
    });
});
