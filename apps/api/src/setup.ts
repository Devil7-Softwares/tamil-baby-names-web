import { INestApplication } from '@nestjs/common';

export function configureApp(app: INestApplication): INestApplication {
    return app.setGlobalPrefix('api');
}
