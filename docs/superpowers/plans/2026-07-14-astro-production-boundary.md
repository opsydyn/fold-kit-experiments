# Astro Production Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `@opsydyn/astro-foldkit` a typed, lifecycle-safe Astro host with an explicit stable SSR boundary.

**Architecture:** Preserve the existing `defineApp` marker and `Runtime.makeApplication` integration. Replace the weak structural types with generic application contracts, make the server renderer emit deterministic island markup, and test the client renderer through injected runtime seams rather than a browser-only integration test. Keep routing, viz interactions, and application state ownership outside this package.

**Tech Stack:** Astro 7, FoldKit 0.128.0, TypeScript, Effect, Bun, oxlint, oxfmt.

## Global Constraints

- `@opsydyn/astro-foldkit` remains the Astro integration package; `@opsydyn/foldkit-viz` remains framework-agnostic.
- `apps/web` imports `@opsydyn/astro-foldkit` through its package export, never a source-path alias.
- Application state remains owned by the FoldKit Model and update function.
- The integration must not provision runtime dependencies inside local helper Effects.
- Client code must not execute browser globals from the SSR renderer.
- Verification uses `bun run check`, `bun typecheck`, `bun run --filter @opsydyn/astro-foldkit test`, and the packed import smoke test.

---

### Task 1: Lock the public type contract

**Files:**

- Modify: `packages/astro-foldkit/src/types.ts`
- Modify: `packages/astro-foldkit/src/define-app.ts`
- Test: `packages/astro-foldkit/test/unit/define-app.test.ts`
- Test: `packages/astro-foldkit/test/unit/define-app.property.test.ts`

**Interfaces:**

- Produces `AppConfig<Props, Model, Message>` with typed `init`, `update`, and `view` fields.
- Produces `FoldkitApp<Props, Model, Message>` whose loader returns `Promise<AppConfig<Props, Model, Message>>`.

- [ ] **Step 1: Add a compile-time contract test**

Add a typed fixture to the unit test using `Props = { initialCount: number }`, `Model = { count: number }`, and a tagged `Message` union. Assert that `defineApp<Props, Model, Message>` accepts the fixture and that `load()` preserves the typed config.

- [ ] **Step 2: Run the focused test to establish the failure**

Run:

```sh
bun test packages/astro-foldkit/test/unit/define-app.test.ts
```

Expected: the new fixture fails to type-check or the current untyped signature does not preserve the expected generic result.

- [ ] **Step 3: Implement the smallest generic types**

Define the application contract using the existing FoldKit tuple shapes:

```ts
export type AppConfig<Props, Model, Message> = {
  readonly init: (props: Props) => readonly [Model, ReadonlyArray<unknown>];
  readonly update: (model: Model, message: Message) => readonly [Model, ReadonlyArray<unknown>];
  readonly view: (model: Model) => unknown;
};

export type FoldkitApp<Props, Model, Message> = {
  (props?: Props): void;
  readonly __foldkit: true;
  readonly load: () => Promise<AppConfig<Props, Model, Message>>;
};
```

Use the narrowest command type that the installed FoldKit runtime accepts; do not reintroduce `any` to silence incompatibilities.

- [ ] **Step 4: Run focused tests and typecheck**

Run:

```sh
bun test packages/astro-foldkit/test/unit/define-app.test.ts
bun run --filter @opsydyn/astro-foldkit typecheck
```

Expected: focused tests pass and the package typecheck exits 0.

- [ ] **Step 5: Commit**

```sh
git add packages/astro-foldkit/src/types.ts packages/astro-foldkit/src/define-app.ts packages/astro-foldkit/test/unit/define-app.test.ts packages/astro-foldkit/test/unit/define-app.property.test.ts
git commit -m "feat(astro-foldkit): type application contract"
```

### Task 2: Define deterministic server output

**Files:**

- Modify: `packages/astro-foldkit/src/server.ts`
- Create: `packages/astro-foldkit/test/unit/server.test.ts`
- Modify: `packages/astro-foldkit/README.md`

**Interfaces:**

- Produces a deterministic `renderToStaticMarkup` result for a valid FoldKit app.
- Preserves `check` rejection for non-FoldKit components.

- [ ] **Step 1: Write renderer output tests**

Add tests that assert a valid app returns stable markup containing the FoldKit island marker and that two calls with the same renderer inputs return equal output. Keep the test independent of `document` and `window`.

- [ ] **Step 2: Run the server test to establish the failure**

Run:

```sh
bun test packages/astro-foldkit/test/unit/server.test.ts
```

Expected: the test fails because the current renderer returns `{ html: '' }`.

- [ ] **Step 3: Implement the minimal SSR shell**

