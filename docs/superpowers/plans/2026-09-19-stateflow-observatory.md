# Stateflow Observatory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first Stateflow Observatory reference experience: a deterministic visual graph and replay timeline that demonstrates FoldKit's experimental Machine API and typed Port boundary without coupling `foldkit-viz` to FoldKit, Effect, or Astro.

**Architecture:** Extract the existing request-diagnostics Machine into an app-owned fixture boundary. Add a small plain-data `@opsydyn/foldkit-viz/stateflow` subpath that lays out state graphs and preserves semantic records. Build a standalone `apps/web` Stateflow app that replays validated events through the existing Machine, records transition facts, emits redacted telemetry through a Command-owned outbound Port, and renders the graph/timeline with FoldKit HTML.

**Tech Stack:** Bun workspaces, TypeScript 6, FoldKit 0.161.0 experimental Machine and Port APIs, Effect 4.0.0-rc.115 Schema/Effect, `@opsydyn/foldkit-viz`, `@opsydyn/astro-foldkit`, Astro 7.1.1, Vitest, Vanilla Extract, Oxlint, and Oxfmt.

**Spec:** `docs/superpowers/specs/2026-09-19-stateflow-observatory-design.md`

## Global Constraints

- `apps/web` owns the Machine definition, replay model, trace history, Port schemas, subscriptions, Commands, and payload redaction.
- `foldkit-viz` accepts plain records only and must not import `foldkit`, `effect`, `@opsydyn/astro-foldkit`, or application types.
- `astro-foldkit` remains a lifecycle and island host bridge; this slice adds no Astro runtime API.
- Use `machine.stateTags`, `machine.edges`, and `machine.step` as the Machine source of truth; never parse Mermaid output.
- Port traffic is an application boundary; internal replay remains `Message -> update -> Model`.
- Diagnostics Commands returned by the fixture Machine are recorded as metadata by the replay visualizer and are never executed by the synthetic replay loop.
- Outbound telemetry is emitted only from a Command using `Port.emit`; the view never emits directly to a Port.
- Layout output must be deterministic for identical graph records and dimensions.
- Keep SSR output meaningful without animation; reduced motion must disable pulse animation without hiding state.
- Preserve unrelated dirty work. Stage only files listed by the task being committed.
- Use named FoldKit exports and the repository's existing `defineMessageUnion`, `defineTaggedUnion`, `Subscription`, `Port`, and `svgRoot` patterns.

## Review Focus

- **Malformed replay input:** an invalid encoded Port value must be rejected before it can produce an app Message; cover this in the client bridge scene test.
- **Ignored transitions:** an event that is outside the current state's applicable edges must leave Machine state unchanged while adding an `Ignored` trace with its reason.
- **Command-producing transitions:** replaying a transition that returns `FetchMetrics.Interrupt` must show the command name in the inspector without executing HTTP or dispatching a diagnostics result.
- **Graph integrity:** unknown edge endpoints, duplicate edge IDs, and guard metadata must not produce a partial or nondeterministic layout.
- **Host and accessibility behavior:** the page must render a static graph/table projection, expose controls and selection semantics, and preserve existing Astro app-island behavior at SSR and hydration boundaries.

---

### Task 1: Isolate the app-owned diagnostics Machine

**Files:**

- Create: `apps/web/src/apps/request-diagnostics/machine.ts`
- Modify: `apps/web/src/apps/request-diagnostics/update.ts`
- Modify: `apps/web/src/apps/request-diagnostics/machine.test.ts`

**Interfaces:**

- Produces `diagnosticsMachine: Machine<ExplorerState, Message>` from the new `machine.ts` module.
- Keeps `update.ts` consuming `diagnosticsMachine.step(...)` through the same local name and behavior.
- Does not change the public `request-diagnostics` app Message or Model shapes.

