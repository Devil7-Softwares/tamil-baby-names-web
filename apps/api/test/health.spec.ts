import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';

describe('health', () => {
    let app: INestApplication;

    beforeAll(async () => {
        const module = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = configureApp(module.createNestApplication());

        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    it('answers on the prefixed route', async () => {
        const response = await request(app.getHttpServer()).get('/api/health');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: 'ok' });
    });

    it('does not answer without the prefix', async () => {
        const response = await request(app.getHttpServer()).get('/health');

        expect(response.status).toBe(404);
    });
});
