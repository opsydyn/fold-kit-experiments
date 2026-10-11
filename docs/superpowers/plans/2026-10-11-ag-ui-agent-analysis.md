# AG-UI Agent Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a maintained Astro reference demo proving validated AG-UI chart
updates, app-owned recovery and cancellation, with reproducible browser CI.

**Architecture:** A single FoldKit Model separates remote chart data from local
inspection and run lifecycle. A scoped subscription decodes HTTP/SSE from a
request-owned deterministic Astro endpoint. Neither public package acquires
agent state, transport or new APIs.

**Tech Stack:** FoldKit 0.167.0, Effect 4.0.0, Astro 7.2.8, Viz, Bun, Vitest,
AG-UI SDK 1.0.2, fast-json-patch 3.1.1, Playwright Test 1.62.1.

**Spec:** [Approved design](../specs/2026-10-11-ag-ui-agent-analysis-design.md).

Status: Tasks 1-3 implemented and independently reviewed. The user also approved
an internal Astro retention repair and the local merge of reviewed commits.
Task 4's UI, browser harness and independently reviewed Service Incident Lab
refinement are committed as `083dff8` and merged into local `main`: 724 workspace
passes (one existing skip), 8 real desktop/mobile browser passes, clean lint/types
and a successful web build. The user has approved pushing all reviewed commits.
Task 5 has not started. See the [current qualification record](../specs/2026-10-11-ag-ui-agent-analysis-qualification.md) and the
[local merge checkpoint](../specs/2026-10-11-ag-ui-local-merge.md) for scope,
evidence and remaining gates. The task checklists below retain the original
implementation sequence, not the current completion ledger.

## Global Constraints

- Product source stays in `apps/web`; related lockfile, CI/test/lint support and
  example docs may change. No Astro/Viz public API, chart-math, promo/export or
  independent-skill changes. Approved exception: internal Astro client-island
  mount ownership, hydration deduplication and remount sequencing, with package
  regression tests; no public API change.
- Approved Task 4 product refinement: preserve the first valid snapshot baseline
  per run, make the latency fixture coherent across reorder, expose a selected
  service comparison and atomic rejection evidence, and fit the mobile chart and
  table without horizontal scrolling. Keep synthetic labelling, explicit user
  actions, stable IDs and all stream lifetime/validation invariants unchanged.
- Keep FoldKit 0.167.0, Effect 4.0.0 and Astro 7.2.8 unchanged. Pin each new
  dependency exactly: AG-UI client/core/encoder 1.0.2, fast-json-patch 3.1.1,
  `@playwright/test` 1.62.1. The latter registry version was verified when planning.
- Follow both package skills, existing schemas/record returns, exhaustive union
  matches, static imports and the single intentional `lazyApp` loader.
- Use past-tense facts; `ReceivedAgentEvent`, not the child-reserved `Got*` prefix.
- Remote Service fields are `id`, `name`, `series`, `volume`, `latency`; IDs are
  unique/non-blank, series is `Core | Platform`, measurements are finite and >= 0.
- Local filter/selection never enter agent state. No credentials, provider calls,
  automatic reconnect, resync acknowledgement or live compute cancellation.
- Keep only twelve activity entries. Request-body limit is 16 KiB. Scenarios are
  exactly `normal | invalid | slow`; callers cannot supply timing or remote URLs.
- Cancellation, replacement, failure and disposal remove the active descriptor;
  stale events cannot mutate data, resume a stream or start another request.
- Default Layout navigation is unchanged; ClientRouter is opt-in for two hosts.
- Do not weaken lint globally. Any necessary native-I/O/test rule override must
  name the exact new boundary files and explain the ownership, matching existing
  narrow overrides in `oxlint.config.ts`; no blanket rule suppression.
- Run builds/typechecks/workspace tests sequentially because they share package
  `dist` outputs. Use the root test script, never bare root `bun test`.
- The original plan authorised no push, deployment, merge or package release.
  The later user instruction authorised this local merge and documentation only;
  push, deployment and package release remain outside scope.