- [ ] **Step 1: Add characterization assertions for the exported Machine graph.**

  Extend `machine.test.ts` with the exact state and edge facts the observatory will consume:

  ```ts
  expect(diagnosticsMachine.stateTags).toEqual([
    'Idle',
    'Loading',
    'Cancelling',
    'Ready',
    'Selecting',
    'Filtered',
    'Failed',
  ]);
  expect(diagnosticsMachine.edges).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ from: 'Loading', messageTag: 'LoadedMetrics', target: 'Ready' }),
      expect.objectContaining({ from: 'Loading', messageTag: 'Navigated', target: 'Cancelling' }),
      expect.objectContaining({
        from: 'Cancelling',
        messageTag: 'CompletedCancelFetchMetrics',
        target: 'Idle',
      }),
    ]),
  );
  ```

- [ ] **Step 2: Run the characterization test before the refactor.**

  Run: `bun test apps/web/src/apps/request-diagnostics/machine.test.ts`

  Expected: PASS, establishing the current Machine graph as the refactor contract.

- [ ] **Step 3: Move the Machine definition to `machine.ts`.**

  Move `cancelling`, `interruptMetrics`, and the `Machine.define(...)` value out of `update.ts`. Export only `diagnosticsMachine` and keep the existing `FetchMetrics.Interrupt(...)` policy unchanged. `machine.ts` may import `FetchMetrics`, `Message`, and `ExplorerState`; it must not import chart models or view code.

- [ ] **Step 4: Rewire `update.ts` and existing tests.**

  Import `diagnosticsMachine` from `./machine` in `update.ts`, remove the moved Machine-only imports, and import the Machine directly from `./machine` in `machine.test.ts`. Do not retain a second Machine definition or duplicate transition table.

- [ ] **Step 5: Run the focused diagnostics tests.**

  Run: `bun test apps/web/src/apps/request-diagnostics/machine.test.ts apps/web/src/apps/request-diagnostics/main.story.test.ts apps/web/src/apps/request-diagnostics/main.scene.test.ts`

  Expected: PASS, including route-exit interruption, retained-island navigation, Port delivery, and the graph assertions.

- [ ] **Step 6: Commit the isolated Machine boundary.**

  ```sh
  git add apps/web/src/apps/request-diagnostics/machine.ts \
    apps/web/src/apps/request-diagnostics/update.ts \
    apps/web/src/apps/request-diagnostics/machine.test.ts
  git commit -m "refactor(web): isolate diagnostics machine"
  ```

---

### Task 2: Add the pure `foldkit-viz/stateflow` layout API

**Files:**

- Create: `packages/foldkit-viz/src/stateflow/index.ts`
- Create: `packages/foldkit-viz/test/stateflow.test.ts`
- Modify: `packages/foldkit-viz/tsdown.config.ts`
- Modify: `packages/foldkit-viz/package.json`
- Modify: `packages/foldkit-viz/README.md`

**Interfaces:**

- Produces the public subpath `@opsydyn/foldkit-viz/stateflow`.
- Exports `StateFlowNodeRole`, `StateFlowGuard`, `StateFlowNode`, `StateFlowEdge`, `StateFlowGraph`, `StateFlowLayoutNode`, `StateFlowLayoutEdge`, `StateFlowLayout`, `StateFlowLayoutOptions`, and `layoutStateFlow(graph, options?)`.
- `layoutStateFlow` consumes only `StateFlowGraph` records and returns positioned records; it does not accept a Machine or Message.

- [ ] **Step 1: Write the failing API and integrity tests.**

  Create `stateflow.test.ts` with tests for the intended public contract:

  ```ts
  const graph = {
    nodes: [
      { id: 'Loading', label: 'Loading', role: 'transient', visitCount: 1 },
      { id: 'Ready', label: 'Ready', role: 'active', visitCount: 2 },
    ],
    edges: [
      {
        id: 'Loading:LoadedMetrics:Ready:Unguarded',
        source: 'Loading',
        target: 'Ready',
        event: 'LoadedMetrics',
        guard: 'unguarded',
        transitionCount: 1,
      },
    ],
  } as const;

  const first = layoutStateFlow(graph, { width: 640, height: 360, iterations: 80 });
  const second = layoutStateFlow(graph, { width: 640, height: 360, iterations: 80 });

  expect(first).toEqual(second);
  expect(first.nodes.map(({ id }) => id)).toEqual(['Loading', 'Ready']);
  expect(first.edges).toHaveLength(1);
  expect(first.edges[0]).toMatchObject({ source: 'Loading', target: 'Ready' });
  ```

  Add negative tests that an edge referring to an unknown node, or two edges sharing an ID, throw clear errors instead of silently dropping or overwriting graph data. Assert that `guard` and `guardPosition` are preserved on the returned edge.

