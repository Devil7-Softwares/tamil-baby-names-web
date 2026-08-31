import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Sequelize } from 'sequelize';

import { DatabaseBootstrap } from './database.bootstrap.js';
import {
    ADMIN_USERS_MODEL,
    CLUSTERS_MODEL,
    MEANINGS_MODEL,
    NAMES_MODEL,
    SEQUELIZE,
    SOURCES_MODEL,
    TWIN_NAMES_MODEL,
    VERIFICATIONS_MODEL,
} from './database.constants.js';
import {
    defineAdminUsers,
    defineClusters,
    defineMeanings,
    defineNames,
    defineSources,
    defineTwinNames,
    defineVerifications,
} from './models.js';
import { SortCollationService } from './sort-collation.service.js';

@Global()
@Module({
    providers: [
        {
            provide: SEQUELIZE,
            useFactory: (config: ConfigService) =>
                new Sequelize({
                    host: config.get<string>('POSTGRES_HOST'),
                    port: config.get<number>('POSTGRES_PORT'),
                    database: config.get<string>('POSTGRES_DATABASE'),
                    username: config.get<string>('POSTGRES_USER'),
                    password: config.get<string>('POSTGRES_PASSWORD'),
                    dialect: 'postgres',
                }),
            inject: [ConfigService],
        },
        { provide: NAMES_MODEL, useFactory: defineNames, inject: [SEQUELIZE] },
        {
            provide: TWIN_NAMES_MODEL,
            useFactory: defineTwinNames,
            inject: [SEQUELIZE],
        },
        {
            provide: MEANINGS_MODEL,
            useFactory: defineMeanings,
            inject: [SEQUELIZE],
        },
        {
            provide: CLUSTERS_MODEL,
            useFactory: defineClusters,
            inject: [SEQUELIZE],
        },
        {
            provide: SOURCES_MODEL,
            useFactory: defineSources,
            inject: [SEQUELIZE],
        },
        {
            provide: VERIFICATIONS_MODEL,
            useFactory: defineVerifications,
            inject: [SEQUELIZE],
        },
        {
            provide: ADMIN_USERS_MODEL,
            useFactory: defineAdminUsers,
            inject: [SEQUELIZE],
        },
        DatabaseBootstrap,
        SortCollationService,
    ],
    exports: [
        SEQUELIZE,
        NAMES_MODEL,
        TWIN_NAMES_MODEL,
        MEANINGS_MODEL,
        CLUSTERS_MODEL,
        SOURCES_MODEL,
        VERIFICATIONS_MODEL,
        ADMIN_USERS_MODEL,
        DatabaseBootstrap,
        SortCollationService,
    ],
})
export class DatabaseModule {}
