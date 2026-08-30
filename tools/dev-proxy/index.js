import { createServer } from 'node:http';

import { createProxyServer } from 'httpxy';

const PORT = Number(process.env.PROXY_PORT ?? 3000);

const ADMIN = '/admin';

const ROUTES = [
    ['/api', process.env.API_URL ?? 'http://localhost:3001'],
    [ADMIN, process.env.ADMIN_URL ?? 'http://localhost:5174'],
    ['/', process.env.WEB_URL ?? 'http://localhost:5173'],
];

const targetFor = (url = '/') =>
    ROUTES.find(([prefix]) => prefix === '/' || url.startsWith(prefix))[1];

const proxy = createProxyServer({ changeOrigin: true });

const server = createServer(async (req, res) => {
    if (req.url === ADMIN) {
        res.writeHead(301, { location: `${ADMIN}/` });
        return res.end();
    }

    const target = targetFor(req.url);

    try {
        await proxy.web(req, res, { target });
    } catch (error) {
        res.writeHead(502, { 'content-type': 'text/plain' });
        res.end(`dev-proxy: ${target} is unreachable (${error.message})\n`);
    }
});

server.on('upgrade', async (req, socket, head) => {
    try {
        await proxy.ws(req, socket, { target: targetFor(req.url) }, head);
    } catch {
        socket.destroy();
    }
});

server.listen(PORT, () => {
    console.log(`  dev-proxy ready on http://localhost:${PORT}`);

    for (const [prefix, target] of ROUTES) {
        console.log(`    ${prefix.padEnd(7)} -> ${target}`);
    }
});
