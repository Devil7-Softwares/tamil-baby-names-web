import {
    Inject,
    Injectable,
    Logger,
    OnApplicationBootstrap,
} from '@nestjs/common';
import { Sequelize } from 'sequelize';

import { SEQUELIZE } from './database.constants.js';
import { createMigrator } from './migrator.js';

const FIRST_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class DatabaseBootstrap implements OnApplicationBootstrap {
    private readonly logger = new Logger(DatabaseBootstrap.name);
    private connected!: () => void;
    private established = false;

    /** Resolves once the schema is migrated. Pending until then, never rejected. */
    readonly ready = new Promise<void>((resolve) => {
        this.connected = resolve;
    });

    constructor(@Inject(SEQUELIZE) private readonly sequelize: Sequelize) {}

    get isConnected(): boolean {
        return this.established;
    }

    onApplicationBootstrap(): void {
        void this.connect();
    }

    /**
     * Retries indefinitely. The database is a separate resource with its own
     * lifecycle, so it may well be unreachable when the app starts and be there
     * a few seconds later; giving up once left the process serving errors until
     * somebody restarted it.
     */
    private async connect(): Promise<void> {
        for (let attempt = 1; ; attempt++) {
            try {
                await this.sequelize.authenticate();
                break;
            } catch (error) {
                // Only the first attempt reports the reason. After that the
                // same line would repeat every few seconds until it comes up.
                if (attempt === 1) {
                    this.logger.error(
                        'Failed to authenticate to database, retrying...',
                        error,
                    );
                }

                await wait(Math.min(FIRST_RETRY_MS * attempt, MAX_RETRY_MS));
            }
        }

        this.logger.log('Database authentication successful!');

        try {
            await createMigrator(this.sequelize).up();
        } catch (error) {
            this.logger.error('Failed to migrate the schema!', error);
        }

        this.established = true;
        this.connected();
    }
}
