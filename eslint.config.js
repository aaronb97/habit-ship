// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const reactCompiler = require('eslint-plugin-react-compiler');
const tsLint = require('typescript-eslint');

module.exports = defineConfig([
  // Ignore build artifacts
  { ignores: ['dist/*', 'eslint.config.js', 'eslint.precommit.config.js'] },

  // Base configs
  expoConfig,
  reactCompiler.configs.recommended,
  tsLint.configs.recommended,

  // Enable type-aware rules only for TypeScript files
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['**/*.d.ts'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/no-floating-promises': 'warn',

      eqeqeq: 'error',
      'no-shadow': 'warn',
    },
  },
]);