- [ ] **Step 2: Run the new test to verify the API is absent.**

  Run: `bun test packages/foldkit-viz/test/stateflow.test.ts`

  Expected: FAIL because the `stateflow` module and `layoutStateFlow` do not exist yet.

- [ ] **Step 3: Implement plain Stateflow records and deterministic layout.**

  In `src/stateflow/index.ts`, define:

  ```ts
  export type StateFlowNodeRole = 'initial' | 'normal' | 'active' | 'error' | 'transient';
  export type StateFlowGuard = 'unguarded' | 'when' | 'otherwise';

  export type StateFlowNode = Readonly<{
    id: string;
    label: string;
    role: StateFlowNodeRole;
    visitCount: number;
  }>;

  export type StateFlowEdge = Readonly<{
    id: string;
    source: string;
    target: string;
    event: string;
    guard: StateFlowGuard;
    guardPosition?: number;
    transitionCount: number;
    lastSeenAt?: number;
  }>;

  export type StateFlowGraph = Readonly<{
    nodes: ReadonlyArray<StateFlowNode>;
    edges: ReadonlyArray<StateFlowEdge>;
  }>;
  ```

  Use `runForceLayout` internally after validating that every node ID and edge ID is unique and every edge endpoint exists. Map positions back by stable node ID, preserve input order and semantic fields, and attach `x1/y1/x2/y2` to every returned edge. Do not import any runtime package outside this package.

- [ ] **Step 4: Add the build/export surface.**

  Add `stateflow: 'src/stateflow/index.ts'` to `tsdown.config.ts`, add matching `exports` and `typesVersions` entries in `package.json`, and document the subpath in the package README. Do not add FoldKit or Effect as a runtime dependency or peer for this entry.

- [ ] **Step 5: Run package tests and typecheck.**

  Run: `bun test packages/foldkit-viz/test/stateflow.test.ts`

  Expected: PASS, including deterministic output and invalid-edge rejection.

  Run: `bun run --filter @opsydyn/foldkit-viz typecheck`

  Expected: PASS with no new imports from `foldkit`, `effect`, or Astro in the stateflow module.

- [ ] **Step 6: Commit the pure package API.**

  ```sh
  git add packages/foldkit-viz/src/stateflow/index.ts \
    packages/foldkit-viz/test/stateflow.test.ts \
    packages/foldkit-viz/tsdown.config.ts \
    packages/foldkit-viz/package.json \
    packages/foldkit-viz/README.md
  git commit -m "feat(viz): add stateflow layout primitives"
  ```

---

### Task 3: Build the app-owned replay, trace, and Port boundary

**Files:**

- Create: `apps/web/src/apps/stateflow/app.ts`
- Create: `apps/web/src/apps/stateflow/command.ts`
- Create: `apps/web/src/apps/stateflow/fixture.ts`
- Create: `apps/web/src/apps/stateflow/graph.ts`
- Create: `apps/web/src/apps/stateflow/main.ts`
- Create: `apps/web/src/apps/stateflow/message.ts`
- Create: `apps/web/src/apps/stateflow/model.ts`
- Create: `apps/web/src/apps/stateflow/ports.ts`
- Create: `apps/web/src/apps/stateflow/subscription.ts`
- Create: `apps/web/src/apps/stateflow/update.ts`
- Create: `apps/web/src/apps/stateflow/update.test.ts`
- Create: `apps/web/src/apps/stateflow/graph.test.ts`
- Create: `apps/web/src/apps/stateflow/main.scene.test.ts`
- Consume: `apps/web/src/apps/request-diagnostics/machine.ts`, `apps/web/src/apps/request-diagnostics/message.ts`, `apps/web/src/apps/request-diagnostics/model.ts`

