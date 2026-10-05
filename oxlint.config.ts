import { recommended } from '@opsydyn/oxlint-effect';
import { defineConfig } from 'oxlint';

export default defineConfig({
  plugins: ['typescript', 'react'],
  jsPlugins: [
    ...recommended.jsPlugins,
    { name: 'foldkit', specifier: '@foldkit/oxlint-plugin' },
    { name: 'vanilla-extract', specifier: '@antebudimir/eslint-plugin-vanilla-extract' },
    { name: 'anti-slop', specifier: './tools/oxlint/anti-slop/index.ts' },
    { name: 'anti-slop-effect', specifier: './tools/oxlint/anti-slop/effect/index.ts' },
  ],
  rules: {
    ...recommended.rules,

    // Generic anti-slop rules from the local repository plugin
    'anti-slop/no-chained-type-assertions': 'error',
    'anti-slop/no-conditional-empty-object-spread': 'error',
    'anti-slop/no-known-value-widening': 'error',
    'anti-slop/no-module-mocking': 'error',
    'anti-slop/no-object-parameters': 'error',
    'anti-slop/no-reflect-apply': 'error',
    'anti-slop/no-reflect-get': 'error',
    'anti-slop/no-runtime-typeof': ['error', { allowInTypeGuards: true }],
    'anti-slop/no-shape-in-symbol-names': 'error',
    'anti-slop/no-unknown-parameters': 'error',
    'anti-slop/no-unknown-returns': 'error',
    'anti-slop/no-unknown-type-aliases': 'error',
    'anti-slop/no-unsafe-dictionary-type': 'error',
    'anti-slop/no-widen-then-assert': 'error',
    'anti-slop/require-safety-comment-for-type-assertion': 'error',

    // Effect-specific anti-slop rule for local service constructor ownership
    'anti-slop-effect/no-service-constructor-imports': 'error',

    // Foldkit application conventions
    'foldkit/no-noop-message': 'error',
    'foldkit/got-submodel-message-name': 'error',
    'foldkit/got-prefix-requires-submodel-payload': 'error',
    'foldkit/no-empty-object-tagged-call': 'error',
    'foldkit/prefer-callable-message-constructor': 'error',
    'foldkit/command-binding-matches-name': 'error',
    'foldkit/no-module-level-mutable-state': 'error',
    'foldkit/mount-factory-must-use-element': 'error',

    // vanilla-extract CSS rules
    'vanilla-extract/no-empty-style-blocks': 'error',
    'vanilla-extract/no-unknown-unit': 'error',
    'vanilla-extract/no-trailing-zero': 'warn',
    'vanilla-extract/no-zero-unit': 'warn',
    'vanilla-extract/concentric-order': 'warn',

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
  overrides: [
    {
      // ResizeObserver registration and release are the shared Mount stream's native I/O boundary.
      // Nested callback/acquireRelease is the documented Effect callback bridge, not domain logic.
      files: [
        'apps/promo/src/examples/shared/measurement.ts',
        'packages/dataset-explorer/src/measurement.ts',
      ],
      rules: {
        'linteffect/no-effect-wrapper-alias': 'off',
        'linteffect/no-call-tower': 'off',
        'linteffect/no-return-in-arrow': 'off',
        'linteffect/warn-effect-sync-wrapper': 'off',
      },
    },
    {
      // Third-party DOM resources follow Mount's documented acquireRelease pattern.
      // Acquire and cleanup must run in the lifecycle Effect, rather than in the view.
      files: [
        'apps/promo/src/examples/line/editor-mount.ts',
        'apps/promo/src/examples/datasets/launcher/editor-mount.ts',
      ],
      rules: { 'linteffect/no-call-tower': 'off', 'linteffect/warn-effect-sync-wrapper': 'off' },
    },
    {
      // Temporary exported modules are executed and cleaned up at the test I/O boundary.
      files: [
        'apps/promo/test/{live-line,line-project,example-template,standalone-chart-project}.test.ts',
        'packages/foldkit-viz/test/package-import-smoke.test.ts',
      ],
      rules: { 'linteffect/no-try-catch': 'off' },
    },
    {
      // Native download and playground branches live inside a declared Command.
      files: [
        'apps/promo/src/examples/{line,histogram,scatter}/command.ts',
        'apps/promo/src/examples/datasets/launcher/command.ts',
        'apps/promo/src/examples/datasets/launcher/editor-mount.ts',
        'apps/promo/src/examples/line/editor-mount.ts',
      ],
      rules: { 'linteffect/no-if-statement': 'off', 'linteffect/no-magic-domain-string': 'off' },
    },
    {
      // Promo fixtures and SVG geometry are pure rendering data, not Effect handlers.
      files: ['apps/promo/src/lib/**', 'apps/promo/src/pages/**', 'apps/promo/test/**'],
      rules: {
        'linteffect/no-string-sentinel-const': 'off',
        'linteffect/no-return-in-arrow': 'off',
      },
    },
    {
      // Astro page chrome talks directly to browser storage and colour preferences.
      // Storage access can throw even before getItem runs; guard this native boundary.
      files: ['apps/promo/src/layouts/Layout.astro'],
      rules: {
        'linteffect/no-try-catch': 'off',
        'linteffect/no-string-sentinel-const': 'off',
      },
    },
    {
      // Astro islands use literal module specifiers as explicit code-splitting boundaries.
      files: ['apps/web/src/apps/**/app.ts', 'apps/promo/src/examples/**/app.ts'],
      rules: {
        'linteffect/prevent-dynamic-imports': 'off',
      },
    },
    {
      // These files are pure rendering, geometry, fixtures, or test harnesses. They do not
      // own Effect state transitions, so Effect-only control-flow heuristics do not apply.
      files: [
        'apps/web/src/ui/**',
        'packages/dataset-explorer/src/{data,chart,frame,view,source,source-view}.ts',
        'apps/web/src/apps/**/view.ts',
        'apps/web/src/apps/**/*.test.ts',
        'apps/web/src/stories/**',
        'apps/web/.storybook/**',
        'packages/foldkit-viz/src/**',
        'packages/foldkit-viz/test/**',
        'packages/astro-foldkit/test/**',
        'apps/promo/src/examples/{line,histogram,scatter,bars,wordcloud}/{chart,data,project,view}.ts',
        'apps/promo/src/examples/datasets/launcher/view.ts',
        'apps/promo/src/examples/signals/{data,derive,view}.ts',
        'apps/promo/test/**',
      ],
      rules: {
        'linteffect/no-domain-logic-in-conditional': 'off',
        'linteffect/no-if-statement': 'off',
        'linteffect/no-magic-domain-string': 'off',
        'linteffect/no-model-overlay-cast': 'off',
        'linteffect/no-naked-object-state-update': 'off',
        'linteffect/no-return-in-arrow': 'off',
        'linteffect/no-run-effect-outside-boundary': 'off',
        'linteffect/no-string-sentinel-const': 'off',
        'linteffect/no-ternary': 'off',
        'linteffect/prevent-dynamic-imports': 'off',
        'linteffect/warn-effect-sync-wrapper': 'off',
      },
    },
    {
      // These modules are explicit application/runtime boundaries. Running an Effect here is
      // the boundary itself, rather than a local domain transition.
      files: [
        'apps/web/src/pages/api/**',
        'packages/astro-foldkit/src/server-render.ts',
        'apps/promo/src/lib/{line,example,dataset}-project.ts',
        'apps/promo/src/pages/downloads/**',
        'apps/promo/src/pages/datasets/**',
        'apps/promo/src/lib/dataset-sources.ts',
      ],
      rules: {
        'linteffect/no-naked-object-state-update': 'off',
        'linteffect/no-run-effect-outside-boundary': 'off',
      },
    },
    {
      // App model initialisers and route parsers build plain data. They are not Effect update
      // handlers, so their ordinary data branching remains readable and intentional.
      files: [
        'apps/web/src/apps/**/model.ts',
        'packages/dataset-explorer/src/model.ts',
        'apps/promo/src/examples/**/model.ts',
        'apps/web/src/apps/request-diagnostics/navigation.ts',
        'apps/web/src/apps/counter/types.ts',
      ],
      rules: {
        'linteffect/no-domain-logic-in-conditional': 'off',
        'linteffect/no-if-statement': 'off',
        'linteffect/no-magic-domain-string': 'off',
        'linteffect/no-ternary': 'off',
      },
    },
    {
      // This selector is a DOM integration constant, not a domain-state sentinel.
      files: ['packages/astro-foldkit/src/client-helpers.ts'],
      rules: {
        'linteffect/no-string-sentinel-const': 'off',
      },
    },
  ],
  ignorePatterns: [
    '**/dist/**',
    '**/artifacts/**',
    '**/docs/**',
    '**/node_modules/**',
    '.agent/**',
    '.agents/**',
    '.claude/**',
    '.codex/**',
    '.continue/**',
    '.cursor/**',
    '.gemini/**',
    '.opencode/**',
    '.pi/**',
    '.roo/**',
    '.windsurf/**',
    '.worktrees/**',
    'skills/**',
    'tools/oxlint/anti-slop/**',
  ],
});
