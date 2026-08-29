import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    // Nest resolves constructor dependencies from the types emitted by
    // emitDecoratorMetadata, which vitest's esbuild transform does not produce.
    plugins: [swc.vite({ module: { type: 'es6' } })],
    test: {
        environment: 'node',
        include: ['test/**/*.spec.ts', 'src/**/*.spec.ts'],
    },
});
