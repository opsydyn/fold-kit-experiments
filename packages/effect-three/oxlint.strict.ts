import { allRules, jsPlugins, typeAware } from '@opsydyn/oxlint-effect';
import { defineConfig } from 'oxlint';

// Named oxlint.strict.ts so the root `oxlint .` does not auto-discover it as a nested config.
// Strict policy for @opsydyn/effect-three and @opsydyn/effect-three-foldkit (ADR-003):
// every Effect 4 rule, no disables. The workspace root config excludes both packages.
//
// Runtime execution boundaries are configuration, not exceptions.
// Custom paths replace the plugin defaults, so the defaults are restated.
const boundaryPaths = ['**/main.ts', '**/*.test.ts', 'test/**', 'bench/**', 'e2e/**', 'scripts/**'];

export default defineConfig({
  options: typeAware.options,
  plugins: ['typescript', 'unicorn', 'oxc'],
  jsPlugins: [...jsPlugins],
  ignorePatterns: ['**/dist/**', 'node_modules/**'],
  rules: {
    ...allRules,
    'linteffect/no-run-effect-outside-boundary': ['error', { effectVersion: 4, boundaryPaths }],
    'linteffect/no-early-catchall-null': ['error', { effectVersion: 4, boundaryPaths }],
    'linteffect/no-hidden-effect-execution': ['error', { effectVersion: 4, boundaryPaths }],
    'typescript/no-explicit-any': 'error',
    'typescript/no-unnecessary-type-assertion': 'error',
    'typescript/no-non-null-assertion': 'error',
    'typescript/no-floating-promises': 'error',
    'typescript/no-misused-promises': 'error',
  },
});