## Review Focus

1. A retry receives a delta before its snapshot while old data remains visible:
   reject it rather than using the old run's Wire (Task 1).
2. Malformed/mismatched lifecycle events or completion/error callbacks arrive
   after cancel/replacement: preserve terminal state and never restart (Tasks 1, 3).
3. An oversized chunked body omits or lies about Content-Length: enforce actual
   bytes and return 413 before starting a producer (Task 2).
4. Abort happens before first read, races body cancellation, or follows normal
   completion: dispose producer resources once and emit nothing later (Tasks 2, 3).
5. Astro swaps to the retained host with the same island identity: preserve the
   runtime, filter/selection and one request, without a remount (Tasks 4, 5).

## File Map And Sequence

| Task | Owned deliverable and files                                                                                                                                       |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `src/apps/agent-analysis/{contract,model,message,update}.ts`, corresponding domain/update tests; web core/patch dependencies                                      |
| 2    | `src/server/agent-analysis/{fixtures,response}.ts`, backend tests and local HTTP test helper; `src/pages/api/agent-analysis.ts`; encoder dependency               |
| 3    | `src/apps/agent-analysis/{transport,subscription,navigation}.ts`, transport/runtime tests; client dependency                                                      |
| 4    | `src/apps/agent-analysis/{view,agent-analysis.css,main,app}.ts`, shared Astro host, two pages, Layout opt-in and Charts link; view tests and browser smoke/config |
| 5    | Full browser acceptance, CI/artifact ignores and maintained example/qualification docs                                                                            |

Application/server source paths below are relative to `apps/web`. References to
`apps/web/package.json`, `bun.lock`, `oxlint.config.ts`, `.gitignore`, `.github/`
and `docs/` are relative to the repository root. Execute Tasks 1-5 in order. Each
needs its own red/green cycle and focused review before the next; do not run
workers concurrently against the shared web manifest, lockfile or package outputs.

Before execution, use the worktree skill to select/create an isolated managed
checkout, inspect its current status, run baseline `bun typecheck` and
`bun run check`, and record evidence in
`docs/superpowers/specs/2026-10-11-ag-ui-agent-analysis-qualification.md`.
Read the spec and both package skills. Temporary spike files are reference
evidence only, never a runtime/test dependency.

### Task 1: Validated Model And Pure Run State Machine

**Files:** Create `src/apps/agent-analysis/{contract,model,message,update}.ts`,
`contract.test.ts`, `update.test.ts`. Modify `apps/web/package.json` and `bun.lock`.

**Interfaces:**

- `contract.ts` exports schemas/types `Service`, `Wire`, `Scenario`, `Filter`,
  `RunRequest = { readonly runId: string; readonly scenario: Scenario }`, and
  `NavigationValue = { readonly phase: 'coldLoad' | 'entered' | 'exited' | 'stayed';
readonly path: string; readonly previousPath: string | null }`, plus
  `THREAD_ID = 'agent-analysis'`.
- `model.ts` exports `Session`, `Model`, `initModel: Model`,
  `activeRun(model: Model): RunRequest | null` and
  `visibleServices(model: Model): ReadonlyArray<Service>`.
- Session shapes: Idle; Connecting/AwaitingSnapshot/Streaming `{ request }`;
  Completed `{ runId }`; Cancelled `{ runId, cause: 'User' | 'RouteExit' }`;
  Failed `{ runId, failure: { _tag: 'Protocol' | 'Transport', reason: string } }`.
- Model fields: `session`, `wire: Wire | null`, `filter`, `selectedId: string | null`,
  `generation`, `accepted`, `activity: readonly string[]`, `scenario`. Initial
  values: Idle, null, All, null, 0, 0, [], normal respectively.
