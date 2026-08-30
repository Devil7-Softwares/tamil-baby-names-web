import { oc } from '@orpc/contract';

import { LoginSchema } from '../schemas/LoginSchema.js';
import { MessageResponseSchema } from '../schemas/MessageResponseSchema.js';
import { UserSchema } from '../schemas/UserSchema.js';
import { commonErrors } from './errors.js';

export const adminAuthContract = {
    login: oc
        .route({
            method: 'POST',
            path: '/admin/auth/login',
            summary: 'Log in to the admin dashboard',
        })
        .errors({
            UNAUTHORIZED: { message: 'Invalid email or password.' },
            SERVICE_UNAVAILABLE: commonErrors.SERVICE_UNAVAILABLE,
        })
        .input(LoginSchema)
        .output(UserSchema),

    logout: oc
        .route({
            method: 'POST',
            path: '/admin/auth/logout',
            summary: 'Log out of the admin dashboard',
        })
        .output(MessageResponseSchema),

    me: oc
        .route({
            method: 'GET',
            path: '/admin/auth/me',
            summary: 'Get the signed-in admin user',
        })
        .errors({
            UNAUTHORIZED: commonErrors.UNAUTHORIZED,
            SERVICE_UNAVAILABLE: commonErrors.SERVICE_UNAVAILABLE,
        })
        .output(UserSchema),
};
