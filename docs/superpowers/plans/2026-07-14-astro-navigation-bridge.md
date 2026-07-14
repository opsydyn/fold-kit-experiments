# Astro Navigation Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in, typed Astro navigation bridge that forwards normalized navigation lifecycle values into a FoldKit inbound port and demonstrate it with a route-aware diagnostics app.

**Architecture:** `@opsydyn/astro-foldkit` will expose a small navigation contract on the loaded app config. Its client renderer will observe Astro lifecycle events, normalize paths and phases, map them with an app-owned function, and send them through a named FoldKit inbound port. The demo app will own its `restString` route parser, convert port values into `Navigated` Messages through a Subscription, and keep loading policy inside `update`.

**Tech Stack:** Bun, TypeScript, Astro 7, FoldKit 0.128.0, Effect Schema, FoldKit inbound Ports and Subscriptions, Bun tests, oxlint, oxfmt.

## Global Constraints

- Keep `@opsydyn/astro-foldkit` compatible with `foldkit >=0.128.0` and Astro `>=5.0.0`.
- Do not add a router, global navigation store, direct runtime Message dispatch, or automatic loading command to the integration.
- Use FoldKit inbound Ports as the host-to-app boundary.
- Keep route parsing and `Route.isEntering` policy in `apps/web`, where the route type is known. FoldKit 0.128 exposes the rest-segment parser as `rest`; use that actual API rather than the earlier roadmap shorthand `restString`.
- Preserve one-shot runtime disposal on `astro:unmount`.
- Follow repo message naming: `Navigated` is a past-tense fact.
- Run package-scoped tests while iterating; use `bun run check`, `bun typecheck`, and workspace-filtered tests before completion.

---

### Task 1: Add the Pure Navigation Contract

**Files:**

- Create: `packages/astro-foldkit/src/navigation.ts`
- Create: `packages/astro-foldkit/test/unit/navigation.test.ts`
- Modify: `packages/astro-foldkit/src/types.ts`

**Interfaces:**

- Produces `NavigationPhase`, `NavigationEvent`, `NavigationConfig<Value>`, and a pure `normalizeNavigationEvent` helper.
- `AppConfigShape<Props>` gains optional `navigation?: NavigationConfig<unknown>` and `ports?: unknown` fields so typed app modules can expose the bridge configuration without leaking it into the runtime config.

- [x] **Step 1: Write failing normalization tests**

Add tests covering the pure contract:

```ts
it('normalizes a pathname and previous pathname', () => {
  expect(
    normalizeNavigationEvent('stayed', new URL('https://example.test/repo/a').href, '/repo'),
  ).toEqual({ phase: 'stayed', path: '/repo/a', previousPath: '/repo' });
});

it('uses null when there is no previous URL', () => {
  expect(normalizeNavigationEvent('coldLoad', 'https://example.test/', null)).toEqual({
    phase: 'coldLoad',
    path: '/',
    previousPath: null,
  });
});
```

- [x] **Step 2: Run the focused test and verify the expected failure**

Run: `bun test packages/astro-foldkit/test/unit/navigation.test.ts`

Expected: FAIL because `navigation.ts` and `normalizeNavigationEvent` do not exist yet.

- [x] **Step 3: Implement the minimal pure helper**

Implement the exact contract:

```ts
export type NavigationPhase = 'coldLoad' | 'entered' | 'exited' | 'stayed';

export type NavigationEvent = {
  readonly phase: NavigationPhase;
  readonly path: string;
  readonly previousPath: string | null;
};

export type NavigationConfig<Value> = {
  readonly port: string;
  readonly map: (event: NavigationEvent) => Value;
};

export const normalizeNavigationEvent = (
  phase: NavigationPhase,
  currentUrl: string,
  previousUrl: string | null,
): NavigationEvent => ({
  phase,
  path: new URL(currentUrl, 'https://astro-foldkit.invalid').pathname,
  previousPath:
    previousUrl === null ? null : new URL(previousUrl, 'https://astro-foldkit.invalid').pathname,
});
```

Export the types and helper from the package entry point in Task 2.

- [x] **Step 4: Run the focused test and verify it passes**

Run: `bun test packages/astro-foldkit/test/unit/navigation.test.ts`

Expected: PASS.

- [x] **Step 5: Commit the pure contract**

```bash
git add packages/astro-foldkit/src/navigation.ts packages/astro-foldkit/test/unit/navigation.test.ts packages/astro-foldkit/src/types.ts
git commit -m "feat(astro-foldkit): add navigation event contract"
```

