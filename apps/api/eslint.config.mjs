import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import-x';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    { ignores: ['dist', 'node_modules'] },

    js.configs.recommended,
    tseslint.configs.recommended,

    {
        files: ['**/*.ts'],
        languageOptions: {
            ecmaVersion: 2023,
            globals: globals.node,
        },
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
            // /[^\u0000-\u00ff]/ is used deliberately to detect Tamil text and
            // switch the PDF font accordingly.
            'no-control-regex': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
        },
    },
);
