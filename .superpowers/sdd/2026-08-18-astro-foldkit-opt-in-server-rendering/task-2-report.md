# Task 2 Report — Astro FoldKit page marker/config contract

Date: 2026-08-19
Branch: `feat/astro-foldkit-server-rendering`
Worktree: `/Users/alancurrie/Projects/fold-kit-experiments/.worktrees/astro-foldkit-server-rendering`

## Scope

Formalize only the public `definePage` marker/configuration contract. Do not implement server rendering, document resolution, or client hydration.

## Summary

Implemented the public page contract so `definePage` remains a distinct inert marker carrying `__foldkitPage: true`, while page configs now require a FoldKit-compatible `Flags` schema value and expose explicit page context types at the `define-page` boundary.

## Changed files

- `packages/astro-foldkit/src/types.ts`
- `packages/astro-foldkit/src/define-page.ts`
- `packages/astro-foldkit/test/unit/define-page.test.ts`

## TDD log

### RED

First failing check:

```text
$ bun run --filter @opsydyn/astro-foldkit typecheck
test/unit/define-page.test.ts(9,15): error TS2305: Module '"../../src/define-page"' has no exported member 'PageConfig'.
test/unit/define-page.test.ts(9,27): error TS2724: '"../../src/define-page"' has no exported member named 'PageFlagsContext'. Did you mean 'PageContext'?
test/unit/define-page.test.ts(28,5): error TS2578: Unused '@ts-expect-error' directive.
```

Reason for failure:

- `define-page` did not export the required public page contract types.
- Page configs still accepted a config without a `Flags` codec.

### GREEN

Targeted package checks after implementation:

```text
$ bun run --filter @opsydyn/astro-foldkit typecheck
Exited with code 0
```

```text
$ bun test packages/astro-foldkit/test/unit/define-page.test.ts
1 pass
0 fail
5 expect() calls
```

## Implementation notes

- Added `PageFlagsContext<Props>` as the explicit synchronous public request context.
- Kept `PageContext<Props>` as an alias to preserve existing scaffolding compatibility.
- Added `PageFlagsSchema<Flags>` using Effect RC `Schema.Codec<Flags, any, never, never>`.
- Added `PageConfig<Flags, Model, Message>` so page configs require `Flags` plus the existing app config contract.
- Tightened `PageConfigShape` to require `Flags`.
- Re-exported `PageConfig`, `PageFlagsContext`, and `PageFlagsSchema` from `src/define-page.ts`.
- Left `defineApp` / `lazyApp` untouched and distinct from page types.
- Left `definePage` runtime behavior inert: it still preserves the loader and marker without dispatch or resolution.

## Verification

### Fresh passing evidence

```text
$ bun run --filter @opsydyn/astro-foldkit check
All matched files use the correct format.
Exited with code 0
```

```text
$ bun typecheck
@opsydyn/foldkit-viz typecheck: Exited with code 0
@opsydyn/astro-foldkit typecheck: Exited with code 0
@opsydyn/web typecheck: Result (478 files):
- 0 errors
- 0 warnings
- 0 hints
@opsydyn/web typecheck: Exited with code 0
```

### Fresh failing evidence outside this task

```text
$ bun test
13 tests failed
178 pass
13 fail
12 errors
```

Observed unrelated failures:

- `packages/foldkit-viz/test/package-import-smoke.test.ts`
  - consumer resolution failure for `@opsydyn/foldkit-viz`
- multiple `apps/web` tests
  - missing named FoldKit exports such as `Scene`, `Story`, `Mount`, `Http`, `Command`
  - Vanilla Extract file-scope error in `apps/web/src/apps/greeting/greeting.css.ts`

```text
$ bun run check
error: script "check" exited with code 1
```

Observed unrelated repo-wide check failure:

- pre-existing lint warnings across `apps/web`, `packages/foldkit-viz`, and `packages/astro-foldkit`
- formatting failure in `docs/superpowers/specs/2026-08-18-astro-foldkit-opt-in-server-rendering-design.md`

## Concerns

- Repo-wide `bun test` is not green in this worktree after the FoldKit 0.148 pin; failures are outside the Task 2 files.
- Repo-wide `bun run check` is not green in this worktree because of pre-existing warnings and an unrelated spec-formatting failure.
- Task 3 should consume the new `PageConfig` / `PageFlagsSchema` contract directly rather than widening app markers.