- `message.ts` exports schema/type Message: ClickedRun/ClickedCancel/ClickedRecover;
  SelectedScenario `{ scenario }`; ClickedFilter `{ filter }`; ClickedService `{ id }`;
  ReceivedAgentEvent `{ runId, event: Schema.Unknown }`; FailedStream `{ runId, error }`;
  Navigated `{ phase, path, previousPath }` using the four existing lifecycle phases.
- `update(model: Model, message: Message): Return<Model, Message>` in `update.ts`.

- [ ] **1. Write the failing domain/update tests.** Include this baseline guard:

```typescript
it('does not reuse retained data as a new run snapshot baseline', () => {
  const old = {
    ...initModel,
    generation: 1,
    wire: { services: [] },
    session: Session.Completed({ runId: 'run-1' }),
  };
  const next = update(old, Message.ClickedRun()).model;
  const started = update(
    next,
    Message.ReceivedAgentEvent({
      runId: 'run-2',
      event: { type: EventType.RUN_STARTED, threadId: THREAD_ID, runId: 'run-2' },
    }),
  ).model;
  const failed = update(
    started,
    Message.ReceivedAgentEvent({
      runId: 'run-2',
      event: { type: EventType.STATE_DELTA, delta: [] },
    }),
  ).model;
  expect(failed.session._tag).toBe('Failed');
  expect(failed.wire).toBe(old.wire);
  expect(activeRun(failed)).toBeNull();
});
```

Other named tests assert immutable snapshots/deltas; duplicate IDs and invalid
numbers rejected; duplicate names allowed; JSON Patch move/copy/test operations;
later-operation failure rolls back the entire patch; prototype paths rejected;
invalid event/order/run/thread IDs fail only the active run; unrelated valid
event families ignored; stale runs return the same Model; completion after
failure/cancel does nothing; a non-completing terminal outcome cannot silently
become Completed and fails as unsupported Protocol; Recover creates one normal run and retains valid
data/filter/selection; filter/removal reconciles selection; activity caps at 12;
selected next scenario does not change an active descriptor. Exit cancels only
active states with RouteExit; completed exit and stayed produce no request.

- [ ] **2. Install only domain dependencies and prove red.** Add exact
      `@ag-ui/core@1.0.2` and `fast-json-patch@3.1.1` to web, update lockfile, then run
      `bun run --filter @opsydyn/web test src/apps/agent-analysis/contract.test.ts src/apps/agent-analysis/update.test.ts`.
      Expected: missing local exports/modules, not an unrelated dependency failure.
- [ ] **3. Implement the interfaces and pure transitions.** Use Schema.makeFilter
      for unique IDs, matching the comparison settings exemplar. Parse event envelopes
      through the SDK schema at the Message boundary; avoid unknown-parameter helper
      APIs and unchecked casts. Clone before validated JSON Patch and whole-Wire
      decoding. Run IDs are `run-${generation + 1}`. Preserve the same request across
      Connecting -> AwaitingSnapshot -> Streaming so dependencies stay equivalent.
      Failed removes the descriptor; Recover starts normal and requires a snapshot.
- [ ] **4. Prove green.** Re-run the focused command, then `bun run check` and
      `bun run --filter @opsydyn/web typecheck`; all exit 0, no new warnings.
- [ ] **5. Review and commit only this deliverable.** Check no effects occur in
      update, no duplicate Wire is kept in Session, and no empty commands field is
      invented. Commit: `feat(web): add validated AG-UI run model`.

### Task 2: Request-Owned Astro SSE Fixture Endpoint

**Files:** Create `src/server/agent-analysis/{fixtures,response}.ts`,
`fixtures.test.ts`, `response.test.ts`, `http.test-helper.ts`,
`src/pages/api/agent-analysis.ts`. Modify web manifest/lockfile for encoder;
`oxlint.config.ts` only if exact new native-I/O boundary overrides are required.

**Interfaces:**

