# AG-UI Agent Analysis Reference Demo

Status: original design and plan approved on 2026-10-11. Tasks 1-3 and the
approved internal Astro retention repair are reviewed and merged locally.
Task 4's Service Incident Lab refinement is implemented, independently reviewed
and locally qualified following approval of the Product Sense direction and
interactive mockup. It is committed as `083dff8` and merged into local `main`;
the user approved pushing the reviewed work. Task 5 remains open; see the
[qualification record](./2026-10-11-ag-ui-agent-analysis-qualification.md).

## Approved Product Refinement

The user approved a more useful developer showcase: inspect a latency regression
against its first valid run snapshot, then see an unsafe update rejected without
losing measurements or selection. The approved interactive visual mockup shows
baseline, accepted spike and rejection states; its imperative prototype is not
production architecture.

Task 4 adds an app-owned first-snapshot comparison baseline, bounded rejected
update evidence, selected-service inspector and fixed-domain chart comparison.
The illustrative 100ms p95 budget is explicitly not a production SLO. API's
60 -> 145ms change survives snapshot reordering. The invalid fixture accepts
that valid spike before attempting the unsafe multi-operation patch.

Initial three-service data and the later fourth-service addition stay intact;
counts derive from records and added services have no manufactured baseline.
Existing explicit selection policy remains unchanged. The mobile chart and table
fit their containers rather than requiring the originally proposed horizontal
scrolling. Any compact-layout observation stays in a scoped app subscription.

This supersedes the original scrolling presentation only, not schema validation,
run correlation, cancellation, recovery, retained-island or package boundaries.
No public package API change, provider integration, chat UI or autonomous action
is authorised. Local lifecycle facts cannot establish a real compute-cancellation
guarantee. Screen-reader and compiled/deployed Worker qualification remain open.

## Outcome

Developers can inspect synthetic service measurements while an AG-UI stream
updates a FoldKit chart, keep local inspection independent of remote state,
recover safely from malformed updates, and observe lifecycle-owned cancellation.
The example must be maintained in the repository and reproducible in CI rather
than depend on temporary files or Vite-only middleware.

The [feasibility spike](../../examples/ag-ui-spike.md) established the protocol
fit using published packages. Its implementation remains throwaway: migrate the
qualified behaviours into repository conventions, not the temporary server,
mutable metrics registry or test harness paths.

The selected approach is an app-owned deterministic backend. A real provider
would introduce credentials and deployment concerns; a public adapter is
premature without a second consumer exposing shared contracts.

## Scope And Boundaries

- One `/agent-analysis` demo with a scatter chart, service table, series filter,
  stable-ID selection, run status and bounded activity log.
- Normal, malformed-patch and slow fixture scenarios, plus manual recovery.
- A real Astro POST endpoint returning AG-UI events over HTTP/SSE.
- Request-scoped cleanup, active-run guarding and navigation teardown.
- Retained fixtures, unit/transport tests and desktop/mobile browser CI.
- An app-local retained-navigation route for genuine Astro router acceptance.

No public Astro or Viz API changes, chart-math changes, provider calls,
credentials, agent framework, chat UI, frontend tools, downloadable promo
project, automatic reconnection, server run registry, or live compute-cancel
acknowledgement belongs in this slice. Explicit resync request/acknowledgement
and outgoing filter/selection context remain subsequent backend work.

Astro owns document rendering and lifecycle facts. FoldKit owns the application
Model and effect descriptions. Viz receives validated records and owns geometry
and rendering only. AG-UI dependencies belong to `@opsydyn/web`, never the two
standalone packages or their independently usable skills.

## Source Ownership

| Area               | Location and responsibility                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Application        | `apps/web/src/apps/agent-analysis/`: Model, Messages, pure update, scoped stream, navigation mapper, view and styles |
| Fixture backend    | `apps/web/src/server/agent-analysis/`: validated input, deterministic event sequence and request-owned SSE response  |
| API route          | `apps/web/src/pages/api/agent-analysis.ts`: thin POST shell around the backend                                       |
| Hosts              | `/agent-analysis` and `/agent-analysis/retained`: one shared host and identical island identity/props                |
| Navigation opt-in  | `apps/web/src/layouts/Layout.astro`: optional client navigation, disabled by default                                 |
| Discovery          | `apps/web/src/pages/charts.astro`: link to the reference demo                                                        |
| Browser acceptance | `apps/web/e2e/` plus an app-owned browser-test script/configuration and `.github/workflows/ci.yml`                   |
| Documentation      | Maintained example guide under `docs/examples/`, linked from the spike findings                                      |

Use `lazyApp` and package imports. Its lazy `main` loader is the intentional
dynamic-import boundary; imports elsewhere remain static. The loaded island
module exports real Model/Message schemas and no runtime Flags schema.

