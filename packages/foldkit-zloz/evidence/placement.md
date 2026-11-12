# Headless palette and external placement — local qualification, 2026-11-12

Source base: `bdb9e41`, isolated branch `codex/zloz-context-map`; implementation
is in the commit containing this receipt. Decision:
[ADR 0051](../../../docs/adr/0051-plan-and-apply-headless-placement.md).

- **result:** complete
- **claim:** core owns normalized palette/external placement sessions, coordinate
  resolution, snapping, detached preview, live policy checks and atomic Apply with
  one Undo. This completes the approved headless portion of E2.
- **evidence:** root lint/format, workspace typecheck, full workspace tests and
  TypeDoc exited 0. Core: 438 passing tests, including 12 placement regressions.
  Actual packed Node/Bun consumers compile and execute the exported contract.
- **remaining uncertainty:** native/custom palette controls, measured browser
  adapters, device/keyboard/AT and visual acceptance remain open E2 work. No new
  performance, hosted or registry qualification is claimed. Existing warnings and
  skipped tests remain; nothing was published or deployed. Alchemy stays deferred.
- **next:** needs review; then compose package-owned native/custom palette and
  placement controls with workbench light/dark/minimal evidence.

## Contract and ownership

`createPlacement`, `updatePlacement`, `resolvePlacement` and `applyPlacement`
operate on a separate immutable child state. Source data is captured, detached and
frozen at Start. Scope identifies an editor/controller incarnation; generation
invalidates cancelled/restarted/committed callbacks. A separate target revision
pins the reviewed destination so old Apply requests cannot use newer coordinates.
Hosts must publish returned editor and idle placement together in one Model update.

Targets explicitly declare world, canvas-local screen CSS pixels or client CSS
pixels. The host supplies current canvas origin and measured editor surface for
client/screen placement. Relevant viewport, origin, surface, snapping preferences
and visible-anchor presentation are captured with each target fact. Changes
require a fresh target where applicable. World targets support unmeasured/offscreen
programmatic placement; additional DOM transforms are an adapter responsibility.

Grid inheritance/override, opt-in node-frame centre/corner anchors, CSS-pixel
magnetic distance, stable code-unit ties and explicit bypass resolve the source
grip once. The whole fragment, including groups and authored waypoints, receives
one translation. Explicit parent intent attaches only roots; containment rejects
the whole fragment unless unconstrained membership is requested. Existing parents
are never resized.

Preview is detached and non-publishing. Apply rebuilds against current context
and policies rather than accepting a caller-modified proposal. Read-only, busy,
Undo-disabled, stale source/target and live parent/placement/pattern/connection/port
vetoes leave editor, graph, history and redo unchanged. Selection policy controls
selection independently. Successful Apply uses the shared insertion preparation
and one `commitGraph`; cancel/preview create no history entry. Canonical graph,
snapshot and model v1 formats remain unchanged; ephemeral placement sessions have
no wire format. Source metadata does not grant permission or alter graph data.

## Verification

Sequential commands in the isolated worktree:

```sh
bun test packages/foldkit-zloz/test/placement.test.ts packages/foldkit-zloz/test/patterns.test.ts
bun run check
bun typecheck
bun run test
bun run --filter @opsydyn/foldkit-zloz docs
```

The focused regression initially failed because the public placement API did not
exist. The final focused run passed 17 tests with 178 assertions, including the
five existing pattern-insertion regressions. Tests cover synthetic nested/scrolled
origins and zoom, coordinate equivalence, snapping/bypass/ties, stale callbacks,
source and preview mutation, live policy vetoes, cancellation, group containment,
waypoint translation, unchanged v1 serialization, one Undo and preserved redo.
Synthetic transforms do not prove actual browser/device placement.

The full suite's tarball test installs without workspace links or optional
Foldkit/Effect peers, compiles positive and negative contracts under Bundler and
NodeNext with exact optional properties, then runs placement/preview/Apply under
Node and Bun. TypeDoc generates the public placement functions and types. The
workspace tests and typecheck use existing caches/loopback access; no dependencies
were added. Logs were captured locally under `/private/tmp/zloz-placement-*`.

Architecture/boundary, delivery and test reviews are self-review. Boundaries are
**safe with noted risk**: core owns data and transaction semantics while hosts own
measurements/IO and eventual interaction. Public preview copies have unqualified
large-graph cost; no performance improvement is claimed. Recommendation:
**needs review**, then the bounded E2 interaction slice.
