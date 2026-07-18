# Task 3 Report: Document The Contract And Verify The Workspace

## Scope

- Added `@opsydyn/foldkit-viz/interaction/selection` to
  `packages/foldkit-viz/README.md`.
- Documented the parent-owned selection pattern, including
  `intervalSelection` and `selectionContainsValue`, and clarified that Viz
  owns pure values, charts own local gestures, and parents own shared state and
  child-message coordination.
- Limited `keySelection` to its future hover/active-series role and did not
  claim hover or zoom implementation.
- Marked only the completed parent-owned selection-contract item in
  `docs/roadmap.md`.
- Formatted `docs/superpowers/plans/2026-07-18-viz-selection-contract.md`
  because the repository formatter identified it as the known full-check gate.

## Verification

Commands ran sequentially:

1. `bun run check`
   - Exit 1.
   - `oxfmt --check .` passed after formatting the committed plan.
   - The remaining failure is an existing `linteffect(no-try-catch)` error in
     `packages/foldkit-viz/test/package-import-smoke.test.ts:22`. Task 3
     forbids source and test changes, so it was left unchanged.
2. `bun typecheck`
   - Exit 0.
   - All three workspaces completed successfully; Astro reported 0 errors,
     0 warnings, and 0 hints.
3. `bun run test`
   - Exit 0.
   - `@opsydyn/foldkit-viz`: 124 passed, 0 failed.
   - `@opsydyn/astro-foldkit`: 48 passed, 0 failed.
   - `@opsydyn/web`: 51 passed, 0 failed.
   - Total: 223 passed, 0 failed.
4. `git diff --check`
   - Exit 0.

## Self-Review

- No source or test files were modified.
- No remaining interaction-layer, reference-app, release-quality, or
  deliberate-non-goal roadmap checkboxes changed.
- The README describes the public selection import and preserves the
  parent-owned contract without overstating future hover or zoom support.
- The committed-plan formatting is limited to formatter-required Markdown
  table, fence, and wrapping changes.

## Commit

Committed as `docs: explain parent-owned chart selection`.

## Concern

The workspace does not meet the brief's expected all-green `bun run check`
result because of the pre-existing, out-of-scope lint error above. Formatting
is green and all typechecking, tests, and diff checks pass.

## Addendum: Later Lint Cleanup

The later lint cleanup changed
`packages/foldkit-viz/test/package-import-smoke.test.ts` so module-level
fixture handles remove any created temporary directory or tarball from
`afterAll` without awaiting a rejected fixture promise. The packed TypeScript
consumer and Bun runtime import proof remain in place.

Commands ran sequentially after that change:

1. `bun test packages/foldkit-viz/test/package-import-smoke.test.ts`
   - Exit 0: 1 pass, 0 fail.
2. `bun run check`
   - Exit 0.
3. `bun typecheck`
   - Exit 0.
4. `bun run test`
   - Exit 0: 223 pass, 0 fail (124 foldkit-viz, 48 astro-foldkit, 51 web).
5. `git diff --check`
   - Exit 0.

## Final-Review Fixes

The packed TypeScript consumer now imports `intervalSelection` from both
`@opsydyn/foldkit-viz` and `@opsydyn/foldkit-viz/interaction/selection`.
The packed Bun runtime check imports both entry points and proves that each
returns an `Interval` selection.

`npm pack --pack-destination` now writes the archive inside the fixture
temporary directory. The existing `afterAll` cleanup covers the successful
fixture without introducing `try`/`catch` or lint suppression; the injected
failure fixture is cleaned explicitly by its test.

## Final-Review Concern

Later review identified that the report described an injected pack-failure
cleanup proof that the smoke test did not contain.

## Final-Review Failure-Path Fix

The smoke fixture is now created separately from setup so the pack executor
can be injected. The failure-path test creates a partial tarball, injects an
`npm pack` failure after temporary-directory creation, runs fixture cleanup,
and verifies that neither the fixture directory nor tarball remains.

Commands ran sequentially:

1. `bun test packages/foldkit-viz/test/package-import-smoke.test.ts`
   - Exit 0: 2 pass, 0 fail, including the injected pack-failure cleanup path.
2. `bun run --filter @opsydyn/foldkit-viz test`
   - Exit 0: 125 pass, 0 fail across 11 files.
3. `bun run check`
   - Exit 0.
4. `bun typecheck`
   - Exit 0: all workspaces completed; Astro reported 0 errors, 0 warnings,
     and 0 hints.
5. `bun run test`
   - Exit 0: 224 pass, 0 fail (125 foldkit-viz, 48 astro-foldkit, 51 web).
6. `git diff --check`
   - Exit 0.
