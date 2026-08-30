import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { appOptions, configureApp } from './setup.js';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, appOptions);

    configureApp(app);

    await app.listen(app.get(ConfigService).get<number>('PORT', 3001));
}

void bootstrap();
