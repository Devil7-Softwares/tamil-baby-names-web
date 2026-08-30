import { Logger } from '@nestjs/common';
import { Sequelize } from 'sequelize';
import { SequelizeStorage, Umzug } from 'umzug';
import { fileURLToPath } from 'url';

const migrationsDir = fileURLToPath(new URL('./migrations', import.meta.url));

const logger = new Logger('Migrator');

export const createMigrator = (sequelize: Sequelize) =>
    new Umzug({
        // Compiled migrations, so a data migration can use the same shared
        // helpers the app does rather than reimplementing them in SQL.
        migrations: { glob: ['*.js', { cwd: migrationsDir }] },
        context: sequelize.getQueryInterface(),
        storage: new SequelizeStorage({
            sequelize,
            modelName: 'schema_migrations',
        }),
        logger: {
            info: (message) => logger.log(JSON.stringify(message)),
            warn: (message) => logger.warn(JSON.stringify(message)),
            error: (message) => logger.error(JSON.stringify(message)),
            debug: () => undefined,
        },
    });
