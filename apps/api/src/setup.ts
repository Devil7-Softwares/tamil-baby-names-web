import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';

import { findPublicDir, spaHandler } from './spa/spa.handler.js';

// Shared by main and the tests so they cannot disagree about the routes the
// service actually answers on.
export function configureApp(app: INestApplication): INestApplication {
    app.use(cookieParser());

    const publicDir = findPublicDir(
        app.get(ConfigService).get<string>('PUBLIC_DIR'),
    );

    if (publicDir) {
        Logger.log(`Using public dir: ${publicDir}`, 'Spa');
        // On the express instance rather than through a module: a middleware
        // route is given the global prefix, which would put the client under
        // /api.
        app.use(spaHandler(publicDir));
    } else {
        Logger.log('No public dir found!', 'Spa');
    }

    return app.setGlobalPrefix('api');
}
