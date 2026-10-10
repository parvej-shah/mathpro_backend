// ESLint flat config. Goal: catch real defects (undefined names, dead variables,
// unreachable code) — not style. Formatting rules are intentionally off.
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
    {
        ignores: ['node_modules/**', '.testdb/**', 'docs/**', 'uploads/**', 'assets/**', 'archive/**'],
    },
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: { ...globals.node },
        },
        rules: {
            ...js.configs.recommended.rules,
            'no-unused-vars': ['warn', { args: 'after-used', argsIgnorePattern: '^_|^(req|res|next)$', caughtErrors: 'none' }],
            'no-undef': 'error',
            'no-unreachable': 'error',
            'no-dupe-class-members': 'error',
            'no-dupe-keys': 'error',
            'no-empty': ['warn', { allowEmptyCatch: false }],
            'no-useless-escape': 'off',
            'no-prototype-builtins': 'off',
            'no-case-declarations': 'off',
            'no-inner-declarations': 'off',
        },
    },
    {
        files: ['test/**/*.js'],
        languageOptions: { globals: { ...globals.node } },
    },
];
