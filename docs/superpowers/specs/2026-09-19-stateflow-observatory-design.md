# Stateflow Observatory Design

Status: Draft for review
Date: 2026-09-19

## Goal

Create a visual reference experience for the next FoldKit rerelease that makes
the experimental FSM API and typed Port boundary observable as a living,
inspectable workflow.

The experience is called **Stateflow Observatory**. It should feel like a
serious diagnostic instrument rather than another generic chart demo: users can
see the machine graph, replay messages, inspect transition outcomes, and follow
typed inbound and outbound events.

## Context

- `apps/web` already owns the request-diagnostics machine, its messages, route
  lifecycle facts, commands, and navigation Port.
- FoldKit 0.161 exposes machine edge summaries and transition results as plain
  data. The graph can therefore be derived without parsing Mermaid output.
- FoldKit Port provides typed inbound and outbound channels, subscriptions,
  streams, and command-side emission.
- `foldkit-viz` already provides pure layout, link, zoom, tween, and shape
  primitives. It must remain independent of FoldKit, Effect, and Astro.
- `astro-foldkit` already bridges app configuration and client islands. The
  first slice does not need a new Astro lifecycle API.
- A generic force graph, Sankey, or event log would overlap existing examples.
  Stateflow Observatory is differentiated by showing FoldKit semantics rather
  than only chart geometry.

This design describes the approved visual direction and the first technical
slice. It does not change production code or dependencies.

## Design Summary

The first showcase is a standalone reference page, recommended as `/stateflow`,
backed by the existing request-diagnostics machine as its initial fixture.

The page has five coordinated regions:

1. **Machine header**: current state, transition count, ignored count, and
   latency or replay status.
2. **Replay and Port rail**: play, pause, step, speed, session selection, and
   typed inbound/outbound Port activity.
3. **State graph**: machine states as nodes and machine edges as links, with
   active, visited, failed, and transient styling plus transition pulses.
4. **Event inspector**: the selected message, source and target states, guard,
   outcome, structured payload summary, and command result.
5. **Timeline**: transition history and recent events, with a compact table
   projection for precise inspection.

The graph and timeline are the primary experience. The inspector and Port rail
are supporting views of the same model, not separate sources of state.

## Ownership Boundaries

### `apps/web` owns runtime semantics

The web app owns:

- the `Machine` definition and its message union;
- the replay model, selected event, transition history, and counters;
- inbound replay and navigation Port schemas;
- outbound transition telemetry Port schemas;
- Port subscriptions and app messages produced by those subscriptions;
- commands, HTTP work, interrupt policy, and command result facts;
- payload redaction and the structured inspector projection;
- the decision to replay a message through `machine.step` or to ignore it.

Every displayed transition must be derived from an app-owned message fact and
the corresponding `Machine.step` result. The visual layer must not reimplement
guards, transition policy, command ownership, or cancellation semantics.

### `packages/foldkit-viz` owns pure visual computation

The viz package may own plain-data helpers for:

- deterministic state graph layout;
- link paths and arrow geometry;
- transition pulse positions or progress values;
- node and edge view-model normalization;
- zoom, pan, hit-testing, and tween calculations.

The package must not import `foldkit`, `effect`, `@opsydyn/astro-foldkit`, or
application message and Port types. Its API accepts stable records and returns
stable records. It does not execute commands, subscribe to Ports, or interpret
machine messages.

### `packages/astro-foldkit` remains a host bridge

The Astro integration continues to provide client-island mounting and lifecycle
facts. It must not own the FSM, replay policy, transition history, or async
visualization concerns for this slice.

The existing client bridge and app `ports` configuration should be reused. Any
future Astro work should remain limited to making the island and typed Port
configuration easier to consume from `.astro` pages.

## FoldKit Machine Contract

The app should use the machine's plain data and transition APIs directly:

- `machine.stateTags` is the authoritative node list;
- `machine.edges` is the authoritative edge list;
- `machine.step(state, message, ...context)` is the authoritative event
  evaluation;
