/**
 * ESLint configuration for the Agilam marketplace (React + TypeScript + Vite).
 *
 * Restores `npm run lint`, which failed with "couldn't find a configuration
 * file". Uses the classic (eslintrc) format to match the ESLint 8 /
 * @typescript-eslint 7 devDependencies already pinned in package.json.
 */
module.exports = {
  root: true,
  env: { browser: true, es2021: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['@typescript-eslint', 'react-hooks', 'react-refresh'],
  settings: { react: { version: '18.3' } },
  ignorePatterns: ['dist', 'node_modules', 'playwright-browsers', '*.tsbuildinfo'],
  rules: {
    ...require('eslint-plugin-react-hooks').configs.recommended.rules,
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    // The API functions are plain Node ESM handlers, not typed with the app tsconfig.
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  },
  overrides: [
    {
      files: ['api/**/*.js'],
      env: { node: true, browser: false },
    },
  ],
};
