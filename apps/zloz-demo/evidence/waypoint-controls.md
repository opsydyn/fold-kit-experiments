# Composable waypoint controls — local qualification, 2026-11-12

Source base: `e5218b8`, isolated `codex/zloz-context-map` worktree. Implementation
and evidence are retained in the commit containing this receipt. Decision:
[ADR 0050](../../../docs/adr/0050-compose-waypoint-interaction-controls.md).

- **result:** complete
- **claim:** E1 pointer/keyboard controls are implemented at package level, with
  transient previews, live protection, atomic Undo and composable native helpers;
  the workbench demonstrates Off/Native/Custom in light/dark/minimal presentation.
- **evidence:** host-captured root check/typecheck/tests, packed Node/Bun consumers,
  TypeDoc, production build and Chromium checks exited 0. Core: 426 passing tests;
  workbench: 103. Browser checks reported no page errors; screenshots below.
- **remaining uncertainty:** no new performance benchmark or comprehensive touch,
  cross-browser, device or screen-reader acceptance. Existing warnings/skips remain.
  Nothing published/deployed; Alchemy and the later core qualification gates remain deferred/open.
- **next:** needs review; proceed to E2's headless palette/external-placement
  contract before composing native/custom palette UI.

## Public package and ownership

Core owns `resolveEdgeWaypointPreview`, `resolveEdgeWaypointControls`, the public
control contexts/actions and revision-bearing gesture, nudge and removal facts.
The graph, cached routes and history stay unchanged during pointer movement.
Release rechecks current policy/source and delegates to `EdgeWaypointsChanged`;
Escape/capture loss discards the preview. Modifier-only Alt changes recompute the
last sample. A stale revision, readonly state, hidden/collapsed connection or late
policy veto cannot publish. Keyboard arrow actions and removal each use the
ordinary atomic Undo transaction; existing redo survives cancelled previews.

The optional Foldkit adapter exports `zlozEdgeWaypoints`,
`zlozEdgeWaypointHandle`, `zlozEdgeWaypointAction` and `zlozEdgeWaypointReadout`.
`edgeWaypoints` opts in to selected-edge controls; `renderEdgeWaypoints` composes
custom artwork, returns null to hide, or undefined for the default. Reasons remain
available independently of diagnostics. Existing measurement/instruction flags and
minimal mode govern optional feedback. Default controls use light/dark tokens;
actions dock within measured canvas bounds, and their scroll region retains normal
native interaction. Handle centers stay anchored when readouts disappear. The
configurable `waypointLabelOffset` clears colliding labels without changing the
shared geometry anchor. Collapsed projections suppress stored handles.

The workbench composes these APIs through its existing model/epoch-scoped message
adapter. Off/Native/Custom and independent bend protection are host preferences;
they do not change graph data. Custom artwork lives in
[waypoint-presentation.ts](../src/editor/waypoint-presentation.ts), not in the core.
The raised-edge example yields to authored bends. No dependency or separate saved
graph is introduced; v1 portable geometry from ADR 0049 remains unchanged.

## Verification and provenance

Commands were run sequentially where builds clean shared package output:

```sh
bun run check
bun typecheck
bun run test
bun run --filter @opsydyn/foldkit-zloz docs
bun run --filter @opsydyn/zloz-demo build
node apps/zloz-demo/evidence/waypoint-controls-browser.mjs
```

Root lint/format and workspace checks exited 0, with existing warnings and skipped
tests retained. Isolated package install fixtures used permitted Bun/npm cache
access. TypeDoc generated the new core resolver/context and Foldkit helper pages.
The packed consumer compiles under Bundler/NodeNext and runs pure preview,
controls and one-Undo drag behaviour under Node and Bun without UI peers.

[Interaction tests](../../../packages/foldkit-zloz/test/waypoint-interaction.test.ts)
cover transient data, zoom, grid/bypass, foreign pointers, no-op/cancel, live
policy/source rejection, fresh measurement retention, redo preservation, keyboard
nudge/removal, deterministic IDs and collapsed projections.
[View tests](../../../packages/foldkit-zloz/test/waypoint-controls-view.test.ts)
cover metadata, reasons, native/custom/null/off rendering, diagnostic suppression
and configurable label clearance. The native input suite checks emitted keyboard
facts, modifiers, focus, disabled/readonly handling and cleanup. The
[workbench test](../test/waypoint-controls.test.ts) checks package policy/Undo and
preference composition. Initial gesture tests were red for the unsupported event;
final assertions use actual package state, codecs and input/render boundaries.

The [browser script](waypoint-controls-browser.mjs) serves the built static app
locally and uses Chromium **151.0.7922.34**, **1600 × 1100**, reduced motion. It
checks real selection/Add, keyboard movement, pointer drag, Alt feedback, one Undo,
Escape, visible protection, custom artwork and Off preserving exported geometry.
Independent screen checks verify handle/waypoint alignment and panel containment.
Minimal mode suppresses readouts while retaining handles. The script restores
optional diagram tools after minimal-mode checks to download the final JSON.
It reported `pageErrors: []`; this is local production-bundle evidence, not hosted
or comprehensive assistive-technology acceptance.

## Visual evidence

- [Native controls](waypoint-controls-native.png)
- [Custom controls — light](waypoint-controls-light.png)
- [Custom controls — dark](waypoint-controls-dark.png)
- [Custom controls — minimal diagnostics](waypoint-controls-minimal.png)

Architecture, delivery and test reviews are self-review. Boundary verdict:
**safe with noted risk**; the remaining risk is qualification breadth, not a claim
of full React Flow parity. Comprehensive core completion still follows Q1–Q4.

Recommendation: **needs review**, then continue with E2 placement primitives.
