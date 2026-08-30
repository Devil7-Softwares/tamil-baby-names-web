import {
    Inject,
    Injectable,
    Logger,
    OnApplicationBootstrap,
} from '@nestjs/common';
import { Sequelize } from 'sequelize';

import {
    ADMIN_USERS_MODEL,
    NAMES_MODEL,
    SEQUELIZE,
    TWIN_NAMES_MODEL,
} from './database.constants.js';
import { AdminUsersModel, NamesModel, TwinNamesModel } from './models.js';

@Injectable()
export class DatabaseBootstrap implements OnApplicationBootstrap {
    private readonly logger = new Logger(DatabaseBootstrap.name);
    private connected!: (value: boolean) => void;

    readonly ready = new Promise<boolean>((resolve) => {
        this.connected = resolve;
    });

    constructor(
        @Inject(SEQUELIZE) private readonly sequelize: Sequelize,
        @Inject(NAMES_MODEL) private readonly names: NamesModel,
        @Inject(TWIN_NAMES_MODEL) private readonly twinNames: TwinNamesModel,
        @Inject(ADMIN_USERS_MODEL)
        private readonly adminUsers: AdminUsersModel,
    ) {}

    onApplicationBootstrap(): void {
        void this.connect();
    }

    private async connect(): Promise<void> {
        try {
            await this.sequelize.authenticate();
        } catch (error) {
            this.logger.error('Failed to authenticate to database!', error);
            this.connected(false);
            return;
        }

        this.logger.log('Database authentication successful!');

        try {
            await this.names.sync();
            await this.twinNames.sync();
            await this.adminUsers.sync();
        } catch (error) {
            this.logger.error('Failed to syncronise tables!', error);
        }

        this.connected(true);
    }
}
