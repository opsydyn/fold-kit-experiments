# Astro Navigation Cancellation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Cancel an active request-diagnostics metrics request when Astro removes its island, without scheduling a replacement request.

**Architecture:** Keep the fixed FetchMetrics interrupt key and cancellation reason in the request-diagnostics FoldKit machine. Navigated(exited) is routed through that machine only from Loading; Cancelling carries either Reload or RouteExit so the interrupt outcome can distinguish a replacement load from terminal teardown. Astro continues to forward lifecycle facts through its existing inbound port, and Viz remains synchronous.

**Tech Stack:** Bun, TypeScript, Effect Schema, FoldKit 0.129.0, foldkit/experimental/machine, foldkit/http, Astro, Vitest, bun:test, oxlint, oxfmt.

## Global Constraints

- Do not add public APIs or dependencies to @opsydyn/astro-foldkit or @opsydyn/foldkit-viz.
- Only Navigated({ phase: 'exited' }) during Loading can interrupt metrics work.
- Record Reload versus RouteExit inside the app-owned machine state.
- Return an interrupt and its replacement fetch in separate update batches only.
- A retained-island stayed event remains metadata-only and preserves active work.
- Use past-tense facts as messages; retain CompletedCancelFetchMetrics as the interrupt outcome message.
- Use bun run check, bun typecheck, and bun run test as the workspace completion gates.

---

### Task 1: Model route-exit cancellation in request diagnostics

**Files:**

- Modify: apps/web/src/apps/request-diagnostics/model.ts:15-39
- Modify: apps/web/src/apps/request-diagnostics/update.ts:8-158,186-235
- Modify: apps/web/src/apps/request-diagnostics/machine.test.ts:3-59
- Modify: apps/web/src/apps/request-diagnostics/main.story.test.ts:1-18

**Interfaces:**

- Consumes: Navigated, CompletedCancelFetchMetrics, and FetchMetrics.Interrupt.
- Produces: Cancelling({ reason: 'Reload' | 'RouteExit' }); route exit completes in Idle without a command; reload retains its replacement FetchMetrics() command.

- [ ] **Step 1: Write failing machine and update tests**

Import Navigated in machine.test.ts and add these tests. Retain the reload test, but require reason: 'Reload'.

```ts
const exited = Navigated({
  phase: 'exited',
  path: '/request-diagnostics',
  previousPath: '/',
});

test('interrupts active metrics work when the Astro island exits', () => {
  const result = diagnosticsMachine.step({ _tag: 'Loading' }, exited);

  expect(result).toMatchObject({
    _tag: 'Transitioned',
    target: 'Cancelling',
    state: { _tag: 'Cancelling', reason: 'RouteExit' },
    commands: [{ name: 'FetchMetrics.Interrupt', interruptsKey: 'FetchMetrics' }],
  });
});

test('does not replace metrics work after route-exit cancellation', () => {
  const [model, commands] = update(
    { ...initModel, explorer: { _tag: 'Cancelling', reason: 'RouteExit' } },
    CompletedCancelFetchMetrics({ outcome: { _tag: 'Interrupted' } }),
  );

  expect(model.explorer).toEqual({ _tag: 'Idle' });
  expect(commands).toEqual([]);
});

test('does not interrupt completed metrics work on route exit', () => {
  const [model, commands] = update(
    { ...initModel, explorer: { _tag: 'Ready', points: samplePoints } },
    exited,
  );

  expect(model.explorer).toEqual({ _tag: 'Ready', points: samplePoints });
  expect(commands).toEqual([]);
});

test('ignores a late successful load after route-exit cancellation', () => {
  const model = { ...initModel, explorer: { _tag: 'Idle' } as const };
  const [nextModel, commands] = update(model, LoadedMetrics({ points: samplePoints }));

  expect(nextModel.explorer).toBe(model.explorer);
  expect(nextModel.histogram).toBe(model.histogram);
  expect(nextModel.scatter).toBe(model.scatter);
  expect(nextModel.lastTransition).toBe('LoadedMetrics ignored in Idle');
  expect(commands).toEqual([]);
});
```

In main.story.test.ts, add this retained-island assertion:

