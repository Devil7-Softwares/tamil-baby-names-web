import { Controller, UseGuards } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tbn/shared';

import { toPublicUser, UsersService } from '../users/users.service.js';
import { AdminAuthGuard } from './admin-auth.guard.js';
import { AdminAuthService } from './admin-auth.service.js';
import {
    ADMIN_SESSION_COOKIE,
    AdminRequest,
    adminSessionCookieOptions,
} from './admin-session.js';

@Controller()
export class AdminAuthController {
    constructor(
        private readonly auth: AdminAuthService,
        private readonly users: UsersService,
    ) {}

    @Implement(contract.admin.auth.login)
    login() {
        return implement(contract.admin.auth.login).handler(
            async ({ context, errors, input }) => {
                if (!this.auth.isConfigured) {
                    throw errors.SERVICE_UNAVAILABLE();
                }

                const user = await this.auth.verifyCredentials(input);

                if (!user) {
                    throw errors.UNAUTHORIZED();
                }

                context.request.res?.cookie(
                    ADMIN_SESSION_COOKIE,
                    this.auth.sign(user),
                    adminSessionCookieOptions(this.auth.isProduction),
                );

                return toPublicUser(user);
            },
        );
    }

    @Implement(contract.admin.auth.logout)
    logout() {
        return implement(contract.admin.auth.logout).handler(({ context }) => {
            context.request.res?.clearCookie(ADMIN_SESSION_COOKIE, {
                path: '/',
            });

            return { message: 'Logged out' };
        });
    }

    @UseGuards(AdminAuthGuard)
    @Implement(contract.admin.auth.me)
    me() {
        return implement(contract.admin.auth.me).handler(
            async ({ context, errors }) => {
                const session = (context.request as AdminRequest).adminSession;

                // The session survives the user being deleted, so the row is
                // re-read rather than trusted from the token.
                const user = session
                    ? await this.users.findById(session.sub)
                    : null;

                if (!user) {
                    throw errors.UNAUTHORIZED();
                }

                return toPublicUser(user);
            },
        );
    }
}
