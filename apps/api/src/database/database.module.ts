import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Sequelize } from 'sequelize';

import { DatabaseBootstrap } from './database.bootstrap.js';
import {
    ADMIN_USERS_MODEL,
    NAMES_MODEL,
    SEQUELIZE,
    TWIN_NAMES_MODEL,
} from './database.constants.js';
import { defineAdminUsers, defineNames, defineTwinNames } from './models.js';

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
            provide: ADMIN_USERS_MODEL,
            useFactory: defineAdminUsers,
            inject: [SEQUELIZE],
        },
        DatabaseBootstrap,
    ],
    exports: [
        SEQUELIZE,
        NAMES_MODEL,
        TWIN_NAMES_MODEL,
        ADMIN_USERS_MODEL,
        DatabaseBootstrap,
    ],
})
export class DatabaseModule {}
