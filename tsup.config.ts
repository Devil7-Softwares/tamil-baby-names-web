import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { defineConfig } from 'tsup';

const runtimeAssetDirs = ['fonts'];

async function copyRuntimeAssets() {
    for (const dir of runtimeAssetDirs) {
        const from = join('src', 'assets', dir);
        const to = join('dist', 'assets', dir);

        await mkdir(to, { recursive: true });

        for (const entry of await readdir(from)) {
            await copyFile(join(from, entry), join(to, entry));
        }
    }
}

export default defineConfig({
    entry: { index: 'src/Server.ts' },
    outDir: 'dist',
    format: ['cjs'],
    target: 'node24',
    platform: 'node',
    sourcemap: true,
    clean: false,
    skipNodeModulesBundle: true,
    onSuccess: copyRuntimeAssets,
});