**Interfaces:**

- `ReplayEvent` is a validated subset of request-diagnostics Messages suitable for a bounded visual fixture.
- `ReplayEventPort` is an inbound `Port` carrying `ReplayEvent` values.
- `TransitionRecorded` is a redacted outbound record with `sequence`, `messageTag`, `outcome`, `from`, optional `target`, optional `reason`, and `commandNames`.
- `TransitionTelemetryPort` is an outbound `Port` carrying `TransitionRecorded`.
- `diagnosticsMachine.step(...)` remains the only evaluator of replay transitions.
- `graphFor(model)` maps the Machine's `stateTags`/`edges` and model trace counts into the plain `StateFlowGraph` consumed by `layoutStateFlow`.

- [ ] **Step 1: Define the typed Port and replay schemas.**

  In `ports.ts`, define `ReplayEvent` with the exact variants used by the fixture: `LoadedMetrics`, `StartedSelection`, `ChangedSelection`, `ClearedSelection`, `ClickedReload`, `CompletedCancelFetchMetrics`, and `Navigated`. Define `TransitionRecorded` as a finite Schema record with no raw payload field. Create `ReplayEventPort = Port.inbound(ReplayEvent)` and `TransitionTelemetryPort = Port.outbound(TransitionRecorded)`.

  In `message.ts`, define control facts `ClickedPlay`, `ClickedPause`, `ClickedStep`, `ClickedReset`, `AdvancedReplay`, `SelectedTrace`, `SelectedNode`, `ReceivedReplayEvent`, and `CompletedReportTransition({ sequence: Schema.Number })`. Use `Schema.Unknown` only for `ReceivedReplayEvent` with a local type override, then cast at the update boundary as required by the repository convention.

- [ ] **Step 2: Add the failing transition and Port tests.**

  Add tests that assert:

  ```ts
  const first = update(initModel, Message.ReceivedReplayEvent({ event: fixture[0] }));
  expect(first.model.trace).toHaveLength(1);
  expect(first.model.trace[0]).toMatchObject({ outcome: 'transitioned' });

  const ignored = update(
    { ...first.model, explorer: { _tag: 'Idle' } },
    Message.ReceivedReplayEvent({ event: fixture[0] }),
  );
  expect(ignored.model.explorer).toEqual({ _tag: 'Idle' });
  expect(ignored.model.trace.at(-1)).toMatchObject({ outcome: 'ignored' });
  ```

  Add a command-producing replay test for `ClickedReload`: the returned command list contains only `ReportTransition`, the trace contains `FetchMetrics.Interrupt` in `commandNames`, and no diagnostics `FetchMetrics` command is returned to the Stateflow runtime.

  Add `graph.test.ts` assertions that `graphFor(model)` returns one node per `diagnosticsMachine.stateTags`, one edge per `diagnosticsMachine.edges`, and the expected `when`/`otherwise` guard labels and positions.

- [ ] **Step 3: Run the new app tests to verify the runtime boundary is absent.**

  Run: `bun test apps/web/src/apps/stateflow/update.test.ts`

  Expected: FAIL because the stateflow app modules do not exist yet.

- [ ] **Step 4: Implement the model, fixture, and graph adapter.**

  In `model.ts`, define the app-owned model with `explorer`, `playback: 'paused' | 'playing'`, `replayIndex`, `trace`, `selectedSequence`, `selectedNode`, and `lastTelemetrySequence: number | null`. Keep `trace` as a readonly array of normalized transition facts.

  In `fixture.ts`, use `samplePoints` and diagnostic Message constructors to create a bounded sequence that demonstrates `Loading -> Ready -> Selecting -> Filtered -> Ready -> Cancelling -> Idle`. Include the cancel result as an explicit replay event so the visual can show the cancellation path without starting a network request.

  In `graph.ts`, map `diagnosticsMachine.stateTags` exactly once to nodes and `diagnosticsMachine.edges` exactly once to edges. Map `EdgeGuard._tag` to `unguarded`, `when`, or `otherwise`; derive `visitCount` and `transitionCount` from trace records; mark the current state as `active`, `Failed` as `error`, and `Loading`/`Cancelling` as `transient` unless the current state overrides that role. Build edge IDs from source, message tag, target, and guard position rather than array index.

