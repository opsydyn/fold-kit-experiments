# Task 5 Report: Browser Page-Owner Hydration Branch

## Status

Implemented in `/Users/alancurrie/Projects/fold-kit-experiments/.worktrees/astro-foldkit-server-rendering` on branch `feat/astro-foldkit-server-rendering`.

## Changed Files

- `packages/astro-foldkit/src/client.ts`
- `packages/astro-foldkit/src/client-helpers.ts`
- `packages/astro-foldkit/test/unit/client.test.ts`
- `packages/astro-foldkit/test/unit/client-helpers.test.ts`

## Implementation Summary

- Added a page-owner client branch for components carrying `__foldkitPage: true`.
- The page branch loads the page config unchanged, calls `runtime.makeApplication(config)`, verifies exactly one stamped FoldKit root inside the Astro island, and calls `runtime.hydrate(application, { buildId })`.
- The page branch returns before the app-island `Runtime.embed`, navigation bridge, and `astro:unmount` disposal fallback.
- Kept `defineApp` / `lazyApp` behavior on the existing `Runtime.makeApplication` plus `Runtime.embed` path, including props-to-init override, `noMeta`, navigation forwarding, and one-shot disposal.
- Added static build identity import via `readFoldkitBuildId`; no server public API import was added to client code.

## RED Evidence

Command:

```sh
bun test packages/astro-foldkit/test/unit/client.test.ts
```

Result: exit 1.

Expected failures:

- `hydrates page owners with the loaded config and build identity without embedding` failed because the current client treated a page owner as an app island. `makeApplication` received a spread config with `container` and `preserveScroll`, not the loaded page config object.
- `refuses page hydration unless exactly one stamped FoldKit root is inside the island` failed because the current client resolved instead of refusing missing or duplicated stamped roots.

Command:

```sh
bun test packages/astro-foldkit/test/unit/client-helpers.test.ts
```

Result: exit 1.

Expected failure:

- `findSingleFoldkitRoot` was not exported yet. This covered the missing root-query helper before production helper code was added.

## GREEN Evidence

Command:

```sh
bun test packages/astro-foldkit/test/unit/client.test.ts packages/astro-foldkit/test/unit/client-helpers.test.ts
```

Result: exit 0.

Summary: 22 pass, 0 fail, 43 assertions.

## Final Verification

Command:

```sh
bun run check
```

Result: exit 0.

Notes: formatting clean. The command still prints existing repo linteffect and vanilla-extract warnings outside this slice.

Command:

```sh
bun typecheck
```

Result: exit 0.

Summary: all workspaces completed; `@opsydyn/web` Astro check reported 478 files with 0 errors, 0 warnings, 0 hints.

Command:

```sh
bun run test
```

Result: exit 0.

Summary:

- `@opsydyn/astro-foldkit`: 70 pass, 0 fail.
- `@opsydyn/foldkit-viz`: 125 pass, 0 fail.
- `@opsydyn/web`: 55 pass, 0 fail.

Additional command:

```sh
bun test
```

Result: exit 1.

Observed failures were outside this slice in `apps/web` files when raw Bun test discovery executed Vitest/Story/Scene-oriented tests directly. Failures included missing `foldkit` exports (`Scene`, `Story`, `Mount`, `Command`, `Http`) and a Vanilla Extract file-scope setup error. The workspace-scripted `bun run test` path routes `apps/web` through `vitest run` and passes.

## Concerns

- Raw root `bun test` is not a valid green gate for the current workspace because it runs `apps/web` test files under Bun directly instead of the package's configured Vitest runner. I did not alter unrelated test routing in this Task 5 slice.
- No visual browser hydration smoke was run; this slice is covered by focused client unit tests plus the scripted workspace gates.

## Fix Round 1

### Review Findings Addressed

- Resolved the unique page root before creating the page runtime application.
- Page-owner runtime creation now calls `runtime.makeApplication({ ...config, container: root })`, preserving the loaded config's `Flags`, `Model`, `init`, `update`, `view`, and extra fields while supplying FoldKit 0.148's required `container`.
- `findSingleFoldkitRoot` now queries `[data-foldkit-app]` only, allowing missing or mismatching `data-foldkit-build` to reach `Runtime.hydrate`.
- Page client tests now assert the selected root is passed as `container`, root validation happens before `makeApplication`, and app-stamped roots with missing/mismatching build attributes are not rejected by the client before hydrate.