Pin the spike-qualified AG-UI client/core/encoder 1.0.2 and JSON Patch 3.1.1 for
this slice. Add a pinned Playwright test dependency for reproducible browser CI.
Keep current FoldKit 0.167.0, Effect 4.0.0 and Astro 7.2.8 unchanged. Installation
and lockfile changes occur during implementation, not this design stage.

## Model And Validation

Remote data is `Wire = { services: readonly Service[] }`. A Service has a unique
non-blank `id`, non-blank `name`, `Core | Platform` series, finite non-negative
`volume` (requests/minute) and finite non-negative `latency` (p95 milliseconds).
Decode complete snapshots and every patched candidate with Effect Schema;
reject duplicate IDs. Reuse the SDK's event/input schemas for protocol envelopes
rather than inventing a second AG-UI schema implementation.

The Model separately owns the last valid Wire, `All | Core | Platform` filter,
optional selected ID, monotonic run generation, accepted-update count and the
last twelve activity entries. Selection is reconciled by ID against visible
records after data or filter changes, never by array index or display name.

Represent run lifecycle with tagged states:

- `Idle`.
- `Connecting`, with an immutable run request descriptor.
- `AwaitingSnapshot`, after the matching `RUN_STARTED` but before this run's
  first valid snapshot.
- `Streaming`, with the matching run request; the Model's Wire is now this run's
  validated baseline, not a second data copy inside the lifecycle state.
- `Completed`, with the finished run ID.
- `Cancelled`, with the run ID and `User | RouteExit` cause.
- `Failed`, with the run ID and a typed `Protocol | Transport` failure reason.

The descriptor identifies the locally owned connection and fixture scenario.
The subscription derives its dependencies from that immutable descriptor only.
Changing filters, selection, counters, activity or incoming Wire must not restart
the stream. Do not use a retained previous run's Wire as a new run's delta
baseline; `AwaitingSnapshot` makes that distinction explicit.

Run IDs need only be unique within this app instance: the fixture backend is
stateless across requests. This is not a distributed agent session identity
scheme. Add local connection identity to every transport Message because state
events do not carry lifecycle run IDs.

## Update And Recovery Contract

Messages are facts such as `ClickedRun`, `ClickedCancel`, `ClickedRecover`,
`ClickedFilter`, `ClickedService`, `ReceivedAgentEvent`, `FailedStream` and
`Navigated`. Reserve `Got*` for child-app results, as required by the repository's
lint rules. Use the union's exhaustive match and record-shaped update returns.

1. Run starts a fresh descriptor and enters Connecting. If another stream is
   active, replacing its descriptor disposes that stream. Retain last valid
   data/filter/selection while connecting; reset only per-run counters.
2. Matching `RUN_STARTED` enters AwaitingSnapshot. Validate its run/thread IDs
   and ordering before accepting state. A valid snapshot establishes this run's
   baseline and enters Streaming.
3. Apply JSON Patch operations to a clone with operation validation and
   prototype-path protection, then decode the entire candidate. Only a fully
   valid candidate replaces Wire; failed multi-operation patches are atomic.
4. A malformed supported event, invalid data/patch, missing baseline, or invalid
   supported lifecycle ordering enters Failed and removes the active descriptor.
   Retain the last valid chart. No subsequent delta can be accepted from that
   run, even if it was already queued by the decoder.
5. Recover is enabled only for Failed. It starts a new normal-fixture run and
   requires a fresh snapshot. It is a user-directed new request, not AG-UI resume,
   an in-run resync acknowledgement or an automatic retry loop.
6. Matching completion enters Completed. Transport closure without a terminal
   event enters Failed. A closure fact queued after valid completion is ignored.
7. Cancel is a no-op without an active run. Otherwise enter Cancelled and remove
   the descriptor; cleanup aborts the request. Never create a replacement run.
8. Events/failures from inactive or replaced connections are complete no-ops.
   Valid event families outside the documented lifecycle/state subset are
   ignored; this demo does not claim full AG-UI client compliance.