### Task 2: Forward Astro Lifecycle Events Through FoldKit Ports

**Files:**

- Modify: `packages/astro-foldkit/src/client.ts`
- Modify: `packages/astro-foldkit/src/types.ts`
- Modify: `packages/astro-foldkit/src/index.ts`
- Modify: `packages/astro-foldkit/test/unit/client.test.ts`
- Modify: `packages/astro-foldkit/README.md`

**Interfaces:**

- `ClientRuntime.embed` returns `{ ports: Record<string, { send(value: unknown): unknown }>; dispose(): void }` in the test seam.
- `createClientRenderer` reads `config.navigation`, sends `config.navigation.map(event)` to `handle.ports[config.navigation.port]`, and leaves the runtime mounted if the port is absent.
- The bridge listens on `document` for `astro:before-swap` and `astro:page-load`, and on the island element for `astro:unmount`.

- [x] **Step 1: Extend the client test seam and write failing tests**

Add tests for:

```ts
it('sends coldLoad through the configured inbound port', async () => {
  const sent: unknown[] = [];
  const runtime = makeRuntime({ navigation: { send: (value: unknown) => sent.push(value) } });
  await renderWith(runtime, { navigation: { port: 'navigation', map: (event) => event } });
  expect(sent).toEqual([{ phase: 'coldLoad', path: '/', previousPath: null }]);
});

it('stops forwarding and disposes once after unmount', async () => {
  const sent: unknown[] = [];
  const element = makeElement();
  await renderWith(makeRuntime({ navigation: { send: (value: unknown) => sent.push(value) } }), {
    navigation: { port: 'navigation', map: (event) => event },
    element,
  });
  element.dispatch('astro:unmount');
  document.dispatchEvent(new Event('astro:page-load'));
  expect(sent).toHaveLength(1);
});
```

Use the existing `makeElement` pattern and add a minimal document event target seam so the tests do not require a browser.

- [x] **Step 2: Run the focused client tests and verify failure**

Run: `bun test packages/astro-foldkit/test/unit/client.test.ts`

Expected: FAIL because the runtime seam has no ports and the renderer does not yet create navigation listeners.

- [x] **Step 3: Implement lifecycle forwarding**

Add a focused `attachNavigationBridge` helper in `client.ts` with this behavior:

```ts
function attachNavigationBridge(
  element: HTMLElement,
  navigation: NavigationConfig<unknown>,
  send: (value: unknown) => void,
  on: (type: string, listener: EventListener) => () => void,
): () => void {
  let active = true;
  let previousUrl: string | null = null;
  const forward = (phase: NavigationPhase, url: string) => {
    if (!active) return;
    const event = normalizeNavigationEvent(phase, url, previousUrl);
    previousUrl = url;
    send(navigation.map(event));
  };

  forward('coldLoad', window.location.href);
  const removePageLoad = on('astro:page-load', () => forward('entered', window.location.href));
  const removeBeforeSwap = on('astro:before-swap', () => forward('stayed', window.location.href));
  const removeUnmount = listenOnce(element, 'astro:unmount', () => {
    active = false;
    removePageLoad();
    removeBeforeSwap();
    forward('exited', window.location.href);
  });

  return () => {
    active = false;
    removePageLoad();
    removeBeforeSwap();
    removeUnmount();
  };
}
```

Adapt the exact event ordering to the tested Astro event seam. Do not send `exited` after `active` is false; instead send it immediately before deactivating during unmount. Do not throw if the configured port is missing; log a single `console.warn` and skip bridge setup.

Keep `astro:unmount` disposal idempotent and ensure bridge cleanup happens before or alongside `handle.dispose()`.

- [x] **Step 4: Export the public navigation types**

Update `packages/astro-foldkit/src/index.ts`:

```ts
export type { NavigationConfig, NavigationEvent, NavigationPhase } from './navigation';
```

Keep the default Astro integration export unchanged.

- [x] **Step 5: Update README usage**

Document an app module that declares an inbound port and navigation mapper, and show that Astro props and FoldKit runtime configuration remain separate. State that route parsing belongs in the app and that missing ports fail closed.

- [x] **Step 6: Run package tests and typecheck**

Run: `bun test packages/astro-foldkit/test/unit && bun run --filter @opsydyn/astro-foldkit typecheck`

Expected: all Astro unit tests pass and package typecheck exits 0.

- [x] **Step 7: Commit the bridge**