- [ ] **Step 5: Implement the Command-owned outbound telemetry and subscriptions.**

  In `command.ts`, define `ReportTransition` with `args: { record: TransitionRecorded }`, `messages: [Message.CompletedReportTransition]`, and an Effect that calls `Port.emit(TransitionTelemetryPort, record)` followed by `Effect.as(Message.CompletedReportTransition({ sequence: record.sequence }))`.

  In `subscription.ts`, combine `Port.subscription(ReplayEventPort, event => Message.ReceivedReplayEvent({ event }))` with an `Subscription.animationFrame` entry active only while `model.playback === 'playing'`. The frame entry dispatches `AdvancedReplay`; it must stop when the fixture is exhausted or playback is paused.

- [ ] **Step 6: Implement update and app exports.**

  `runReplayEvent` must call `diagnosticsMachine.step(model.explorer, event)`, normalize `Transitioned` or `Ignored` into one trace record, update the selected sequence and replay index, and return only the `ReportTransition` Command. It must not return `result.commands` from the diagnostics Machine. `ClickedStep` advances one fixture event while paused; `ClickedPlay`/`ClickedPause` control playback; `ClickedReset` restores `initModel`; selection Messages change only inspector selection; `CompletedReportTransition({ sequence })` sets `lastTelemetrySequence`.

  In `main.ts`, export `Model`, `Message`, `update`, `view`, `ports`, `subscriptions`, and an `init` that returns `{ model: initModel }`. In `app.ts`, use the existing `lazyApp(() => import('./main'))` convention. Configure both `ports.inbound.replay` and `ports.outbound.transitionTelemetry`.

- [ ] **Step 7: Add the client Port bridge scene test.**

  Mirror the existing request-diagnostics `Runtime.embed` scene test. Send a valid replay event through `handle.ports.replay.send(...)`, assert a `ReceivedReplayEvent` reaches the app, and wait for the resulting outbound transition record through `handle.ports.transitionTelemetry`. Send a malformed encoded value and assert that neither an app Message nor telemetry record is produced.

- [ ] **Step 8: Run focused web tests and typecheck.**

  Run: `bun test apps/web/src/apps/stateflow/update.test.ts apps/web/src/apps/stateflow/main.scene.test.ts`

  Expected: PASS, including ignored transitions, command metadata, invalid Port input, and no replacement diagnostics request.

  Run: `bun run --filter @opsydyn/web typecheck`

  Expected: PASS after the viz package build and Astro integration build complete.

- [ ] **Step 9: Commit the replay and boundary runtime.**

  ```sh
  git add apps/web/src/apps/stateflow
  git commit -m "feat(web): add stateflow replay ports"
  ```

---

### Task 4: Render the Observatory and expose the Astro example

**Files:**

- Create: `apps/web/src/apps/stateflow/stateflow.css.ts`
- Create: `apps/web/src/apps/stateflow/view.ts`
- Create: `apps/web/src/apps/stateflow/view.test.ts`
- Create: `apps/web/src/pages/stateflow.astro`
- Modify: `apps/web/src/apps/stateflow/main.ts`
- Modify: `packages/astro-foldkit/README.md`

**Interfaces:**

- The view consumes only the Stateflow app Model and produces FoldKit `Document` HTML.
- The view uses `layoutStateFlow(graph, { width, height })` and `svgRoot` for the graph; it does not call Machine APIs or Ports.
- The page mounts `StateflowApp` with `client:load` and does not add a new Astro integration API.