- `Transitioned` and `Ignored` are rendered as explicit outcomes;
- `machine.unreachableStates()` and `machine.deadTransitions()` provide
  diagnostics for the fixture and test assertions;
- `machine.toMermaid()` is optional export/debug output only, never the primary
  graph parser.

The first fixture should continue to use the existing request-diagnostics
states: `Loading`, `Ready`, `Selecting`, `Filtered`, `Failed`, `Cancelling`,
and `Idle`. The page should make the cancellation path visible without
changing its ownership or policy.

## Proposed Pure Viz Records

The exact public names can be refined during implementation, but the boundary
should have this shape:

```ts
type StateFlowNode = {
  readonly id: string;
  readonly label: string;
  readonly role: 'initial' | 'normal' | 'active' | 'error' | 'transient';
  readonly visitCount: number;
};

type StateFlowEdge = {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly event: string;
  readonly guard: 'unguarded' | 'when' | 'otherwise';
  readonly transitionCount: number;
  readonly lastSeenAt?: number;
};

type StateFlowLayout = {
  readonly nodes: ReadonlyArray<StateFlowNode & { readonly x: number; readonly y: number }>;
  readonly edges: ReadonlyArray<StateFlowEdge>;
};
```

The final API should not expose `Machine`, `Message`, `Port`, `Effect`, or
arbitrary raw payloads. If the existing force layout is used, its input and
output must remain deterministic for the same records, dimensions, and options.

Use a stable graph ID derived from state and message tags, not array position.
This keeps SSR output, hydration, replay selection, and test snapshots stable.

## App-Owned Trace Contract

The app should normalize each evaluated event to a trace record similar to:

```ts
type TransitionTrace = {
  readonly sequence: number;
  readonly at: number;
  readonly messageTag: string;
  readonly outcome: 'transitioned' | 'ignored';
  readonly from: string;
  readonly target?: string;
  readonly reason?: string;
  readonly sourcePort?: string;
  readonly durationMs?: number;
};
```

The trace is an app model value. It is not a second state machine and must not
be updated by the view. `target` is absent for an ignored event. `reason` is a
small app-owned explanation such as `guard-rejected` or `route-exited`; it must
not require serializing internal Effect values.

The inspector receives a redacted, structured projection of the selected trace
and message. It must not expose credentials, full HTTP responses, or arbitrary
unvalidated payload data.

## Port and Data-Bus Contract

Use Ports only at the application boundary:

- an inbound `ReplayEvent` Port accepts validated replay inputs;
- the existing navigation Port continues to deliver lifecycle facts;
- an outbound `TransitionRecorded` Port reports a redacted transition record
  for the Port rail or an external host;
- Port subscriptions map incoming values to app messages;
- a Command uses `Port.emit` for outbound telemetry.

Internal replay remains `Message -> update -> Model`. The Port layer must not
become a hidden global event bus, and the view must not emit directly into a
Port. All schemas are app-owned and validated at the boundary.

The telemetry command should be fire-and-forget and must not alter the state
machine's transition result. An unavailable telemetry consumer must not block or
replace the primary app update.

## Interaction Model

- **Play/pause** starts and stops replay of a bounded fixture sequence.
- **Step** evaluates exactly one replay event through `machine.step`.
- **Scrub** selects an existing trace point and updates the visual selection;
  it does not silently mutate the live machine state.
- **Node selection** filters or highlights related timeline events.
- **Edge selection** opens the event inspector for the corresponding message and
  guard.
- **Graph/Table/Both** changes the presentation of the same derived model. A
  table projection is optional for the first implementation if it creates
  disproportionate scope.
- **Reduced motion** disables pulse animation but preserves active, visited,
  and selected states.
- **Keyboard navigation** must reach replay controls, graph nodes/edges, and
  inspector content in a predictable order.