- Consumes Task 1's domain contract, not its Model/update or browser modules.
- `FixtureInput = { readonly runId: string; readonly threadId: string;
readonly scenario: Scenario }`; `TimedEvent = { readonly delayMs: number;
readonly event: BaseEvent }` in `fixtures.ts`.
- `fixtureEvents(input: FixtureInput): ReadonlyArray<TimedEvent>` and
  `initialWire: Wire`. Fixtures contain API/Core/1200/60, Search/Core/800/110,
  Queue/Platform/1700/90; added Events/Platform/2100/170, with stable lower-case IDs.
- `ResponseObservation`: Emitted `{ eventType: BaseEvent['type'] }` or Disposed
  `{ cause: 'Completed' | 'Aborted' | 'Cancelled' }`; `ResponseObserver` is its callback.
- `createFixtureResponse(input: FixtureInput, signal: AbortSignal,
observe?: ResponseObserver): Response` and
  `serveAgentAnalysis(request: Request, observe?: ResponseObserver): Effect.Effect<Response>`
  in `response.ts`. All expected input errors become HTTP responses.
- HTTP test helper exports `startAgentTestServer(): Promise<AgentTestServer>`;
  `AgentTestServer` exposes `url: string`,
  `requests: ReadonlyArray<AgentTestRequest>` and `close(): Promise<void>`.
  `AgentTestRequest` has `input: FixtureInput` and
  `observations: ReadonlyArray<ResponseObservation>`; count requests via length.
  Each test server owns its records. Node-only code stays in this test helper.

- [ ] **1. Write failing fixture/response tests.** Assert exact normal order:
      start, baseline, replace API latency with 145, reversed original baseline,
      add Events, finish. Invalid replaces API with 999 then removes services/99 in
      one patch, followed by a valid delta/finish. First event delay is 0; subsequent
      normal/invalid delays are 650ms; slow delays after its snapshot are 4000ms.
      Response tests assert 400 for malformed JSON/schema/scenario, 413 for actual
      bodies above 16,384 bytes including chunked/misleading Content-Length, SSE/no-cache
      headers, independent concurrent requests and no producer allocated on rejection.
      Fake-clock tests assert abort-before-read, body cancellation, both together,
      and completion-then-cancel yield exactly one Disposed observation and no later
      Emitted observation after advancing beyond every scheduled fixture event.
- [ ] **2. Add exact `@ag-ui/encoder@1.0.2` and prove red.** Run
      `bun run --filter @opsydyn/web test src/server/agent-analysis`.
      Expected: missing fixture/response implementation.
- [ ] **3. Implement the request boundary and endpoint.** Decode the byte-bounded
      body using SDK RunAgentInputSchema plus the domain scenario schema; enforce
      THREAD_ID. POST delegates to Effect.runPromise at the Astro HTTP boundary.
      Use the encoder and Web-standard response stream; keep each timer/cursor,
      abort listener and idempotent disposer inside that request. Returning Response
      must not end its producer lifetime: cleanup belongs to stream completion,
      body cancellation or request abort, not an enclosing short-lived HTTP Effect.
      Observer injection is test-only, never a public metrics route or global registry.
- [ ] **4. Add the local HTTP adapter and prove green.** It listens on an ephemeral
      loopback port, faithfully maps response disconnect to AbortController/reader
      cancellation, and closes all sockets/listeners in test teardown. Run the Task 2
      tests, `bun run check` and web typecheck. Expected: exit 0 and no dangling server.
- [ ] **5. Review and commit.** Check byte limits don't trust headers, cleanup
      can't double-close, late timers can't enqueue, and production imports contain
      no node:http/Bun.serve. Commit: `feat(web): add request-scoped AG-UI SSE fixtures`.

### Task 3: Scoped Client Stream And Navigation Port

**Files:** Create `src/apps/agent-analysis/{transport,subscription,navigation}.ts`,
`transport.test.ts`, `main.scene.test.ts`; modify web manifest/lockfile for client;
`oxlint.config.ts` only if exact new native-I/O bridge overrides are required.

**Interfaces:**

- Consumes Tasks 1-2 contracts and the local HTTP test server.
- `navigation.ts` re-exports Task 1's NavigationValue schema/type, plus NavigationPort and
  `toNavigationValue(event: NavigationValue): NavigationValue` (identity mapper).
