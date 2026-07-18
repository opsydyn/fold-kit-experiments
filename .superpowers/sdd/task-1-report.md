# Task 1 Report: Pure Selection Contract

## Status

DONE_WITH_CONCERNS

## Changed Paths

- `packages/foldkit-viz/src/interaction/selection.ts`
- `packages/foldkit-viz/test/selection.test.ts`
- `packages/foldkit-viz/src/index.ts`
- `packages/foldkit-viz/package.json`

## RED

Command:

```sh
bun run --filter @opsydyn/foldkit-viz test -- test/selection.test.ts
```

Result: expected failure, exit code 1. Bun reported that
`../src/interaction/selection` could not be found. The test suite recorded 0
pass and 1 fail.

## GREEN

Commands:

```sh
bun run --filter @opsydyn/foldkit-viz test -- test/selection.test.ts
bun run --filter @opsydyn/foldkit-viz typecheck
bun run --filter @opsydyn/foldkit-viz check
```

Results:

- Focused contract test: 4 pass, 0 fail, exit code 0.
- `@opsydyn/foldkit-viz` typecheck: exit code 0.
- `@opsydyn/foldkit-viz` check: exit code 0; existing warnings only.
- Full `@opsydyn/foldkit-viz` test suite: 123 pass, 0 fail.
- `git diff --check`: exit code 0.

## Self-Review

- The public module is pure and framework-free.
- Interval construction normalises endpoints and empties collapsed ranges.
- Clamping returns none for non-overlapping intervals before endpoint
  normalisation, which is necessary for the specified `[10, 20]` against
  `[100, 200]` contract test.
- Root and subpath exports both reference the generated selection declaration
  and module paths.
- The staged commit contains only the four Task 1 files listed above.

## Commit

`1526cd6b4c97ec2a76604faf2849931c3be3525a`

Message: `feat(foldkit-viz): add selection contract`

## Concerns

1. Repository-wide `bun run check` remains non-zero because the pre-existing
   `docs/superpowers/plans/2026-07-18-viz-selection-contract.md` needs
   formatting. It was not changed because this task prohibits documentation
   edits.
2. Raw `bun test` scans vendored `foldkit-main` content and fails on its
   unmanaged dependencies. The declared workspace test script and the full
   foldkit-viz suite pass.

## Review Fix: Selection Subpath Packaging Proof

### Changed Paths

- `packages/foldkit-viz/tsdown.config.ts`
- `packages/foldkit-viz/test/package-import-smoke.test.ts`

### RED

Command:

```sh
bun run --filter @opsydyn/foldkit-viz test -- test/package-import-smoke.test.ts
```

Result: expected failure, exit code 1. The built, packed consumer failed
TypeScript resolution with `TS2307: Cannot find module
'@opsydyn/foldkit-viz/interaction/selection' or its corresponding type
declarations.` The package manifest exposed the subpath, but tsdown did not
emit its module or declaration files.

### GREEN

Commands:

```sh
bun run --filter @opsydyn/foldkit-viz test -- test/package-import-smoke.test.ts
bun run --filter @opsydyn/foldkit-viz typecheck
bun run --filter @opsydyn/foldkit-viz build
bun pm pack --dry-run
git diff --check
```

Results:

- Focused packed-consumer test: 1 pass, 0 fail, exit code 0. It builds and
  packs the package, typechecks an isolated TypeScript consumer of the
  selection subpath, then imports the subpath at runtime.
- `@opsydyn/foldkit-viz` typecheck: exit code 0.
- `@opsydyn/foldkit-viz` build: exit code 0; emitted
  `dist/interaction/selection.mjs` and
  `dist/interaction/selection.d.mts`.
- `bun pm pack --dry-run`: exit code 0; includes both emitted selection
  artefacts.
- `git diff --check`: exit code 0.

### Self-Review

- Added only the missing `interaction/selection` tsdown entry; no public
  manifest, root-export, app, roadmap, or unrelated export changed.
- The regression test uses an extracted package tarball in an isolated
  consumer directory, covering the published export map rather than source
  resolution.
- The test verifies both declaration resolution through `tsc` and runtime
  import through Bun.

### Commit

`54d770f7584c95abc01bf58f4573c5c8065391f9`

Message: `fix(foldkit-viz): package selection subpath`

## Review Fix: Async Fixture Cleanup

### Changed File

- `packages/foldkit-viz/test/package-import-smoke.test.ts`

### Change

- Replaced the `try/finally` cleanup with the established async fixture and
  `afterAll` cleanup pattern from the Astro integration smoke test.
- Preserved package build, pack/extract, isolated consumer TypeScript
  resolution, Bun runtime import, temporary directory cleanup, and tarball
  cleanup.
- No lint suppression or production changes were made.

### Verification

Commands and results:

```text
Pre-refactor focused test: 1 pass, 0 fail, exit code 0.
bun run --filter @opsydyn/foldkit-viz test -- test/package-import-smoke.test.ts

Post-refactor focused test: 1 pass, 0 fail, exit code 0.
bun run --filter @opsydyn/foldkit-viz test -- test/package-import-smoke.test.ts

bun run check: exit code 0; existing lint warnings remain and formatting passed.
bun typecheck: exit code 0.
git diff --check: exit code 0.
```

The focused test left no entries in `packages/foldkit-viz/artifacts/test` and
no package tarball in `packages/foldkit-viz`.

### Concerns

- Literal `bun test` remains non-zero because it scans vendored `foldkit-main`
  tests with unmanaged dependencies: 614 pass, 509 fail, and 506 errors
  across 1123 tests. The focused workspace test passes.

### Commit

`daaa07108cd7766c1d1aa52c71af9fbb669d47ed`

Message: `fix(foldkit-viz): use async smoke fixture cleanup`
