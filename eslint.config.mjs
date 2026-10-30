import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['out', 'dist', 'test-results', 'playwright-report', '.claude']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } },
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts', 'tests/**/*.ts', 'e2e/**/*.ts', '*.config.ts'],
    languageOptions: { globals: globals.node },
  },
]);