- `AgentTransportOptions = { readonly endpoint: string; readonly fetch: typeof globalThis.fetch }`;
  `toRunInput(request: RunRequest): RunAgentInput` and
  `agentStream(request: RunRequest, options?: AgentTransportOptions): Stream.Stream<Message>`.
  Default endpoint `/api/agent-analysis`; input has THREAD_ID, run ID, empty
  services/messages/tools/context and forwardedProps `{ scenario }`.
- `subscriptionsFor(options?: AgentTransportOptions): Subscription.Subscriptions<Model, Message>`.
  Agent entry dependencies are `{ request: RunRequest | null }`; navigation uses
  Port.subscriptionEntry. Nullable request is represented in the dependency schema.

- [ ] **1. Write failing transport and Runtime.embed scene tests.** Real HTTP/SSE
      normal run produces Completed/four services/four accepted state updates and
      one request. Fragmented UTF-8 events retain non-ASCII service names. HTTP failure
      and closure without terminal event become FailedStream facts. Interrupting the
      collecting Effect fiber or disposing the embedded runtime aborts the actual
      request, disposes the producer once and starts no replacement. Scene tests send
      exit during Connecting/AwaitingSnapshot/Streaming, exit after Completed, stayed,
      scenario/filter/selection changes, replacement and late completion/error facts.
      Assert request counts, preserved cancellation cause and retained valid Wire.
- [ ] **2. Add exact `@ag-ui/client@1.0.2` and prove red.** Run
      `bun run --filter @opsydyn/web test src/apps/agent-analysis/transport.test.ts src/apps/agent-analysis/main.scene.test.ts`.
      Expected: missing stream/subscription/Port exports.
- [ ] **3. Implement the scoped bridge.** Use runHttpRequest and
      transformHttpEventStream, not HttpAgent state. Stream.callback/acquireRelease
      owns AbortController and observable subscription; emit ReceivedAgentEvent with
      captured local run ID. Transport errors/end become facts; the reducer ignores
      closure after a valid terminal event. On release abort and unsubscribe without
      synchronous update/DOM mutation or inline runtime provisioning. Use the same
      request dependency through lifecycle changes and Stream.empty when absent.
- [ ] **4. Prove green and compare the real runtime, not just pure update.** Run
      Tasks 1-3 tests, lint and web typecheck; confirm zero leaked listeners/sockets
      and no extra request when unrelated Model fields or lifecycle phase change.
- [ ] **5. Review and commit.** Verify the native fetch/Rx cleanup boundary,
      queued-message identity guards and Port semantics before any UI work.
      Commit: `feat(web): scope AG-UI streams to FoldKit lifecycle`.

### Task 4: Chart View, Discoverable Hosts And Real Retained Navigation

**Files:** Create `src/apps/agent-analysis/{view,agent-analysis.css,main,app}.ts`,
`view.test.ts`, `src/components/AgentAnalysisHost.astro`,
`src/pages/agent-analysis.astro`, `src/pages/agent-analysis/retained.astro`,
`playwright.config.ts`, `e2e/agent-analysis.smoke.spec.ts`. Modify Layout.astro,
Charts page and web manifest/lockfile for browser scripts/dependency.
Add exact browser-harness paths to `oxlint.config.ts` only where the same test
boundary exceptions as existing test files are required.

**Interfaces:**

- Consumes Task 3 subscriptions/ports and Task 1 initModel/update.
- `body(model: Model, h: HtmlBuilder<Message>): Html` and
  `view(model: Model, h: HtmlBuilder<Message>): Document` in `view.ts`.
- `main.ts` exports Model, Message, update, view, subscriptions, ports and navigation;
  `init(): Return<Model, Message>` returns idle/no commands. `app.ts` exports
  `lazyApp<{ noMeta?: boolean | '' }>(() => import('./main'))`, with no Flags export.