### Changed Files

- `packages/astro-foldkit/src/client.ts`
- `packages/astro-foldkit/src/client-helpers.ts`
- `packages/astro-foldkit/test/unit/client.test.ts`
- `packages/astro-foldkit/test/unit/client-helpers.test.ts`

### RED Evidence

Command:

```sh
bun test packages/astro-foldkit/test/unit/client.test.ts packages/astro-foldkit/test/unit/client-helpers.test.ts
```

Result: exit 1.

Observed failing output:

```text
(fail) astro-foldkit client renderer > hydrates page owners with the loaded config and build identity without embedding
error: Expected exactly one stamped FoldKit root inside the Astro island, found 0.

(fail) astro-foldkit client renderer > lets Runtime.hydrate reject missing or mismatching page build stamps
error: Expected exactly one stamped FoldKit root inside the Astro island, found 0.

(fail) astro-foldkit client renderer > refuses page hydration unless exactly one stamped FoldKit root is inside the island
Expected: 0
Received: 1

(fail) findSingleFoldkitRoot > returns the one stamped FoldKit root inside the owner island
error: Expected exactly one stamped FoldKit root inside the Astro island, found 0.

(fail) findSingleFoldkitRoot > allows Runtime.hydrate to handle absent or mismatched build stamps
error: Expected exactly one stamped FoldKit root inside the Astro island, found 0.

19 pass
5 fail
34 expect() calls
Ran 24 tests across 2 files.
```

Expected meaning:

- The old helper still queried `[data-foldkit-app][data-foldkit-build]`, so tests using real `[data-foldkit-app]` query behavior found no candidates.
- The old page branch still called `makeApplication` before root validation.

### GREEN Evidence

Command:

```sh
bun test packages/astro-foldkit/test/unit/client.test.ts packages/astro-foldkit/test/unit/client-helpers.test.ts
```

Result: exit 0.

Output:

```text
24 pass
0 fail
51 expect() calls
Ran 24 tests across 2 files.
```

Command:

```sh
bun run --filter @opsydyn/astro-foldkit check
```

Result: exit 0.

Output:

```text
All matched files use the correct format.
Finished in 118ms on 30 files using 12 threads.
@opsydyn/astro-foldkit check: Exited with code 0
```

Note: oxlint still prints warning-class diagnostics in existing package tests/source and in the touched client tests; the package check script exits 0.

Command:

```sh
bun run --filter @opsydyn/astro-foldkit typecheck
```

Result: exit 0.

Output:

```text
@opsydyn/astro-foldkit typecheck: Exited with code 0
```

Command:

```sh
bun run test
```

Result: exit 0.

Output:

```text
@opsydyn/astro-foldkit test:  72 pass
@opsydyn/astro-foldkit test:  0 fail
@opsydyn/foldkit-viz test:  125 pass
@opsydyn/foldkit-viz test:  0 fail
@opsydyn/web test:  Test Files  13 passed (13)
@opsydyn/web test:       Tests  55 passed (55)
```

Command:

```sh
bun typecheck
```

Result: exit 0.

Output:

```text
@opsydyn/foldkit-viz typecheck: Exited with code 0
@opsydyn/astro-foldkit typecheck: Exited with code 0
@opsydyn/web typecheck: Result (478 files):
@opsydyn/web typecheck: - 0 errors
@opsydyn/web typecheck: - 0 warnings
@opsydyn/web typecheck: - 0 hints
@opsydyn/web typecheck: Exited with code 0
```

### Remaining Concerns

- Raw root `bun test` remains unsuitable for this workspace for the same reason recorded above: it bypasses `apps/web`'s Vitest runner. I did not rerun it in this fix round.
- No lifecycle redesign was attempted for repeated invocation/deferred load; this fix round stayed scoped to the runtime contract and root-selection findings.