- [ ] **Step 1: Add view-level interaction tests before rendering.**

  Create `view.test.ts` with assertions for the rendered Document title, accessible graph label, replay controls, current-state label, event table headers, and the selected trace inspector. Use the existing FoldKit HTML test harness rather than querying browser globals from `view.ts`.

- [ ] **Step 2: Implement the deterministic graph and timeline view.**

  Render the approved composition:

  - header with current state, transition count, ignored count, and playback status;
  - left rail with Play, Pause, Step, Reset, replay session, inbound Port status, and outbound Port status;
  - center SVG graph with state nodes, guard-labelled edges, active/visited/error classes, and a latest-transition pulse class;
  - right inspector with message tag, source/target, guard/reason, structured event data, and command names;
  - bottom recent-events table with sequence, event, from, outcome, target, and reason.

  Use `h.OnClick` Messages for controls and graph/timeline selection. Keep labels inside stable dimensions and use semantic text alongside colour. Use `svgRoot` with a title and description. Do not introduce a separate view state or direct DOM mutation.

- [ ] **Step 3: Add restrained responsive styling.**

  In `stateflow.css.ts`, use the approved dark graphite palette with restrained cyan, indigo, amber, and red accents. Define stable grid tracks, a mobile single-column layout, focus-visible controls, and a pulse animation that is disabled under `prefers-reduced-motion: reduce`. Avoid gradients, decorative blobs, nested cards, and viewport-scaled typography.

- [ ] **Step 4: Add the Astro route.**

  Create `stateflow.astro` using the existing `Layout` and `StateflowApp` pattern:

  ```astro
  ---
  import StateflowApp from '../apps/stateflow/app';
  import Layout from '../layouts/Layout.astro';
  import * as layoutStyles from '../layouts/layout.css';
  ---

  <Layout title="Stateflow Observatory — FoldKit Machine and Ports">
    <h1 class={layoutStyles.heading}>Stateflow Observatory</h1>
    <StateflowApp client:load />
  </Layout>
  ```

  Use static package imports only. The existing `lazyApp` literal loader is the only app-loader dynamic import allowed by repository convention.

- [ ] **Step 5: Document the host boundary.**

  Add a short `packages/astro-foldkit/README.md` section showing that Astro supplies the island and lifecycle facts while the app owns Machine/Port semantics. Point to `/stateflow` and explicitly state that this slice does not add an Astro API or move async work into the integration.

- [ ] **Step 6: Run the view and app tests.**

  Run: `bun test apps/web/src/apps/stateflow`

  Expected: PASS with accessible static output and control/message assertions.

- [ ] **Step 7: Commit the visual route.**

  ```sh
  git add apps/web/src/apps/stateflow apps/web/src/pages/stateflow.astro packages/astro-foldkit/README.md
  git commit -m "feat(web): add stateflow observatory"
  ```

---

### Task 5: Document the reusable remote-visual-load pattern

**Files:**

- Modify: `docs/roadmap.md`
- Modify: `packages/foldkit-viz/README.md`
- Modify: `packages/astro-foldkit/README.md`

**Interfaces:**

- Documentation names the Stateflow Observatory route and the public `@opsydyn/foldkit-viz/stateflow` subpath.
- Documentation gives one consistent pattern for future remote filter, brush, and zoom loads without adding async responsibilities to `foldkit-viz`.

- [ ] **Step 1: Add the roadmap item and boundary notes.**

  Add Stateflow Observatory under the next rerelease slice in `docs/roadmap.md`, marking the app-owned Machine/Port boundary, pure viz layout API, and Astro host role. Record that future remote visual loads should use an app-owned Command, app-owned AsyncData/Model state, and a typed Port only for host input/output.