Return a deterministic element or comment-based island shell with no browser-global access. Keep the renderer's responsibility limited to the mount boundary and document the output contract in the README. Do not execute `component.load()` or `Runtime.makeApplication` during SSR.

- [ ] **Step 4: Run package tests and formatting**

Run:

```sh
bun test packages/astro-foldkit/test/unit/server.test.ts
bun run check
```

Expected: the new test passes and formatting/lint completes with the repository's existing warning baseline.

- [ ] **Step 5: Commit**

```sh
git add packages/astro-foldkit/src/server.ts packages/astro-foldkit/test/unit/server.test.ts packages/astro-foldkit/README.md
git commit -m "feat(astro-foldkit): define stable ssr shell"
```

### Task 3: Make client embedding lifecycle-safe

**Files:**

- Modify: `packages/astro-foldkit/src/client.ts`
- Modify: `packages/astro-foldkit/src/types.ts`
- Create: `packages/astro-foldkit/test/unit/client.test.ts`

**Interfaces:**

- Consumes the generic `FoldkitApp<Props, Model, Message>` contract from Task 1.
- Produces one runtime handle per island and disposes it once on `astro:unmount`.

- [ ] **Step 1: Write lifecycle tests around the runtime seam**

Test that the component loader is called once, `init` receives the Astro props, `Runtime.embed` is called once, and repeated unmount events do not call `dispose` more than once. Use a small injected or mockable runtime seam rather than launching Astro.

- [ ] **Step 2: Run the focused client test to establish the failure**

Run:

```sh
bun test packages/astro-foldkit/test/unit/client.test.ts
```

Expected: the lifecycle assertions expose the current hard-coded runtime calls or duplicate-disposal behavior.

- [ ] **Step 3: Implement guarded lifecycle ownership**

Keep the runtime handle local to the renderer invocation, register one unmount callback, and guard disposal with a local `disposed` boolean that is set before calling `handle.dispose()`. Preserve `noMeta` behavior and props forwarding.

- [ ] **Step 4: Run focused tests and package typecheck**

Run:

```sh
bun test packages/astro-foldkit/test/unit/client.test.ts
bun run --filter @opsydyn/astro-foldkit typecheck
```

Expected: all lifecycle assertions pass and typecheck exits 0.

- [ ] **Step 5: Commit**

```sh
git add packages/astro-foldkit/src/client.ts packages/astro-foldkit/src/types.ts packages/astro-foldkit/test/unit/client.test.ts
git commit -m "fix(astro-foldkit): make island disposal one-shot"
```

### Task 4: Verify the published-package boundary

**Files:**

- Modify: `packages/astro-foldkit/test/integration/package-import-smoke.test.ts` only if coverage is missing
- Modify: `packages/astro-foldkit/package.json` only if the package build or export contract requires it
- Modify: `packages/astro-foldkit/README.md` if consumer instructions need correction

**Interfaces:**

- Produces a repeatable packed-consumer check for the public package export.

- [ ] **Step 1: Run the existing packed import smoke test**

Run:

```sh
bun test packages/astro-foldkit/test/integration/package-import-smoke.test.ts
```

Expected: the built package imports successfully under Bun and Node.

- [ ] **Step 2: Add only the missing public-boundary assertion**

If the test does not import the renderer and `define-app` public exports from the packed artifact, add those exact imports and assert they are callable. Do not add source-directory imports.

- [ ] **Step 3: Run the packed test again**

Run:

```sh
bun test packages/astro-foldkit/test/integration/package-import-smoke.test.ts
```

Expected: the consumer script passes against the package build output.

- [ ] **Step 4: Commit**

```sh
git add packages/astro-foldkit/test/integration/package-import-smoke.test.ts packages/astro-foldkit/package.json packages/astro-foldkit/README.md
git commit -m "test(astro-foldkit): verify packed consumer boundary"
```

### Task 5: Run the slice verification gate

- [ ] Run `bun run check` and confirm it exits 0; record existing warnings without expanding scope.
- [ ] Run `bun typecheck` and confirm all three workspaces report 0 errors.
- [ ] Run `bun run --filter '*' test` and confirm 119 viz, 34 Astro, and 32 web tests pass, excluding raw discovery of `foldkit-main/`.
- [ ] Run `bun run build` and confirm both package and web builds pass.
- [ ] Run `git diff --check` and confirm no whitespace errors.
- [ ] Review the final diff for public API changes and update the roadmap checkboxes for completed work.
- [ ] Commit the final documentation/checklist update:

```sh
git add docs/roadmap.md docs/superpowers/specs/2026-07-14-astro-production-boundary-design.md docs/superpowers/plans/2026-07-14-astro-production-boundary.md
git commit -m "docs: add foldkit product roadmap and astro slice plan"
```
