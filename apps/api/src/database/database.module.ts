import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Sequelize } from 'sequelize';

import { DatabaseBootstrap } from './database.bootstrap.js';
import {
    NAMES_MODEL,
    SEQUELIZE,
    TWIN_NAMES_MODEL,
} from './database.constants.js';
import { defineNames, defineTwinNames } from './models.js';

@Global()
@Module({
    providers: [
        {
            provide: SEQUELIZE,
            useFactory: (config: ConfigService) =>
                new Sequelize({
                    host: config.get<string>('MYSQL_HOST'),
                    database: config.get<string>('MYSQL_DATABASE'),
                    username: config.get<string>('MYSQL_USER'),
                    password: config.get<string>('MYSQL_PASSWORD'),
                    dialect: 'mysql',
                }),
            inject: [ConfigService],
        },
        { provide: NAMES_MODEL, useFactory: defineNames, inject: [SEQUELIZE] },
        {
            provide: TWIN_NAMES_MODEL,
            useFactory: defineTwinNames,
            inject: [SEQUELIZE],
        },
        DatabaseBootstrap,
    ],
    exports: [SEQUELIZE, NAMES_MODEL, TWIN_NAMES_MODEL, DatabaseBootstrap],
})
export class DatabaseModule {}
