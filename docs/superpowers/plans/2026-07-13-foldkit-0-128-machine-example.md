# FoldKit 0.128 Machine Example Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the workspace to FoldKit 0.128.0, restore real package-resolution boundaries in the Astro app, and add a practical state-machine chart example that exercises both workspace packages.

**Architecture:** Keep `@opsydyn/foldkit-viz` as a pure chart primitive package and keep `@opsydyn/astro-foldkit` as the Astro renderer/integration package. Implement the showcase as a consumer app in `apps/web`: a request-diagnostics explorer that loads data through `foldkit/http`, renders the existing histogram and scatter primitives, and uses `foldkit/experimental/machine` to model loading, brush selection, filtering, and failure transitions.

**Tech Stack:** FoldKit 0.128.0, `foldkit/experimental/machine`, `foldkit/http`, Effect, Astro 7, `@opsydyn/astro-foldkit`, `@opsydyn/foldkit-viz`, Bun, TypeScript, Vitest, oxlint, oxfmt.

## Global Constraints

- All direct FoldKit ranges use `^0.128.0` and package peer minimums use `>=0.128.0`.
- `apps/web` imports `@opsydyn/astro-foldkit` and `@opsydyn/foldkit-viz` through package exports, never source-path aliases.
- `@opsydyn/foldkit-viz` must not depend on or export the experimental machine module.
- Machine transitions remain in the consumer app Model/update boundary; chart primitives remain pure and reusable.
- Use named FoldKit exports and the `Machine` namespace from `foldkit/experimental`.
- Preserve the existing Astro local-development adapter workaround and production Cloudflare build path.

---

### Task 1: Restore workspace package resolution and upgrade FoldKit

**Files:**

- Modify: `apps/web/tsconfig.json`
- Modify: `packages/astro-foldkit/package.json`
- Modify: `packages/foldkit-viz/package.json`
- Modify: `apps/web/package.json`
- Modify: `bun.lock`

**Interfaces:**

- Produces: `apps/web` resolves `@opsydyn/astro-foldkit` and `@opsydyn/foldkit-viz` through their package manifests and built exports.

- [x] **Step 1: Remove source-path aliases**

Delete `baseUrl` and the four `paths` entries from `apps/web/tsconfig.json`; retain the Astro strict config and Effect language-service plugin.

- [x] **Step 2: Update version ranges**

Change every direct `foldkit` development/runtime range in the three manifests from `^0.126.0` to `^0.128.0`, and change both package peer minimums from `>=0.126.0` to `>=0.128.0`.

- [x] **Step 3: Refresh the lockfile**

Run `bun install` and verify the lockfile resolves `foldkit@0.128.0`.

- [x] **Step 4: Verify package resolution**

Run `bun typecheck` and `bun run --filter @opsydyn/astro-foldkit test`.

Expected: all workspace typechecks pass and the Astro package integration tests pass without source aliases.

### Task 2: Add a machine-driven request diagnostics example

**Files:**

- Create: `apps/web/src/apps/request-diagnostics/app.ts`
- Create: `apps/web/src/apps/request-diagnostics/main.ts`
- Create: `apps/web/src/apps/request-diagnostics/model.ts`
- Create: `apps/web/src/apps/request-diagnostics/message.ts`
- Create: `apps/web/src/apps/request-diagnostics/command.ts`
- Create: `apps/web/src/apps/request-diagnostics/update.ts`
- Create: `apps/web/src/apps/request-diagnostics/view.ts`
- Create: `apps/web/src/apps/request-diagnostics/request-diagnostics.css.ts`
- Create: `apps/web/src/pages/request-diagnostics.astro`
- Modify: `apps/web/src/layouts/Layout.astro`
- Modify: `apps/web/src/pages/api/health.ts` or add a dedicated API fixture route

**Interfaces:**

- Consumes: `@opsydyn/foldkit-viz/math/bin`, `@opsydyn/foldkit-viz/math/brush`, existing histogram/scatter chart views, `foldkit/http`, and `Machine.define`.
- Produces: a FoldKit app loaded by `@opsydyn/astro-foldkit/define-app` and mounted by Astro with `client:load`.

- [x] **Step 1: Define state and Message Schemas**

Use tagged states `Idle`, `Loading`, `Ready`, `Selecting`, `Filtered`, and `Failed`. Define Messages for reload, HTTP success/failure, histogram child messages, scatter child messages, and clear selection. Keep child Messages behind `Schema.Unknown` plus explicit TypeScript overrides, matching the existing chart app pattern.

- [x] **Step 2: Define the HTTP Command**

Use `HttpClient.get` from `foldkit/http` against a local Astro API fixture returning request-latency/error-rate points. Decode the response with Effect Schema and map success/failure to past-tense Messages.

- [x] **Step 3: Define the Machine**

Compile the transition table with `Machine.define`. Use guarded `Machine.when` branches for valid versus empty selections, `Machine.otherwise` for rejected selections, and an edge Command for loading data. Expose `step()` results so the view can show the last transition and ignored-message cases.

- [x] **Step 4: Integrate the Machine into update**

Delegate chart child updates to the existing primitives, translate brush events into machine Messages, apply the machine result to the Model, and return transition Commands from the FoldKit update function. Do not duplicate a second state machine in ad hoc `if`/`Set` logic.

- [x] **Step 5: Add the Astro page and navigation entry**

Mount the app with `<RequestDiagnosticsApp client:load />` on `/request-diagnostics` and add a navigation link in the shared Layout.

- [x] **Step 6: Add focused tests first**

Test the machine’s guarded transitions, the ignored-message result, and the chart filtering behavior. Run the focused tests red before implementation, then green after implementation.

### Task 3: Document the package-facing example

**Files:**

- Modify: `packages/foldkit-viz/README.md`
- Modify: `packages/astro-foldkit/README.md`
- Modify: `apps/web/README.md`

**Interfaces:**

- Produces: users can discover the machine example as a consumer-level integration of both packages.

- [x] **Step 1: Document the boundary**

State that `foldkit-viz` supplies pure chart primitives, `astro-foldkit` supplies Astro mounting, and the application owns the FoldKit machine.

- [x] **Step 2: Link the runnable example**

Add the `/request-diagnostics` route and a short import example using package names rather than source paths.

### Task 4: Run full verification

- [x] Run `bun run check`.
- [x] Run `bun typecheck`.
- [x] Run `bun run test`.
- [x] Run `bun run build`.
- [x] Verify live HTTP responses for `/`, `/request-diagnostics`, and `/api/request-diagnostics` return HTTP 200.
