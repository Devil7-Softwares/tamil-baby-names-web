import react from '@vitejs/plugin-react';
import { configDotenv } from 'dotenv';
import { defineConfig } from 'vite';
import { compression } from 'vite-plugin-compression2';

configDotenv({ quiet: true });

export default defineConfig({
    clearScreen: false,
    // The api serves the dashboard under /admin, beside the public client.
    base: '/admin/',
    plugins: [
        react(),
        compression({
            algorithms: ['gzip', 'brotliCompress'],
            include: /\.(js|css|html|svg|json|txt|webmanifest)$/,
            threshold: 1024,
        }),
    ],
    resolve: {
        tsconfigPaths: true,
    },
    build: {
        outDir: 'dist/public',
        emptyOutDir: true,
        sourcemap: true,
    },
    server: {
        host: process.env.VITE_HOST || 'localhost',
        port: 5174,
        strictPort: true,
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
        },
    },
});
