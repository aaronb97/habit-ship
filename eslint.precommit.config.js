// ESLint config used ONLY for pre-commit autofix runs
// Keeps scope small and fast: only the rules requested

// Flat config (ESLint v9)
const { defineConfig } = require('eslint/config');
const react = require('eslint-plugin-react');
const stylistic = require('@stylistic/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');

module.exports = defineConfig([
  // Ignore build artifacts and this config file itself
  { ignores: ['dist/*', 'eslint.config.js', 'eslint.precommit.config.js'] },

  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: tsParser, // parse TS/TSX as well
      ecmaVersion: 'latest',
      sourceType: 'module',
      // ecmaFeatures: { jsx: true },
    },
    plugins: {
      react,
      '@stylistic': stylistic,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // React
      'react/jsx-boolean-value': ['error'],
      'react/self-closing-comp': ['error'],
      'react/jsx-no-useless-fragment': ['error', { allowExpressions: true }],
      'react/jsx-sort-props': [
        'error',
        {
          callbacksLast: true,
          shorthandFirst: true,
          reservedFirst: true,
          noSortAlphabetically: true,
        },
      ],
      curly: ['error'],

      // Stylistic
      '@stylistic/padding-line-between-statements': [
        'error',
        {
          blankLine: 'always',
          prev: [
            'multiline-block-like',
            'multiline-expression',
            'multiline-const',
          ],
          next: '*',
        },
      ],

      // Core
      'object-shorthand': 'error',
      'prefer-template': 'error',
    },
  },
]);
