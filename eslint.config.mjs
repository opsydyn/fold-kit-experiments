import vanillaExtract from '@antebudimir/eslint-plugin-vanilla-extract';
import { defineConfig } from 'eslint/config';

// ESLint is scoped to *.css.ts files only — provides in-editor feedback for
// vanilla-extract ordering rules via the VS Code ESLint extension.
// All other linting is handled by oxlint (bun run check).
export default defineConfig([
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/artifacts/**', 'docs/**', 'astro--*/**'],
  },
  {
    files: ['**/*.css.ts'],
    extends: [vanillaExtract.configs.recommended],
    rules: {
      'vanilla-extract/concentric-order': 'warn',
      'vanilla-extract/no-trailing-zero': 'warn',
      'vanilla-extract/no-zero-unit': 'warn',
    },
  },
]);
