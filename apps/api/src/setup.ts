import {
    INestApplication,
    Logger,
    NestApplicationOptions,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { json, NextFunction, Request, Response } from 'express';

import { findPublicDir, spaHandler } from './spa/spa.handler.js';

// oRPC reads the request stream itself, so Nest must not consume it first.
// configureApp puts a JSON parser back on the endpoints that predate oRPC.
export const appOptions: NestApplicationOptions = { bodyParser: false };

const PRE_ORPC_JSON_ROUTES = ['/api/generate', '/api/letters'];

// Shared by main and the tests so they cannot disagree about the routes the
// service actually answers on.
export function configureApp(app: INestApplication): INestApplication {
    app.use(cookieParser());

    const parseJson = json();

    app.use((req: Request, res: Response, next: NextFunction) =>
        PRE_ORPC_JSON_ROUTES.includes(req.path)
            ? parseJson(req, res, next)
            : next(),
    );

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