- Layout gets optional `clientNavigation?: boolean = false`; a static
  ClientRouter import renders only when enabled. AgentAnalysisHost accepts
  `variant: 'overview' | 'retained'` for surrounding Astro content, never island
  props. Both routes mount `client:load noMeta transition:persist="agent-analysis"`.
- Browser script `test:e2e` is `bun run predev && playwright test`;
  `test:e2e:smoke` is `bun run test:e2e e2e/agent-analysis.smoke.spec.ts`.
  Exact dev dependency
  `@playwright/test@1.62.1`. Config uses Chromium, one worker, no reused server,
  loopback port 4371, failure traces/screenshots and viewport projects
  `desktop` (1365x900) and `mobile` (390x844).

- [ ] **1. Write failing render and browser smoke tests.** Server-render body
      through the existing renderChart helper; assert initial empty data, scenario
      select, Run/Recover/Cancel disabled rules, twelve-entry disclosure, aria-live
      status, pressed-state filter/selection semantics and stable service IDs.
      Failed/cancelled/connecting retain valid rows; no pointer-only interaction.
      Smoke asserts Charts link, shell before hydration, Idle after hydration with
      zero POSTs, a populated chart/table, keyboard activation, and a retained route
      swap preserving the same island UID, DOM instance, selected ID and request.
- [ ] **2. Install the pinned browser test package and prove red.** Update lockfile;
      `bun run --filter @opsydyn/web test src/apps/agent-analysis/view.test.ts` fails
      on missing view. Add the scripts and minimal Playwright configuration specified
      above, then install Chromium at execution time, never use a bundled developer
      runtime path. Run `bun run --filter @opsydyn/web test:e2e:smoke`; it must fail for
      the missing demo/hosts, not for an absent command, config or browser binary.
- [ ] **3. Implement the view and hosts.** Reuse Viz cartesian helpers with the
      parent's builder, chart tokens and vanilla-extract; no geometry rewrites.
      Labels: Service analysis, Synthetic service measurements, Run, Recover, Cancel;
      scenario options Normal, Invalid patch, Slow; filters All, Core, Platform.
      Table buttons provide keyboard selection and SVG has a non-colour selected cue.
      Chart/table scroll inside narrow containers, not the page. Link from Charts.
      Opt-in Layout router leaves every existing caller unchanged. Rebind the existing
      theme toggle after an Astro swap without duplicate listeners, scoped to router
      hosts, so enabling routing does not break the current shell.
- [ ] **4. Complete browser config and prove green.** Have Playwright own its
      foreground server and shutdown. For pinned Astro 7.2.8, set
      `ASTRO_DEV_BACKGROUND=1` in webServer.env to bypass agent auto-backgrounding;
      command `bunx --no-install astro dev --host 127.0.0.1 --port 4371 --ignore-lock`.
      Do not use the existing `dev --force` script: it could replace another user's
      server. Config readiness waits on `/agent-analysis`; an occupied port fails
      rather than connecting to an unrelated server. Run view/scene tests, smoke,
      lint, web typecheck and production build, all exit 0. Default Home must still
      have no ClientRouter script and both new hosts share island identity/props.
- [ ] **5. Review and commit.** Inspect both viewport screenshots and actual SVG
      paths/table rows, not just a status label. Verify no page overflow, visible
      focus, one runtime, and real Astro navigation, not synthetic event dispatch.
      Commit: `feat(web): add AG-UI analysis chart and retained hosts`.

### Task 5: Full Browser CI, Production Boundary And Maintained Guide

**Files:** Create `e2e/agent-analysis.spec.ts`, `docs/examples/ag-ui-agent-analysis.md`,
`docs/superpowers/specs/2026-10-11-ag-ui-agent-analysis-qualification.md` (if not
already present). Modify `.github/workflows/ci.yml`, `.gitignore`,
`apps/web/README.md`, spike findings and spec/plan checkboxes as evidence permits.
If Task 4 needed a test boundary override, extend it only to the new acceptance
file in `oxlint.config.ts`, never the application update/validation modules.

