import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { IFilterData, IName } from '@tbn/shared';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { AuthModule } from '../src/auth/auth.module.js';
import { validateEnv } from '../src/config/env.js';
import { NamesController } from '../src/names/names.controller.js';
import { NamesService } from '../src/names/names.service.js';
import { appOptions, configureApp } from '../src/setup.js';

const SECRET = 'test-secret';

const filters: IFilterData = {
    gender: 'boy',
    startsWithMode: 'manual',
    startsWith: ['அ'],
    tob: '',
    tz: 'Asia/Kolkata',
    panjangam: 'thirukanitha',
    numerology: 'chaldean',
};

const rows = [
    { id: 1, name: 'அறிவு', nameNumber: 5 },
    { id: 2, name: 'அன்பு', nameNumber: 3 },
] as IName[];

const getNamesForFilter = vi.fn();
const getFirstLetters = vi.fn();

describe('names', () => {
    let app: INestApplication;

    const cookie = () => `accessToken=${jwt.sign(filters, SECRET)}`;

    beforeAll(async () => {
        const module = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
                AuthModule,
            ],
            controllers: [NamesController],
            providers: [
                {
                    provide: NamesService,
                    useValue: { getNamesForFilter, getFirstLetters },
                },
            ],
        }).compile();

        app = configureApp(
            module.createNestApplication({ ...appOptions, logger: false }),
        );

        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(() => {
        getNamesForFilter.mockReset();
        getFirstLetters.mockReset();
    });

    describe('GET /api/names', () => {
        it('refuses a request that carries no token', async () => {
            const response = await request(app.getHttpServer()).get(
                '/api/names',
            );

            expect(response.status).toBe(401);
            expect(getNamesForFilter).not.toHaveBeenCalled();
        });

        it('answers with the rows and the filters they came from', async () => {
            getNamesForFilter.mockResolvedValue([rows, 42]);

            const response = await request(app.getHttpServer())
                .get('/api/names')
                .set('Cookie', cookie());

            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                success: true,
                message: 'Names fetched successfully!',
                data: rows,
                total: 42,
                filters,
            });
        });

        it('reads the first page of 25 when none was asked for', async () => {
            getNamesForFilter.mockResolvedValue([[], 0]);

            await request(app.getHttpServer())
                .get('/api/names')
                .set('Cookie', cookie());

            expect(getNamesForFilter).toHaveBeenCalledWith(filters, 1, 25);
        });

        it('reads the page it was asked for', async () => {
            getNamesForFilter.mockResolvedValue([[], 0]);

            await request(app.getHttpServer())
                .get('/api/names')
                .query({ page: 3, limit: 10 })
                .set('Cookie', cookie());

            expect(getNamesForFilter).toHaveBeenCalledWith(filters, 3, 10);
        });

        it('reports a database that did not answer', async () => {
            getNamesForFilter.mockRejectedValue(new Error('connection lost'));

            const response = await request(app.getHttpServer())
                .get('/api/names')
                .set('Cookie', cookie());

            expect(response.status).toBe(500);
            expect(response.body).toEqual({
                success: false,
                message: 'Database connection failed!',
            });
        });
    });

    describe('POST /api/letters', () => {
        it('answers without a token, since the filters are still being built', async () => {
            getFirstLetters.mockResolvedValue(['அ', 'ஆ']);

            const response = await request(app.getHttpServer())
                .post('/api/letters')
                .send({ gender: 'boy' });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                success: true,
                message: 'Names fetched successfully!',
                data: ['அ', 'ஆ'],
            });
            expect(getFirstLetters).toHaveBeenCalledWith({ gender: 'boy' });
        });

        it('reports a database that did not answer', async () => {
            getFirstLetters.mockRejectedValue(new Error('connection lost'));

            const response = await request(app.getHttpServer())
                .post('/api/letters')
                .send({});

            expect(response.status).toBe(500);
            expect(response.body).toEqual({
                success: false,
                message: 'Database connection failed!',
            });
        });
    });
});
