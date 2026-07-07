import vePlugin from '@antebudimir/eslint-plugin-vanilla-extract';

// ESLint is used only for vanilla-extract CSS ordering rules in *.css.ts files.
// All other linting is handled by oxlint (bun run check).
export default [
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/artifacts/**', 'docs/**', 'astro--*/**'],
  },
  {
    files: ['**/*.css.ts'],
    plugins: {
      'vanilla-extract': vePlugin,
    },
    rules: {
      'vanilla-extract/no-empty-style-blocks': 'error',
      'vanilla-extract/no-unknown-unit': 'error',
      'vanilla-extract/no-trailing-zero': 'warn',
      'vanilla-extract/no-zero-unit': 'warn',
      'vanilla-extract/concentric-order': 'warn',
    },
  },
];
