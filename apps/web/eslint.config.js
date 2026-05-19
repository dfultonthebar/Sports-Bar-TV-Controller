// Flat-config replacement for .eslintrc.json (v2.47.0+).
//
// ESLint 10 removed legacy `.eslintrc.*` support entirely; flat
// config is now required. Next 16 ships eslint-config-next as a
// flat-config-ready export. typescript-eslint v8+ ships flat-config
// presets via `tseslint.configs.recommended`.
//
// Run with: `npx eslint .` (no `--ext` — flat config infers extensions
// from the `files` patterns below.)

const nextCoreWebVitals = require('eslint-config-next/core-web-vitals')
const nextTypeScript = require('eslint-config-next/typescript')
const tseslint = require('typescript-eslint')

module.exports = [
  ...nextCoreWebVitals,
  ...nextTypeScript,
  ...tseslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/require-await': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'dist/**',
      'coverage/**',
      '**/*.config.js',
      '**/*.config.ts',
    ],
  },
]
