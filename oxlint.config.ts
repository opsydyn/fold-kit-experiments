import { recommended } from '@opsydyn/oxlint-effect';
import { defineConfig } from 'oxlint';

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

    // Rules downgraded to warn during migration — revisit before next major release
    // These fire broadly across Astro/D3 visualization code where the patterns are deliberate,
    // not violations of Effect discipline in application logic.

    // 440 violations: ternary expressions are ubiquitous in D3 viz code and Astro templates
    'linteffect/no-ternary': 'warn',

    // 107 violations: if/else is used deliberately in Astro components and D3 layout code
    'linteffect/no-if-statement': 'warn',

    // 61 violations: Astro framework legitimately uses dynamic imports for code-splitting
    'linteffect/prevent-dynamic-imports': 'warn',

    // 48 violations: string comparisons in viz UI code for domain values (e.g. chart variant strings)
    'linteffect/no-magic-domain-string': 'warn',

    // 24 violations: `as` assertions used broadly in model overlay patterns across viz charts;
    // fixing requires larger schema refactor — downgrade to allow incremental cleanup
    'linteffect/no-model-overlay-cast': 'warn',

    // 8 violations: string sentinel constants in foldkit-viz math/time and viz chart files
    'linteffect/no-string-sentinel-const': 'warn',

    // 4 violations: in test files where JS spread for object construction is intentional
    'linteffect/no-naked-object-state-update': 'warn',

    // 191 violations: block-bodied arrow callbacks with local bindings before return are ubiquitous
    // in D3 viz layout code and Effect subscription/stream callbacks — requires architectural
    // refactoring to use Match/pipe/Option combinators; downgraded during migration
    'linteffect/no-return-in-arrow': 'warn',

    // New rules not present in the old GritQL ruleset — downgraded to warn during migration
    // to avoid blocking the biome→oxlint transition; revisit before next major release.

    // 2 violations: Astro API routes legitimately call Effect.runSync at the HTTP boundary
    'linteffect/no-run-effect-outside-boundary': 'warn',

    // 2 violations: calendar-heatmap model init and arc-diagram view contain multi-clause
    // predicates (leap-year calc, hover-state check) that are intentional and well-tested
    'linteffect/no-domain-logic-in-conditional': 'warn',

    // 1 violation: health command uses Effect.provide inline inside Command.define body
    // — this is the standard Command.define pattern in this codebase
    'linteffect/no-inline-runtime-provide': 'warn',

    // 1 violation: welcome subscription uses Effect.sync to wrap the atom subscribe call
    // before acquireRelease — the side effect is scoped within the acquire arm, which is correct
    'linteffect/warn-effect-sync-wrapper': 'warn',
  },
  ignorePatterns: ['**/dist/**', '**/artifacts/**', '**/docs/**', '**/node_modules/**'],
});