```bash
git add packages/astro-foldkit/src packages/astro-foldkit/test/unit/client.test.ts packages/astro-foldkit/README.md
git commit -m "feat(astro-foldkit): forward navigation through inbound ports"
```

### Task 3: Add the Route-Aware Diagnostics Example

**Files:**

- Create: `apps/web/src/apps/request-diagnostics/navigation.ts`
- Create: `apps/web/src/apps/request-diagnostics/subscription.ts`
- Modify: `apps/web/src/apps/request-diagnostics/message.ts`
- Modify: `apps/web/src/apps/request-diagnostics/model.ts`
- Modify: `apps/web/src/apps/request-diagnostics/update.ts`
- Modify: `apps/web/src/apps/request-diagnostics/view.ts`
- Modify: `apps/web/src/apps/request-diagnostics/main.ts`
- Modify: `apps/web/src/apps/request-diagnostics/app.ts`
- Modify: `apps/web/src/pages/request-diagnostics.astro`
- Create: `apps/web/src/pages/request-diagnostics/[...path].astro`
- Create: `apps/web/src/apps/request-diagnostics/navigation.test.ts`
- Modify: `apps/web/src/apps/request-diagnostics/main.story.test.ts` or create it if absent
- Modify: `apps/web/src/apps/request-diagnostics/main.scene.test.ts` or create it if absent

**Interfaces:**

- `navigation.ts` exports `NavigationValue`, `NavigationPort`, `parseDiagnosticsPath`, and `toNavigationValue`.
- The app declares `ports.inbound.navigation = Port.inbound(NavigationValue)` and `navigation = { port: 'navigation', map: toNavigationValue }`.
- `subscription.ts` consumes `Port.subscription(NavigationPort, ...)` and emits `Navigated`.

- [x] **Step 1: Write failing route and message tests**

Add tests with these concrete expectations:

```ts
it('preserves nested repository and document path segments', () => {
  expect(parseDiagnosticsPath('/request-diagnostics/acme/platform/docs/intro.md')).toEqual({
    _tag: 'Document',
    repository: 'acme/platform',
    document: 'docs/intro.md',
  });
});

it('maps a navigation event to the port value', () => {
  expect(
    toNavigationValue({ phase: 'entered', path: '/request-diagnostics', previousPath: '/' }),
  ).toEqual({
    phase: 'entered',
    path: '/request-diagnostics',
    previousPath: '/',
  });
});
```

- [x] **Step 2: Run the focused web test and verify failure**

Run: `bun test apps/web/src/apps/request-diagnostics/navigation.test.ts`

Expected: FAIL because the route module and navigation message do not exist.

- [x] **Step 3: Implement route parsing from the local FoldKit precedent**

Use the reference repo’s `foldkit/route` pattern. In FoldKit 0.128 the rest-segment helper is named `rest`:

```ts
import { Schema } from 'effect';
import { Route } from 'foldkit';
import { literal, r, rest, slash } from 'foldkit/route';

const DocumentRoute = r('Document', {
  repository: Schema.String,
  document: Schema.NonEmptyArray(Schema.String),
});

const documentRouter = pipe(
  literal('request-diagnostics'),
  slash(rest('repository')),
  slash(rest('document')),
  Route.mapTo(DocumentRoute),
);
```

Use a small normalized value for the app display; preserve the complete pathname in the navigation event even when the route falls back to an index state.

- [x] **Step 4: Add the port, message, subscription, and update path**

Define `Navigated` as a past-tense message with the normalized fields. Add `Port.inbound(NavigationValue)` to `main.ts`, and use a port subscription to create `Navigated` messages. Update the model’s `lastTransition` and route display without rebuilding the chart models. On `entered`, use the app’s route predicate to decide whether any existing load step should run; do not put loading logic in the Astro bridge.

- [x] **Step 5: Update the view and pages**

Display phase, current path, previous path, and parsed repository/document state in the existing diagnostics toolbar. Add the catch-all page using the package import:

```astro
---
import RequestDiagnosticsApp from '../../apps/request-diagnostics/app';
import Layout from '../../layouts/Layout.astro';
---

<Layout title="Request Diagnostics — FoldKit Navigation">
  <RequestDiagnosticsApp client:load transition:persist />
</Layout>
```

Keep the existing `/request-diagnostics` page working and add a link from the diagnostics view or shared layout to a nested path so the behavior is discoverable.

- [x] **Step 6: Run web tests and typecheck**

Run: `bun test apps/web/src/apps/request-diagnostics && bun run --filter @opsydyn/web typecheck`