- [ ] **Step 2: Add the package usage examples.**

  Document this shape in the relevant READMEs:

  ```ts
  import { Option } from 'effect';
  import { revalidateOrLoad, refresh } from 'foldkit/asyncData';

  const loadOnFilter = refresh({
    read: (model) => Option.some(model.data),
    revalidate: revalidateOrLoad,
    write: (model, data) => ({ ...model, data }),
    load: LoadFilteredData(),
  });
  ```

  Explain that `foldkit-viz` receives already-derived records and geometry, while the app owns the remote Command, interruption/cancellation policy, AsyncData state, and Port boundary. Do not imply that a chart primitive can fetch or subscribe.

- [ ] **Step 3: Commit the documentation slice.**

  ```sh
  git add docs/roadmap.md packages/foldkit-viz/README.md packages/astro-foldkit/README.md
  git commit -m "docs: document stateflow and remote visual load boundaries"
  ```

---

### Task 6: Run the complete verification and visual acceptance gates

**Files:**

- Repository-wide verification only; no additional source files.

- [ ] **Step 1: Run focused package and app tests.**

  ```sh
  bun test packages/foldkit-viz/test/stateflow.test.ts
  bun test apps/web/src/apps/request-diagnostics apps/web/src/apps/stateflow
  ```

  Expected: PASS, including retained-island navigation and route-exit cancellation tests already in request-diagnostics.

- [ ] **Step 2: Run repository lint and formatting checks.**

  Run: `bun run check`

  Expected: the new and modified Stateflow files introduce no diagnostics and Oxfmt is clean. The current checkout has pre-existing repo-wide anti-slop/linteffect findings outside this slice; record the baseline comparison and do not broaden the slice to repair unrelated files. Do not invoke Biome or add lint suppressions for the new code.

- [ ] **Step 3: Run typecheck and the full test suite.**

  ```sh
  bun typecheck
  bun test
  ```

  Expected: PASS for `@opsydyn/foldkit-viz`, `@opsydyn/astro-foldkit`, and `@opsydyn/web`.

- [ ] **Step 4: Build and inspect the public package entry.**

  ```sh
  bun run --filter @opsydyn/foldkit-viz build
  bun pm pack --dry-run --cwd packages/foldkit-viz
  ```

  Confirm `dist/stateflow.mjs` and `dist/stateflow.d.mts` are included and that the package has no FoldKit, Effect, or Astro runtime import in that entry.

- [ ] **Step 5: Perform direct browser acceptance.**

  Start the app with `bun dev`, open `/stateflow`, and verify at desktop and mobile widths:

  - the static graph, current state, timeline, and table are visible before replay;
  - Step advances exactly one trace entry and updates the inspector;
  - Play advances the bounded fixture and stops at the end;
  - a command-producing transition shows `FetchMetrics.Interrupt` without starting a network replacement;
  - malformed host input is rejected;
  - keyboard focus reaches controls and graph/timeline selections;
  - reduced motion removes pulse animation while retaining active-state styling.

- [ ] **Step 6: Review the final diff without staging unrelated work.**

  Run: `git diff --check` and `git status --short`

  Confirm only the intended commits/files are part of the implementation slice. Preserve the pre-existing dirty files listed by the user and do not amend or reset unrelated commits.

## Completion Criteria

- `/stateflow` renders the approved Stateflow Observatory composition with a deterministic graph, replay controls, Port activity, inspector, and accessible event table.
- The graph is derived from `diagnosticsMachine.stateTags` and `diagnosticsMachine.edges`; every replay event is evaluated by `diagnosticsMachine.step`.
- Invalid inbound replay values are rejected at the Port boundary, ignored transitions are recorded without state mutation, and diagnostic Commands are displayed as metadata rather than executed by synthetic replay.
- `@opsydyn/foldkit-viz/stateflow` is plain-data, deterministic, and free of FoldKit, Effect, and Astro dependencies.
- `@opsydyn/astro-foldkit` has no runtime API change; its README documents its lifecycle-only role.
- The future remote filter/brush/zoom pattern is documented with app-owned Commands and AsyncData/Model state.
- Stateflow-focused Oxlint/Oxfmt, `bun typecheck`, workspace `bun run test`, package build, and direct browser acceptance pass before release work begins; any unchanged repo-wide lint debt is recorded separately from this slice.
