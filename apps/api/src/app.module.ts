import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AdminModule } from './admin/admin.module.js';
import { AuthModule } from './auth/auth.module.js';
import { validateEnv } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';
import { ExportModule } from './export/export.module.js';
import { HealthModule } from './health/health.module.js';
import { NamesModule } from './names/names.module.js';

@Module({
    imports: [
        ConfigModule.forRoot({
            cache: true,
            isGlobal: true,
            validate: validateEnv,
        }),
        AdminModule,
        AuthModule,
        DatabaseModule,
        ExportModule,
        HealthModule,
        NamesModule,
    ],
})
export class AppModule {}