```ts
it('keeps an active metrics request on retained-island navigation', () => {
  const [nextModel, commands] = update(
    initModel,
    Navigated({
      phase: 'stayed',
      path: '/request-diagnostics/acme/platform/docs/intro.md',
      previousPath: '/request-diagnostics',
    }),
  );

  expect(nextModel.explorer).toBe(initModel.explorer);
  expect(nextModel.histogram).toBe(initModel.histogram);
  expect(nextModel.scatter).toBe(initModel.scatter);
  expect(commands).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify red**

Run:

```sh
bun run --filter @opsydyn/web test -- src/apps/request-diagnostics/machine.test.ts src/apps/request-diagnostics/main.story.test.ts
```

Expected: FAIL because Cancelling has no reason, Navigated is not in the machine transition table, and a route-exit interrupt outcome currently starts a replacement fetch.

- [ ] **Step 3: Add the cancellation reason to the state schema**

In model.ts, define the reason beside the existing state constructors and make it required on Cancelling:

```ts
export const CancellationReason = Schema.Literal('Reload', 'RouteExit');
export type CancellationReason = typeof CancellationReason.Type;

export const Cancelling = ts('Cancelling', { reason: CancellationReason });
```

Do not add this reason to the top-level Model; it belongs to the machine state that owns the in-flight operation.

- [ ] **Step 4: Route navigation through the machine and branch the outcome**

In update.ts, import `Idle` with the existing state constructors and add a state
constructor helper:

```ts
const cancelling = (reason: import('./model').CancellationReason) => Cancelling({ reason });
```

Every ClickedReload edge builds cancelling('Reload'). Add a guarded Navigated edge to Loading only:

```ts
Navigated: [
  Machine.when(
    (_state, message) => message.phase === 'exited',
    'Cancelling',
    () => cancelling('RouteExit'),
    interruptMetrics,
  ),
],
```

Replace the Cancelling completion edge with ordered guards. The first preserves the reload sequence; the fallback terminates route-exit work:

```ts
CompletedCancelFetchMetrics: [
  Machine.when(
    (state) => state.reason === 'Reload',
    'Loading',
    () => Loading(),
    () => [FetchMetrics()],
  ),
  Machine.otherwise(Machine.to('Idle', () => Idle())),
],
```

Extract `updateNavigation(model, message)` so the message reaches the machine
before the navigation metadata is overlaid:

```ts
type NavigationMessage = Extract<Message, { readonly _tag: 'Navigated' }>;

const updateNavigation = (model: Model, message: NavigationMessage): Return => {
  const [nextModel, commands] = runMachine(model, message);
  const navigation = {
    phase: message.phase,
    path: message.path,
    previousPath: message.previousPath,
  };
  const route = parseDiagnosticsPath(navigation.path);
  const routeEntry = isEnteringDiagnostics(message.phase, model.route, route);

  return [
    {
      ...nextModel,
      navigation,
      route,
      lastTransition: `${navigation.phase} ${navigation.path}${routeEntry ? ' (route entry)' : ''}`,
    },
    commands,
  ];
};
```

Use this helper from the Navigated match arm. It preserves the existing route
display while returning the machine's route-exit interrupt command unchanged.

Finally, prevent an ignored result in Idle from rebuilding the histogram. In updateLoadedMetrics, return the runMachine result unchanged unless the previous explorer state is Loading and the next explorer state is Ready:

```ts
if (model.explorer._tag !== 'Loading' || nextModel.explorer._tag !== 'Ready')
  return [nextModel, commands];