AG-UI specifies complete snapshots and RFC 6902 deltas; snapshots establish a
new baseline after inconsistency. See [Shared State](https://docs.ag-ui.com/concepts/state)
and the [event definitions](https://docs.ag-ui.com/sdk/js/core/events).

## Transport And Fixture Backend

Use the qualified AG-UI client's low-level HTTP/SSE decoder rather than a second
`HttpAgent` state store. A scoped subscription bridges decoded events into
FoldKit Messages. Its Effect scope owns AbortController and observable cleanup.
Commands own any one-shot effects. Provision dependencies at the owning service
or exported Effect boundary, not inside local helper bodies.

POST `/api/agent-analysis` accepts a validated RunAgentInput and a bounded
`normal | invalid | slow` scenario in forwarded props. The client sends no tools,
messages or context and an empty initial remote services state. Local inspection
is never written into agent state in this slice. Reject malformed input before
streaming; limit the request body to 16 KiB and return 413 above that limit.

The deterministic normal fixture emits start, snapshot, valid delta, reordered
snapshot, added service and completion. Invalid emits start, snapshot and a
multi-operation patch whose later operation fails, so a partial earlier change
must never render. It schedules a valid delta and completion after the fault to
exercise cleanup and rejection of already-queued late facts. Slow delays updates
after its first snapshot to provide a reliable cancellation window. Inputs
cannot select arbitrary delays, URLs, filesystem access or remote computation.

Return `text/event-stream` with no-cache semantics, using the AG-UI encoder and
Web-standard Request/Response/ReadableStream primitives. Each request owns its
event cursor, cancellation signal and timer/fiber resources. Body cancellation,
request abort and normal completion must dispose them exactly once. Do not
retain observers, run records or timer handles in a process-global registry.

Tests may inject a request-local observer to prove disposal and no later
emission. Such observations are test evidence, not a production metrics endpoint
or proof that aborting HTTP cancels a real agent's compute. Keep the backend
compatible with the existing Cloudflare adapter, without Node-only server APIs.

## Navigation And Hosting

Configure the app's existing-style inbound navigation Port. On `exited`, cancel
only an active run and record RouteExit intent. On `stayed`, preserve the stream,
Wire and local inspection. `coldLoad` and `entered` do not automatically run the
fixture: users start it explicitly. Runtime disposal must also close its scope
when a page leaves without a lifecycle Message being processed first.

The current shared Layout has no ClientRouter. Add an optional navigation flag,
off by default, and enable it only for the demo's two hosts. Both hosts use the
same maintained island, identical props and an explicit persistence name. The
retained route changes only Astro-owned surrounding content; it must not remount
the chart or start a second request.

Provide ordinary links between the two hosts and back to Charts. Browser tests
must exercise actual Astro swaps, not merely dispatch synthetic events. Test
exit while active, exit after completion and retained stayed navigation. Leaving
to a non-router page may be a full navigation; request teardown must still occur.

## View And Accessibility

Reuse Viz scatter geometry/frame/axes/marks with the parent HtmlBuilder and the
repository's chart tokens and vanilla-extract conventions. The first screen is
the usable chart, not a landing page. Display synthetic-data labelling, units,
run status, accepted-update count, selected service and concise recovery errors.

Use a native scenario select, explicit Run/Recover/Cancel commands, segmented
series filters and a bounded native activity disclosure. Invalid actions are
disabled. Table selection supports keyboard activation and visible focus, with
a non-colour selection cue in the chart. The SVG remains a labelled image; this
slice does not add pointer hit testing or an interactive chart-mark API.

Keep the last valid data visible on failure/cancel and during a new connection.
An empty initial state is explicit. Narrow charts and tables may scroll within
their own containers; controls and the page must fit at 390px without document
overflow. Do not claim automatic geometry resizing or screen-reader acceptance
from these browser checks. Verify both existing light and dark themes.

## Acceptance Gates

- [ ] Pure update tests cover snapshot/delta immutability, duplicate/non-finite
      data, atomic rollback, prototype paths, invalid ordering, new-run baseline
      separation and stale-connection no-ops.
- [ ] Data/filter changes reconcile selection by stable ID and never restart
      the stream. Recovery retains valid data and starts exactly one fresh run.
- [ ] Real local HTTP/SSE tests cover fragmented UTF-8, HTTP failure, premature
      close, terminal completion and interrupt/dispose closing the request.
- [ ] Backend tests cover validated/bounded inputs, exact fixture ordering,
      independent requests and disposal with no later timer emission.
- [ ] Runtime/Port tests cover active exit, completed exit, retained stayed,
      disposal races and no cancellation-triggered replacement.
- [ ] Playwright tests at desktop and 390px cover actual hydration, stream
      updates, keyboard selection, local filtering, reorder identity, recovery,
      cancel, real retained navigation, page exit and no application exceptions.
- [ ] Browser CI installs Chromium, starts an isolated local web server and
      cleans it up; retain failure traces/screenshots. No temporary runtime or
      developer-specific filesystem path is required.
- [ ] Default Layout pages retain their existing navigation behaviour and
      Charts links to the demo. Browser tests confirm light/dark control fit.
- [ ] `bun run check`, `bun typecheck`, `bun run test` and the web production
      build pass. Verify the compiled Cloudflare endpoint locally where supported;
      record host-streaming limitations separately from development proof.
- [ ] The maintained guide records ownership, supported event subset, run and
      recovery semantics, test commands and deferred backend responsibilities.

These gates are future work, not claims established by this spec or the spike.
Spec approval permits writing the implementation plan. Execution method and plan
approval remain separate; push, deployment and package release are not authorised.
