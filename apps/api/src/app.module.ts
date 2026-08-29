import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './auth/auth.module';
import { validateEnv } from './config/env';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { NamesModule } from './names/names.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            cache: true,
            isGlobal: true,
            validate: validateEnv,
        }),
        AuthModule,
        DatabaseModule,
        HealthModule,
        NamesModule,
    ],
})
export class AppModule {}
