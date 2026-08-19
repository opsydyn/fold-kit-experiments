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
