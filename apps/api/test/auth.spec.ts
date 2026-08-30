import { Controller, Get, INestApplication, UseGuards } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { IFilterData } from '@tbn/shared';
import axios from 'axios';
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

import { AccessTokenGuard } from '../src/auth/access-token.guard.js';
import { AuthModule } from '../src/auth/auth.module.js';
import { Filters } from '../src/auth/filters.decorator.js';
import { validateEnv } from '../src/config/env.js';
import { configureApp } from '../src/setup.js';

vi.mock('axios', () => ({ default: { post: vi.fn() } }));

const post = vi.mocked(axios.post);

const SECRET = 'test-secret';

const filters: IFilterData = {
    gender: 'boy',
    startsWithMode: 'manual',
    startsWith: ['அ'],
    tob: '2026-08-29T10:00',
    tz: 'Asia/Kolkata',
    panjangam: 'thirukanitha',
    numerology: 'chaldean',
};

@Controller('probe')
class ProbeController {
    @Get()
    @UseGuards(AccessTokenGuard)
    read(@Filters() filters: IFilterData) {
        return filters;
    }
}

describe('auth', () => {
    let app: INestApplication;

    beforeAll(async () => {
        const module = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
                AuthModule,
            ],
            controllers: [ProbeController],
        }).compile();

        app = configureApp(module.createNestApplication({ logger: false }));

        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(() => {
        post.mockReset();
    });

    describe('POST /api/generate', () => {
        it('rejects a request without a captcha token', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/generate')
                .send(filters);

            expect(response.status).toBe(400);
            expect(response.body).toEqual({
                success: false,
                message: 'Invalid request!',
            });
            expect(post).not.toHaveBeenCalled();
        });

        it('rejects a captcha token google does not accept', async () => {
            post.mockResolvedValue({ data: { success: false } });

            const response = await request(app.getHttpServer())
                .post('/api/generate')
                .set('token', 'captcha-token')
                .send(filters);

            expect(response.status).toBe(400);
            expect(response.body).toEqual({
                success: false,
                message: 'CAPTCHA verification failed!',
            });
        });

        it('rejects when the captcha check itself fails', async () => {
            post.mockRejectedValue(new Error('network down'));

            const response = await request(app.getHttpServer())
                .post('/api/generate')
                .set('token', 'captcha-token')
                .send(filters);

            expect(response.status).toBe(400);
            expect(response.body).toEqual({
                success: false,
                message: 'CAPTCHA verification failed!',
            });
        });

        it('issues a cookie carrying the filters it was sent', async () => {
            post.mockResolvedValue({ data: { success: true } });

            const response = await request(app.getHttpServer())
                .post('/api/generate')
                .set('token', 'captcha-token')
                .send(filters);

            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                success: true,
                message: 'Access token generated successfully!',
            });

            expect(post).toHaveBeenCalledWith(
                expect.stringContaining('response=captcha-token'),
            );

            const cookie = response.headers['set-cookie'][0] as string;
            const accessToken = /accessToken=([^;]+)/.exec(cookie)?.[1] ?? '';

            expect(jwt.verify(decodeURIComponent(accessToken), SECRET)).toEqual(
                {
                    ...filters,
                    exp: expect.any(Number),
                    iat: expect.any(Number),
                },
            );
        });
    });

    describe('the access token guard', () => {
        const probe = (accessToken?: string) => {
            const call = request(app.getHttpServer()).get('/api/probe');

            return accessToken
                ? call.set('Cookie', `accessToken=${accessToken}`)
                : call;
        };

        it('reads the filters out of the token', async () => {
            const response = await probe(jwt.sign(filters, SECRET));

            expect(response.status).toBe(200);
            expect(response.body).toEqual(filters);
        });

        it('refuses a request without a token', async () => {
            const response = await probe();

            expect(response.status).toBe(401);
            expect(response.body).toEqual({
                success: false,
                message: 'No token provided!',
            });
        });

        it('refuses a token signed with another secret', async () => {
            const response = await probe(jwt.sign(filters, 'another-secret'));

            expect(response.status).toBe(401);
            expect(response.body).toEqual({
                success: false,
                message: 'Invalid token!',
            });
        });

        it('refuses an expired token', async () => {
            const response = await probe(
                jwt.sign(filters, SECRET, { expiresIn: '-1s' }),
            );

            expect(response.status).toBe(401);
            expect(response.body).toEqual({
                success: false,
                message: 'Token expired!',
            });
        });
    });
});
