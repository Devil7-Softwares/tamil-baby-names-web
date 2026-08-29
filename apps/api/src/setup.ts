import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';

export function configureApp(app: INestApplication): INestApplication {
    app.use(cookieParser());

    return app.setGlobalPrefix('api');
}
