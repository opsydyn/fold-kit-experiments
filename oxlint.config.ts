import { defineConfig } from 'oxlint';
import { recommended } from '@opsydyn/oxlint-effect';

export default defineConfig({
  plugins: ['typescript'],
  jsPlugins: [...recommended.jsPlugins, { name: 'foldkit', specifier: '@foldkit/oxlint-plugin' }],
  rules: {
    ...recommended.rules,

    // Foldkit application conventions
    'foldkit/no-noop-message': 'error',
    'foldkit/got-submodel-message-name': 'error',
    'foldkit/message-binding-matches-tag': 'error',
    'foldkit/got-prefix-requires-submodel-payload': 'error',
    'foldkit/no-empty-object-tagged-call': 'error',
    'foldkit/prefer-callable-message-constructor': 'error',
    'foldkit/command-binding-matches-name': 'error',
    'foldkit/no-module-level-mutable-state': 'error',

    // Biome rule equivalents — preserve the exact severities from biome.json
    '@typescript-eslint/no-explicit-any': 'off',
    'no-cond-assign': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    'no-constant-condition': 'warn',
  },
  ignorePatterns: ['**/dist/**', '**/artifacts/**', '**/docs/**', '**/node_modules/**'],
});
