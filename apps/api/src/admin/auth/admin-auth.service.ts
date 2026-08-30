import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoginInput } from '@tbn/shared';
import { compare } from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { IAdminUser } from '../../database/models.js';
import { UsersService } from '../users/users.service.js';
import { AdminSession } from './admin-session.js';

const EXPIRES_IN = '12h';

@Injectable()
export class AdminAuthService {
    private readonly logger = new Logger(AdminAuthService.name);
    private readonly secret?: string;

    constructor(
        private readonly config: ConfigService,
        private readonly users: UsersService,
    ) {
        this.secret = config.get<string>('ADMIN_JWT_SECRET');

        if (!this.secret) {
            this.logger.warn(
                'ADMIN_JWT_SECRET is not set, so the admin area is offline.',
            );
        }
    }

    /** The public site still has to serve when the admin area is unconfigured. */
    get isConfigured(): boolean {
        return !!this.secret;
    }

    get isProduction(): boolean {
        return this.config.get<string>('NODE_ENV') === 'production';
    }

    async verifyCredentials(input: LoginInput): Promise<IAdminUser | null> {
        const user = await this.users.findByEmail(input.email);

        if (!user || !(await compare(input.password, user.passwordHash))) {
            return null;
        }

        return user;
    }

    sign(user: IAdminUser): string {
        const payload: AdminSession = { sub: user.id, role: user.role };

        return jwt.sign(payload, this.secret!, { expiresIn: EXPIRES_IN });
    }

    verify(token: string): AdminSession | null {
        if (!this.secret) {
            return null;
        }

        try {
            return jwt.verify(token, this.secret) as unknown as AdminSession;
        } catch {
            return null;
        }
    }
}
