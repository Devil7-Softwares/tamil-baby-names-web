import { getDocumentTitleByFilter, getStateFromParams } from '@tbn/shared';
import { RequestHandler } from 'express';
import expressStaticGzip from 'express-static-gzip';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'url';

export function findPublicDir(configured?: string): string | null {
    const candidates = configured
        ? [configured]
        : [join(__dirname, '..', 'public'), join(process.cwd(), 'public')];

    return (
        candidates.find((path) => existsSync(join(path, 'index.html'))) ?? null
    );
}

const indexHandler = (publicDir: string): RequestHandler => {
    const indexHtml = readFileSync(join(publicDir, 'index.html'), 'utf-8');

    return (req, res, next) => {
        if (req.method !== 'GET' || res.headersSent) {
            return next();
        }

        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.status(200);

        const search = parse(req.url || '').search;

        if (!search) {
            return res.send(indexHtml);
        }

        const title = getDocumentTitleByFilter(
            getStateFromParams(new URLSearchParams(search)),
        );

        res.send(
            indexHtml.replace(
                /<title>(.*?)<\/title>/,
                `<title>${title}</title>`,
            ),
        );
    };
};

export function spaHandler(publicDir: string): RequestHandler {
    const files = expressStaticGzip(publicDir, {
        enableBrotli: true,
        orderPreference: ['br', 'gz'],
    });
    const index = indexHandler(publicDir);

    return (req, res, next) => {
        if (req.path === '/api' || req.path.startsWith('/api/')) {
            return next();
        }

        // The root is the index handler's, not the static directory's, so that
        // a shared link carries the title its filters describe.
        if (req.path === '/') {
            return index(req, res, next);
        }

        files(req, res, (error?: unknown) =>
            error ? next(error) : index(req, res, next),
        );
    };
}
