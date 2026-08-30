import { getDocumentTitleByFilter, getStateFromParams } from '@tbn/shared';
import { RequestHandler } from 'express';
import expressStaticGzip from 'express-static-gzip';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath, parse } from 'url';

const moduleDir = fileURLToPath(new URL('.', import.meta.url));

/** Where the dashboard lives, both in the url and in the deployed layout. */
export const ADMIN_BASE = '/admin';

export function findPublicDir(
    configured?: string,
    name = 'public',
): string | null {
    const candidates = configured
        ? [configured]
        : [join(moduleDir, '..', name), join(process.cwd(), name)];

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

/**
 * The dashboard is built with `base: '/admin/'`, so its files sit at the root
 * of their own directory and the prefix has to come off before they are looked
 * up. Everything under the prefix falls back to its own index, keeping the two
 * clients' routers from ever seeing each other's paths.
 */
const adminHandler = (adminDir: string): RequestHandler => {
    const files = expressStaticGzip(adminDir, {
        enableBrotli: true,
        orderPreference: ['br', 'gz'],
    });
    const indexHtml = readFileSync(join(adminDir, 'index.html'), 'utf-8');

    return (req, res, next) => {
        if (req.method !== 'GET') {
            return next();
        }

        // Relative asset urls would resolve against `/` without the slash.
        if (req.path === ADMIN_BASE) {
            return res.redirect(301, `${ADMIN_BASE}/`);
        }

        const url = req.url;

        req.url = url.slice(ADMIN_BASE.length) || '/';

        files(req, res, (error?: unknown) => {
            req.url = url;

            if (error) {
                return next(error);
            }

            res.setHeader('Content-Type', 'text/html');
            res.setHeader('Cache-Control', 'no-cache');
            res.status(200).send(indexHtml);
        });
    };
};

export function spaHandler(
    publicDir: string,
    adminDir?: string | null,
): RequestHandler {
    const files = expressStaticGzip(publicDir, {
        enableBrotli: true,
        orderPreference: ['br', 'gz'],
    });
    const index = indexHandler(publicDir);
    const admin = adminDir ? adminHandler(adminDir) : null;

    return (req, res, next) => {
        if (req.path === '/api' || req.path.startsWith('/api/')) {
            return next();
        }

        if (
            admin &&
            (req.path === ADMIN_BASE || req.path.startsWith(`${ADMIN_BASE}/`))
        ) {
            return admin(req, res, next);
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
