# Task 4 Report: Astro Navigation Bridge

Status: DONE_WITH_CONCERNS
Commit: 83c30df docs: complete astro navigation slice (base slice commit; this report is finalized in the following report commit)

## Files

- `packages/astro-foldkit/test/integration/package-import-smoke.test.ts`
  - Added a packed-consumer assertion for `NavigationConfig`, `NavigationEvent`, and `NavigationPhase` in `dist/index.d.mts`.
- `packages/astro-foldkit/README.md`
  - Documented the navigation event shape, lifecycle semantics, fail-closed missing-port behavior, and app ownership of route parsing and load policy.
- `docs/roadmap.md`
  - Marked the Astro navigation bridge and route-aware diagnostics example complete.
- `docs/superpowers/plans/2026-07-14-astro-navigation-bridge.md`
  - Marked Tasks 1-4 complete and recorded Task 4 evidence.

## Verification

- `bun run check`
  - PASS. Existing lint warnings remain; formatting passed for all 709 files.
- `bun typecheck`
  - PASS. FoldKit Viz, Astro, and web typecheck completed with 0 errors, 0 warnings, and 0 hints in web (473 files).
- `bun test packages/astro-foldkit/test/unit packages/astro-foldkit/test/integration apps/web/src/apps/request-diagnostics`
  - CONCERN. 49 tests passed, including all Astro unit/integration tests and the route test. Four diagnostics files were not executable under raw Bun because FoldKit 0.128's `foldkit` entry has no `Mount` export; Bun reported `SyntaxError: Export named 'Mount' not found`.
- `bun run --filter @opsydyn/astro-foldkit build`
  - PASS. Package build completed and emitted the declaration surface checked by the smoke test.
- `bun run --filter @opsydyn/web build`
  - PASS. Astro server build completed with the Cloudflare adapter.
- `bun run --filter @opsydyn/web test`
  - PASS. 8 test files and 41 tests passed.
- `git diff --check`
  - PASS.

## Concerns

The required combined raw Bun test command is not a valid full-repo test runner for the current FoldKit 0.128 test setup: it attempts to load diagnostics tests that import the removed `Mount` export. The web workspace's Vitest command passes all 41 tests, and this Task 4 change does not alter those imports or runtime implementation behavior.

The repo retains its pre-existing lint warnings; `bun run check` exits 0 after formatting the updated plan.

## Review Follow-Up Evidence

- Corrected `docs/roadmap.md` to describe the shipped app-owned `Route.isEntering` route policy instead of claiming `Transition.make` usage.
- Replaced the non-gating combined raw Bun test command in the plan with workspace-valid package unit/integration scripts and the web Vitest script. The raw Bun `Mount` export failure remains documented as a known limitation.
- Extended `package-import-smoke.test.ts` to compile a temporary packed consumer importing and using `NavigationConfig`, `NavigationEvent`, and `NavigationPhase`, while preserving Bun and Node runtime import checks.

Follow-up verification:

- `bun run --filter @opsydyn/astro-foldkit test:unit`: PASS, 44 tests.
- `bun run --filter @opsydyn/astro-foldkit test:integration`: PASS, 2 packed-consumer tests; the emitted navigation types compile successfully under TypeScript, and Bun/Node imports pass.
- `bun run --filter @opsydyn/web test`: PASS, 41 tests across 8 files.
- `bun typecheck`: PASS, 0 diagnostics in web and all workspace typechecks successful.
- `bun run check`: PASS with existing lint warnings; formatting clean.
- `git diff --check`: PASS.

## Final Review Fix Evidence

- `packages/astro-foldkit/src/client.ts` now narrows `astro:before-swap` detail and uses `detail.to.href` for retained-island `stayed` events. The regression test keeps `window.location` on the old URL and verifies the sent pathname is the destination pathname.
- `apps/web/package.json` now builds `@opsydyn/astro-foldkit` before `astro build`, ensuring the workspace package's emitted `dist` exists at the package import boundary. `apps/web/node_modules/@opsydyn/astro-foldkit` is the Bun workspace symlink; no source-path import was added.
- `apps/web/src/apps/request-diagnostics/navigation.ts` now owns an entry predicate using `Transition.coldLoad`, `Transition.make`, and `Transition.isEntering` for the `Document` route. `update.ts` records the route-entry fact only for `coldLoad` and `entered` events.
- The plan now identifies workspace-filtered `bun run test` as the gate and documents raw `bun test` as non-gating due to vendored `foldkit-main` missing dependencies and upstream failures.

Final review-wave verification:

- `bun test packages/astro-foldkit/test/unit/client.test.ts`: PASS, 8 tests including the old-window/new-destination regression.
- `bunx vitest run src/apps/request-diagnostics/navigation.test.ts` from `apps/web`: PASS, 4 tests including entry predicate behavior.
- `bun run test`: PASS, 119 FoldKit Viz tests, 47 Astro tests, and 42 web tests.
- `bun run check`: PASS with existing lint warnings; formatting clean.
- `bun typecheck`: PASS across all workspaces; web reports 0 errors, 0 warnings, and 0 hints.
- `bun run --filter @opsydyn/astro-foldkit build`: PASS.
- `bun run --filter @opsydyn/astro-foldkit test:integration`: PASS, 2 packed-consumer smoke tests.
- `bun run --filter @opsydyn/web build`: PASS. The web script builds the workspace Astro package first, then resolves it through the package export boundary and completes the Cloudflare server build.
- `git diff --check`: PASS.

Known limitation: raw `bun test` is intentionally non-gating. It discovers vendored `foldkit-main` tests with unrelated missing dependencies and upstream failures; the workspace-filtered `bun run test` result above is the repository gate.
