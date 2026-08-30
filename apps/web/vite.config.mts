import react from '@vitejs/plugin-react';
import { configDotenv } from 'dotenv';
import { defineConfig } from 'vite';
import { compression } from 'vite-plugin-compression2';

configDotenv({ quiet: true });

export default defineConfig({
    plugins: [
        react(),
        compression({
            algorithms: ['gzip', 'brotliCompress'],
            include: /\.(js|css|html|svg|json|txt|webmanifest)$/,
            threshold: 1024,
        }),
    ],
    envPrefix: ['VITE_', 'RECAPTCHA_'],
    build: {
        outDir: 'dist/public',
        emptyOutDir: true,
        sourcemap: true,
    },
    server: {
        host: process.env.VITE_HOST || 'localhost',
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
        },
    },
});
