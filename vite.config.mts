import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [react()],
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
