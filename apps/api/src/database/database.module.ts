import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Sequelize } from 'sequelize';

import { DatabaseBootstrap } from './database.bootstrap.js';
import {
    ADMIN_USERS_MODEL,
    CLUSTERS_MODEL,
    LANGUAGES_MODEL,
    MEANINGS_MODEL,
    NAMES_MODEL,
    RELIGIONS_MODEL,
    SEQUELIZE,
    SOURCES_MODEL,
    TWIN_NAMES_MODEL,
    VERIFICATIONS_MODEL,
} from './database.constants.js';
import { LookupsService } from './lookups.service.js';
import {
    defineAdminUsers,
    defineClusters,
    defineLanguages,
    defineMeanings,
    defineNames,
    defineReligions,
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
            provide: RELIGIONS_MODEL,
            useFactory: defineReligions,
            inject: [SEQUELIZE],
        },
        {
            provide: LANGUAGES_MODEL,
            useFactory: defineLanguages,
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
        LookupsService,
        SortCollationService,
    ],
    exports: [
        SEQUELIZE,
        NAMES_MODEL,
        TWIN_NAMES_MODEL,
        MEANINGS_MODEL,
        CLUSTERS_MODEL,
        RELIGIONS_MODEL,
        LANGUAGES_MODEL,
        SOURCES_MODEL,
        VERIFICATIONS_MODEL,
        ADMIN_USERS_MODEL,
        DatabaseBootstrap,
        LookupsService,
        SortCollationService,
    ],
})
export class DatabaseModule {}
