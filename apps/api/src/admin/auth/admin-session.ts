import { CookieOptions, Request } from 'express';

import { IAdminUser } from '../../database/models.js';

export const ADMIN_SESSION_COOKIE = 'adminToken';

export interface AdminSession {
    sub: number;
    role: IAdminUser['role'];
}

export interface AdminRequest extends Request {
    adminSession?: AdminSession;
}

export const adminSessionCookieOptions = (
    isProduction: boolean,
): CookieOptions => ({
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 1000 * 60 * 60 * 12,
});