Expected: all request-diagnostics tests pass and web typecheck exits 0.

- [x] **Step 7: Commit the demo**

```bash
git add apps/web/src/apps/request-diagnostics apps/web/src/pages/request-diagnostics.astro 'apps/web/src/pages/request-diagnostics/[...path].astro'
git commit -m "feat(web): demonstrate navigation-aware foldkit app"
```

### Task 4: Documentation, Integration Smoke Test, and Full Verification

**Files:**

- Modify: `packages/astro-foldkit/test/integration/package-import-smoke.test.ts`
- Modify: `packages/astro-foldkit/README.md`
- Modify: `docs/roadmap.md`
- Modify: `docs/superpowers/plans/2026-07-14-astro-navigation-bridge.md`

**Interfaces:**

- The package import smoke test verifies the built public navigation type surface indirectly through the package build/import.
- The roadmap marks the navigation bridge and route-aware example complete only after the runtime and web tests pass.

- [x] **Step 1: Add the package integration assertion**

Extend the smoke test to import the package entry point and assert the existing integration shape remains valid after adding navigation exports. Keep the assertion compatible with ESM built output; do not import `src` paths.

- [x] **Step 2: Add consumer-facing lifecycle documentation**

Document the `ports.inbound` plus `navigation` configuration, the `NavigationEvent` shape, the missing-port fail-closed behavior, and the ownership rule for route parsing and load policy.

- [x] **Step 3: Mark the roadmap slice complete**

Change only the navigation slice checkboxes in `docs/roadmap.md` after the demo is verified:

```md
- [x] Define an adapter from Astro navigation lifecycle events to application Messages.
- [x] Use FoldKit route transition helpers at the application boundary.
- [x] Support normalized repository/document paths with `rest`.
- [x] Verify state preservation and disposal across Astro View Transitions.
```

- [x] **Step 4: Update the plan checkboxes with evidence**

Mark completed steps and record the final package/web test commands in the verification section. Do not mark the slice complete if the dev server or integration smoke test is failing.

- [x] **Step 5: Run the complete verification set**

Run:

```bash
bun run check
bun typecheck
bun run --filter @opsydyn/astro-foldkit test:unit
bun run --filter @opsydyn/astro-foldkit test:integration
bun run --filter @opsydyn/web test
bun run --filter @opsydyn/astro-foldkit build
bun run --filter @opsydyn/web build
git diff --check
```

Expected: all commands exit 0; workspace-filtered tests pass; no generated build output is left as an untracked change. The gating suite is the workspace-filtered `bun run test`; raw `bun test` is non-gating because it discovers vendored `foldkit-main` tests with unrelated missing dependencies and upstream failures, including the FoldKit 0.128 `Mount` export mismatch.

- [x] **Step 6: Commit the verified slice**

```bash
git add packages/astro-foldkit/test/integration/package-import-smoke.test.ts packages/astro-foldkit/README.md docs/roadmap.md docs/superpowers/plans/2026-07-14-astro-navigation-bridge.md
git commit -m "docs: complete astro navigation slice"
```

### Task 4 Evidence

- Packed consumer smoke test compiles a consumer against the emitted `NavigationConfig`, `NavigationEvent`, and `NavigationPhase` types, then imports `@opsydyn/astro-foldkit` under Bun and Node and checks the Astro integration and `defineApp` entry point.
- Consumer documentation covers `ports.inbound`, the navigation mapper, the `NavigationEvent` shape, lifecycle phase semantics, fail-closed missing-port behavior, and app-owned route parsing and load policy.
- Roadmap navigation slice is complete, including the route-aware request-diagnostics example.
- Final verification commands are recorded in `.superpowers/sdd/task-4-report.md`.
- The gating suite is workspace-filtered `bun run test`; raw `bun test` discovery is explicitly non-gating because it includes vendored `foldkit-main` tests with unrelated missing dependencies and upstream failures.

## Plan Self-Review

- Spec coverage: the typed event contract is Task 1, lifecycle forwarding and disposal are Task 2, route-aware demo behavior is Task 3, and documentation plus acceptance verification are Task 4.
- Placeholder scan: no `TBD`, `TODO`, or unspecified edge-case steps remain.
- Type consistency: `NavigationEvent`, `NavigationConfig`, `NavigationPhase`, `NavigationValue`, `NavigationPort`, and `Navigated` are named once and reused consistently.
- Scope check: this plan changes only the Astro integration and one existing web example; FoldKit Viz interaction work remains a later roadmap slice.
