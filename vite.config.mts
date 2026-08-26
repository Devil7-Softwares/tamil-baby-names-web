import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { compression } from 'vite-plugin-compression2';

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
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            },
        },
    },
});
