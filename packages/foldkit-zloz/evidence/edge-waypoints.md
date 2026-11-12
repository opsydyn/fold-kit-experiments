# Authored edge waypoints — local qualification, 2026-11-12

Source base: `c7b2112`, isolated branch `codex/zloz-context-map`; implementation is
in the commit containing this receipt. Decision: [ADR 0049](../../../docs/adr/0049-author-portable-edge-waypoints.md).

- **result:** complete
- **claim:** the headless E1 contract is implemented at package level: named portable
  bends, guarded atomic edits, shared geometry and one Undo. Interactive controls
  and their visual acceptance remain a follow-up slice.
- **evidence:** host-captured root check, typecheck, full workspace tests and TypeDoc
  exited 0. Core: 415 passing tests, including 12 focused waypoint regressions.
  Real packed Node/Bun consumers exercise the new public types and transaction.
- **remaining uncertainty:** no new browser/manual AT, performance, hosted or registry
  qualification. Existing warnings/skips remain. Older renderers do not display
  the additive geometry. Nothing was published or deployed; Alchemy stays deferred.
- **next:** needs review; then compose pointer/keyboard waypoint controls and native
  and custom workbench examples in light/dark/minimal mode.

## Contract and ownership

Core exports `ZlozEdgeWaypoint`, `ZlozEdgeWaypointEdit`,
`ZlozEdgeWaypointEditDecision` and `resolveEdgeWaypointEdit`. The ordinary reducer
accepts the revision-bearing fact `EdgeWaypointsChanged`; host policy is supplied
on each call through `canChangeEdgeWaypoints`. Neither preview nor saved JSON
carries edit permission. A fresh resolver decision is informational; Apply always
rechecks live state and policy through `updateEditor`.

IDs are edge-local, non-blank and unique. Ordered finite world positions are
intermediate bends, not endpoints. Invalid lists reject; null edit requests remove
the field and reveal the automatic fallback. One accepted replacement creates one
history entry. Read-only, active gesture/connection/label draft, stale revision,
zero history, missing/hidden/collapsed connection and policy reasons block without
changing graph/history. No-op edits create no transaction. Cancel means dropping
a host-owned draft; no gesture editor or second authoritative graph is introduced.

Rendering, hit paths and labels share existing geometry resolution; authored bends
precede path style and layout routes, and custom geometry retains final control.
Reconnect preview shares the same polyline logic with its live endpoint. Bounds,
fit/selection/reveal, minimap and culling account for detours. Collapse suppresses
bends only in projected presentation. Layout and endpoint movement retain world
positions; copy/pattern insertion translate them. Edition comparison records
waypoint identity/position as layout, independently of semantic meaning.

Graph/snapshot/model/edition envelopes remain v1. The independent literal
[fixture](../test/fixtures/waypoints-v1.json) is read directly, not manufactured by
an encoder. New readers validate the optional field; older graph codecs retain
unknown edge fields but older renderers ignore their geometry. This is not a claim
of old-renderer visual parity. Mermaid emits explicit waypoint projection loss.

## Verification

Run from the isolated worktree with the workspace dependencies already installed:

```sh
bun test packages/foldkit-zloz/test/edge-waypoints.test.ts
bun run check
bun typecheck
bun run test
bun run --filter @opsydyn/foldkit-zloz docs
```

The first two behavioural regressions were red before implementation: the renderer
ignored the authored detour, and the graph decoder accepted invalid waypoint
lists. They now pass. The focused suite exercises the real public reducer,
resolver, codecs, geometry, insertion, layout and history; culling/overview tests
also exercise package internals used by the Foldkit adapter. Assertions cover
literal paths and label positions, rejection invariants, input detachment, stale
replay, Undo/Redo, translation, collapsed projection and camera bounds.

The root packed-consumer test installs actual tarballs without Foldkit/Effect
peers, compiles positive and negative contracts under Bundler and NodeNext with
exact optional properties, then runs waypoint preview, transaction, JSON and path
resolution under both Node and Bun. The Mermaid suite independently verifies
explicit omission reporting. TypeDoc generates the new resolver and public types.
The full suite retains its existing skipped tests; a pass is not device acceptance.
Tests requiring isolated installs were run with permission to access Bun/npm caches.

## Review and limits

Architecture/boundary, delivery and test reviews are self-review. Boundaries are
**safe with noted risk**: core owns data and atomic edits; optional rendering and
layout adapters consume them. No new dependency or app-owned domain rule exists.
The main compatibility cost is older rendering fidelity. Reusable headless
controls do not yet provide a drag gesture, keyboard handles, snapping/bypass UI
or workbench authoring experience; those remain open E1 completion criteria.

Recommendation: **needs review**, then proceed to the bounded interaction slice.