```

Keep the existing histogram construction in the successful branch.

- [ ] **Step 5: Run tests to verify green**

Run:

```sh
bun run --filter @opsydyn/web test -- src/apps/request-diagnostics/machine.test.ts src/apps/request-diagnostics/main.story.test.ts
```

Expected: PASS. Reload carries reason Reload; route exit returns only the interrupt, its outcome returns no replacement command, late results leave Idle unchanged, and retained navigation preserves model identity.

- [ ] **Step 6: Commit**

```sh
git add apps/web/src/apps/request-diagnostics/model.ts apps/web/src/apps/request-diagnostics/update.ts apps/web/src/apps/request-diagnostics/machine.test.ts apps/web/src/apps/request-diagnostics/main.story.test.ts
git commit -m "feat(web): cancel metrics on route exit"
```

### Task 2: Lock the Astro lifecycle delivery order with a regression test

**Files:**

- Modify: packages/astro-foldkit/test/unit/client.test.ts:146-172

**Interfaces:**

- Consumes: the existing createClientRenderer test harness and navigation inbound port.
- Produces: a regression assertion that the exited fact is sent before the embedded runtime is disposed.

- [ ] **Step 1: Add an ordered lifecycle assertion**

Replace the separate sent and disposeCalls bookkeeping in the existing unmount test with one ordered event log:

```ts
const events: unknown[] = [];
const runtime = {
  makeApplication: (input: unknown) => input,
  embed: (_program: unknown) => ({
    ports: {
      navigation: {
        send: (value: unknown) => events.push(['navigation', value]),
      },
    },
    dispose: () => events.push(['dispose']),
  }),
};
```

After element.dispatch('astro:unmount'), assert:

```ts
expect(events).toEqual([
  ['navigation', { phase: 'coldLoad', path: '/', previousPath: null }],
  ['navigation', { phase: 'exited', path: '/', previousPath: '/' }],
  ['dispose'],
]);
```

Dispatch astro:page-load afterward and retain an assertion that no extra events occur.

- [ ] **Step 2: Run the focused package test**

Run:

```sh
bun run --filter @opsydyn/astro-foldkit test:unit -- client.test.ts
```

Expected: PASS. This is regression coverage for existing lifecycle ordering; no Astro package implementation change is required.

- [ ] **Step 3: Commit**

```sh
git add packages/astro-foldkit/test/unit/client.test.ts
git commit -m "test(astro-foldkit): cover exit delivery order"
```

### Task 3: Document app-owned remote-data cancellation and close the slice

**Files:**

- Modify: apps/web/README.md:11-30
- Modify: packages/astro-foldkit/README.md:243-245
- Modify: docs/roadmap.md:50-57

**Interfaces:**

- Consumes: the implemented Navigated(exited) and CompletedCancelFetchMetrics sequence.
- Produces: reusable application-level guidance without package API additions, and completed lifecycle roadmap checkboxes.

- [ ] **Step 1: Document the practical application pattern**

Add a Cancellable remote data section to apps/web/README.md after the Apps list:

```md
/request-diagnostics demonstrates app-owned interruption. Define an
interruptible command with a key that identifies the remote resource, record
why it is being cancelled in the model or machine state, then return only the
interrupt command. Handle its outcome in a later update turn: a reload starts
a replacement request, while Navigated({ phase: 'exited' }) finishes without
one. Do not return interruption and replacement commands in the same batch.

Use the same shape for remote filter, brush, or zoom loads. Keep their command
keys, cancellation policy, and result handling in the consuming FoldKit app;
@opsydyn/foldkit-viz receives only data and chart-local messages.
```

Append this sentence to the Astro navigation-boundary paragraph:

```md
When an app uses exited to interrupt work, the interrupt key, state, and
outcome policy stay in its update loop; the integration does not cancel or
replace commands.
```

- [ ] **Step 2: Mark the lifecycle roadmap items complete**

In docs/roadmap.md, change both current lifecycle items to checked entries:

```md
- [x] Cancel an active app-owned request on Astro route exit without starting a
      replacement request.
- [x] Document keyed cancellation for remote filter, brush, and zoom loads;
      keep foldkit-viz pure and synchronous.
```

- [ ] **Step 3: Run formatting and focused regressions**

Run:

```sh
bunx oxfmt apps/web/README.md packages/astro-foldkit/README.md docs/roadmap.md
bun run --filter @opsydyn/web test -- src/apps/request-diagnostics/machine.test.ts src/apps/request-diagnostics/main.story.test.ts
bun run --filter @opsydyn/astro-foldkit test:unit -- client.test.ts
```

Expected: formatter exits 0 and both focused test commands pass.

- [ ] **Step 4: Commit**

```sh
git add apps/web/README.md packages/astro-foldkit/README.md docs/roadmap.md
git commit -m "docs: explain app-owned request cancellation"
```

### Task 4: Run the workspace release-quality gates

**Files:**

- Verify only: apps/web/src/apps/request-diagnostics/
- Verify only: packages/astro-foldkit/test/unit/client.test.ts
- Verify only: apps/web/README.md, packages/astro-foldkit/README.md, docs/roadmap.md

**Interfaces:**

- Consumes: the completed cancellation behaviour, regression coverage, and user-facing guidance from Tasks 1-3.
- Produces: evidence that the slice does not change package APIs or introduce cross-workspace regressions.

- [ ] **Step 1: Run repository checks**

Run:

```sh
bun run check
bun typecheck
bun run test
git diff --check
git status --short
```

Expected: each Bun command exits 0; bun typecheck reports zero diagnostics; bun run test passes all workspace tests; git diff --check emits no output. The direct bun test command is not a repository gate because it traverses the checked-out foldkit-main reference repository.

- [ ] **Step 2: Inspect the final ownership boundary**

Run:

```sh
git show --stat --oneline HEAD~3..HEAD
git diff HEAD~3..HEAD -- packages/astro-foldkit/src packages/foldkit-viz/src
```

Expected: the application owns the functional change; Astro has only a test change; Viz source has no changes.

- [ ] **Step 3: Confirm release-ready state**

Run:

```sh
git status --short
```

Expected: no uncommitted files remain before release review. Do not create an empty fourth commit.