**Interfaces:**

- Consumes Task 4 canonical Playwright config, hosts and `test:e2e` script.
- Qualification ledger records command, checkout, exit/result, browser evidence
  and limits for each gate. No new production API/test metrics endpoint.

- [ ] **1. Write acceptance cases before the final integration corrections.**
      Normal streaming with Core filtering/keyboard API selection survives reorder;
      All exposes four real marks. Invalid patch never renders 999, retains latency
      60, becomes Failed and does not restart; Recover adds exactly one normal POST
      and a fresh snapshot before accepting a delta. Slow Cancel after first snapshot
      retains three rows, disables Cancel and emits no replacement POST. Retained
      navigation preserves actual island element/run; leaving while active aborts
      the request; leaving after completion has no cancel/replacement. At both sizes,
      capture no page exceptions/application console errors and no document overflow.
      Toggle light/dark after a retained swap and verify working controls/focus.
- [ ] **2. Run acceptance and record red evidence for any unmet behaviour.**
      `bun run --filter @opsydyn/web test:e2e`. Use observable status/rows/network
      predicates, not sleeps to guess render completion; don't mistake previous
      run's retained rows for the new run snapshot. Tests also assert idle hosts
      do not fetch. Fix only gaps in Tasks 1-4 ownership boundaries and re-run the
      owning unit test before browser acceptance. If acceptance is already green,
      record it honestly; don't manufacture a missing feature to obtain red.
- [ ] **3. Wire the existing CI job to browser acceptance.** After frozen install
      and the existing check/typecheck/test/build steps, install Chromium with
      `bunx --no-install playwright install --with-deps chromium` from apps/web and
      run the canonical test:e2e script. Upload `apps/web/test-results` and
      `apps/web/playwright-report` on failure using actions/upload-artifact@v4.
      Ignore those generated directories locally. Node-only test setup belongs in
      tests; do not change the production adapter or deploy workflow.
- [ ] **4. Qualify the compiled endpoint locally.** Run web build and local
      Wrangler against `dist/server/wrangler.json`, port 4372, with no remote/cloud
      writes; send normal/invalid input and confirm streamed encoded events rather
      than buffered output. Exercise disconnect cleanup where locally observable.
      Stop the owned process. If adapter/emulator permissions block this, record the
      exact limitation and leave that host gate open: dev proof is not deployed proof.
- [ ] **5. Finish the guide and final verification.** Document routes, fixtures,
      Model/transport ownership, manual recovery, supported event subset and deferred
      live cancellation/resync/context. Link from web README and spike findings.
      Run root `bun run check`, `bun typecheck`, `bun run test`, web build and test:e2e
      sequentially; require exit 0 and independently inspect desktop/mobile evidence.
      Fresh whole-branch review precedes marking gates complete. Treat screen-reader,
      deployment/publication and backend compute cancellation as unqualified.
- [ ] **6. Review and commit only qualified changes.** Update checkboxes/ledger
      incrementally, preserve any blocked host gate, and record the review URL on
      an unused local port if leaving a server for the user. Commit:
      `test(web): qualify AG-UI analysis demo in browser CI`. Report clean local
      status; do not push or release.

## Plan Self-Review And Handoff

Coverage: Model/recovery -> Task 1; bounded SSE/resources -> Task 2; decoder,
subscriptions and navigation facts -> Task 3; rendering/real hosts -> Task 4;
full browser acceptance, CI, production-host evidence and docs -> Task 5.
Every Review Focus item has an owning test. Interfaces use one RunRequest,
Wire and Message contract; no task invents a parallel state store or unknown
transport helper type. All tasks end in a testable checkpoint and focused commit.

Recommended execution is subagent-driven: five reviewable checkpoints, with
security/cleanup mistakes caught before they become part of the UI. Native
execution remains available, with one independent whole-branch review at the end.
Await plan approval and the selected method before implementing Task 1.