The initial SSR output should contain the static graph, current state, and
available trace rows. Motion and live replay attach after hydration and must not
be required for the page to communicate the machine state.

## First Slice

The first implementation slice is intentionally bounded:

- add one Stateflow Observatory reference view using the request-diagnostics
  machine as its fixture;
- derive nodes and edges from `stateTags` and `edges`;
- render the current state, transition outcome, and a short timeline;
- add one typed inbound replay Port and one typed outbound telemetry Port;
- add basic replay controls: step, reset, and a bounded play action;
- add a pure viz helper only where existing primitives do not cover the graph
  layout or transition geometry;
- add app update tests, machine trace tests, and client Port bridge tests;
- add a package-level purity test or equivalent import check for new viz code;
- document the pattern for future filter, brush, and zoom data loads.

The first slice should not require a new general-purpose machine serializer or
an abstraction over every possible FoldKit application.

## Deferred Work and Non-Goals

Defer the following until the first slice proves the reference experience:

- network trace ingestion or multi-client collaboration;
- editing or authoring machines in the browser;
- a generic `Machine` to chart adapter in `foldkit-viz`;
- Mermaid parsing as a runtime data source;
- `foldkit-viz` imports of FoldKit, Effect, or Astro;
- a new Astro lifecycle or server-rendering API;
- persistent trace storage and cross-session replay;
- guaranteed real-time delivery semantics beyond the existing Port contract;
- moving cancellation policy or async work into the viz or Astro packages.

## Accessibility and Visual Constraints

- Provide a text/table projection of graph state and transition history.
- Use semantic labels for current state, transition outcome, and Port activity.
- Make active, failed, and ignored states distinguishable without colour alone.
- Respect reduced-motion preferences and provide a non-animated fallback.
- Keep the visual language aligned with the approved mockup: dark graphite
  surface, restrained cyan/indigo/amber/red accents, compact technical layout,
  no decorative gradients or blobs.
- Use existing HTML/SVG helpers and stable dimensions so labels and controls do
  not shift while replay state changes.

## Verification Contract

Before treating the slice as complete, verify:

- the fixture has no unexpected unreachable states or dead transitions;
- graph node IDs equal the machine's `stateTags` and edge IDs cover every
  machine edge summary exactly once;
- replay is deterministic for a fixed event sequence;
- an ignored event does not change the machine state;
- cancellation and route-exit facts remain visible without issuing a replacement
  request;
- inbound replay values arrive through the typed Port subscription;
- outbound telemetry is emitted by a Command and does not block the update;
- rejected Port values do not enter the app model;
- the pure viz layout is deterministic and has no FoldKit, Effect, or Astro
  dependency;
- focused web tests, package tests, `bun run check`, `bun typecheck`, and
  `bun test` pass;
- visual acceptance is performed separately in a browser at desktop and mobile
  sizes, including a reduced-motion check.

## Risks and Decisions

### Port is a boundary, not internal state

The design deliberately keeps internal event flow in Messages and update. Port
traffic is observable input/output and should not bypass the model.

### Machine remains app-owned

The experimental FSM API is the source of runtime semantics, but exposing it as
a dependency of `foldkit-viz` would couple a reusable visual package to an
experimental runtime. The viz boundary remains plain data.

### Deterministic layout is more important than physical realism

The graph must render consistently during SSR, hydration, snapshots, and replay.
Use a deterministic layout or stable seeded options. A force simulation is an
implementation detail only if it preserves this property.

### Standalone route is the recommended entry point

Use `/stateflow` for the first showcase so the visual can evolve independently
from request-diagnostics while still sharing its machine fixture. A later
release can embed the observatory panel into diagnostics once the boundary is
proven.

### Open review points

- Confirm `/stateflow` as the initial route rather than extending the existing
  request-diagnostics page directly.
- Confirm whether Graph/Table/Both belongs in the first slice or should be
  deferred until the graph and timeline are stable.
- Confirm the first telemetry event name and whether it is intended for an
  external host or only for the local Port rail.
