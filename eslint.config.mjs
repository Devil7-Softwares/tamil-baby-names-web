import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import-x';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    { ignores: ['dist', 'node_modules', '.yarn'] },

    js.configs.recommended,
    tseslint.configs.recommended,

    // Browser sources
    {
        files: ['src/**/*.{ts,tsx}'],
        ignores: ['src/Server.ts'],
        extends: [reactHooks.configs.flat.recommended],
        plugins: { 'react-refresh': reactRefresh },
        languageOptions: {
            ecmaVersion: 2022,
            globals: { ...globals.browser, gtag: 'readonly' },
        },
        rules: {
            'react-refresh/only-export-components': [
                'warn',
                { allowConstantExport: true },
            ],
            // Pre-existing derived-state-in-effect patterns. Demoted to warnings
            // so they surface without failing the build; tracked for refactor.
            'react-hooks/set-state-in-effect': 'warn',
        },
    },

    // Server source
    {
        files: ['src/Server.ts'],
        languageOptions: {
            ecmaVersion: 2022,
            globals: globals.node,
        },
        rules: {
            // /[^\u0000-\u00ff]/ is used deliberately to detect Tamil text and
            // switch the PDF font accordingly.
            'no-control-regex': 'off',
        },
    },

    // Build tooling
    {
        files: ['*.config.{ts,mts,mjs}'],
        languageOptions: { globals: globals.node },
    },
    {
        plugins: {
            'simple-import-sort': simpleImportSort,
            'import-x': importPlugin,
        },
        rules: {
            'simple-import-sort/imports': 'error',
            'simple-import-sort/exports': 'error',
            'import-x/first': 'error',
            'import-x/newline-after-import': 'error',
            'import-x/no-duplicates': 'error',
        },
    },

    {
        rules: {
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
        },
    },
);
