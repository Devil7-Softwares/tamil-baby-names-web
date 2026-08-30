import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DatabaseBootstrap } from '../../database/database.bootstrap.js';
import { UsersService } from './users.service.js';

/**
 * Creates the first admin from BOOTSTRAP_ADMIN_EMAIL / _PASSWORD when the table
 * is empty, so a fresh deploy has a way in without a public register endpoint.
 * A no-op once any user exists.
 */
@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
    private readonly logger = new Logger(AdminBootstrapService.name);

    constructor(
        private readonly config: ConfigService,
        private readonly database: DatabaseBootstrap,
        private readonly users: UsersService,
    ) {}

    onApplicationBootstrap(): void {
        void this.bootstrap();
    }

    private async bootstrap(): Promise<void> {
        const email = this.config.get<string>('BOOTSTRAP_ADMIN_EMAIL');
        const password = this.config.get<string>('BOOTSTRAP_ADMIN_PASSWORD');

        if (!email || !password) {
            return;
        }

        await this.database.ready;

        try {
            if ((await this.users.count()) > 0) {
                return;
            }

            await this.users.create({
                email,
                password,
                name:
                    this.config.get<string>('BOOTSTRAP_ADMIN_NAME') ??
                    'Administrator',
                role: 'admin',
            });

            this.logger.log(`Bootstrapped the initial admin ${email}`);
        } catch (error) {
            this.logger.error('Failed to bootstrap the initial admin!', error);
        }
    }
}
