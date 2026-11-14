# ADR 0094: Adopt loose mode in native and composable port interactions

## Status

Accepted for the approved interaction/workbench slice, 2026-11-14. Follows
[ADR 0093](0093-adopt-connection-mode-in-headless-editor.md). Architecture,
delivery and test-quality review are self-review.

## Decision and ownership

The editor's fixed session mode remains authoritative. `zlozView` exposes it as
`data-flow-connection-mode` on its surface. The native adapter uses this value to
collect pointer/touch drag starts, exact hits, nearby targets and tap-release
intents. Loose mode admits existing ports of both authored kinds; strict/omitted
mode retains its output-source/input-target candidate filters. Reconnection uses
the moving end in strict mode and both kinds in loose mode. Nested surfaces remain
excluded. DOM candidate collection grants no edit permission: the reducer still
checks its own mode, current graph, policies and history boundary at commit.

Native `zlozPort` labels describe activation intent. In loose mode, ports offer
source activation before staging and target activation afterward. Authored
input/output kinds, labels, geometry and semantic meaning are retained. Custom
port renderers receive `connectionEnd` and can compose the same native primitive;
`active`, accepted-target and protection contexts remain live. This field describes
activation, not a semantic direction inferred from port kind. The connection
preview continues to report the actual moving end during reconnection. The browser
message schema also retains optional explicit source/target chooser intent.

Retained node layers include mode in their dependency tuple. A distinct view ID
keys a distinct canvas/input Mount, releasing the old binding and creating a new
message mapping. Hosts should use distinct IDs for independent sessions; changing
an ID remounts native input rather than inheriting closures scoped to an old session.
The existing resource boundary continues to own listeners, observers and capture.

Wire pointer release already publishes the activation or commit intent. Consume
its ensuing pointer-generated click once, while preserving keyboard/programmatic
clicks with detail zero and clearing consumption at the next pointer press. This
prevents touch taps from staging and immediately connecting to themselves, and
drags from accidentally publishing another activation. Two deliberate activations
of the same port can still request a self-connection under existing policies.

## Workbench and alternatives

The `/connections/` workbench demonstrates independent strict/loose editor sessions,
Undo/Redo, native/custom controls, light/dark themes, port protection and read-only
state. Each session retains its own graph/history; switching sessions changes the
active session, not its document mode. Events carry the owning session, and active
drags prevent session/design switches. Controls occupy the left sidebar and the
canvas stays visible. The architecture workbench and this route share one shell,
brand and styles. Functional connection lists stay visible with individual
diagnostics disabled, using the existing public options.

Putting loose mode directly into the architecture workbench was rejected because
its model/edition/export paths still use strict formats. Duplicating the native
input adapter in Astro would hide package gaps from users. A dedicated session
workbench consumes package interactions while preserving explicit portable limits.
Boundary verdict: **safe with noted risk**. Native input and rendering are package
adapters; state/policy/history remain in core, and demo preferences own no graph
validation or alternative connection engine.

## Qualification and limits

See [interaction qualification](../../packages/foldkit-zloz/evidence/connection-interactions.md)
and [recorded browser checks](../../apps/zloz-demo/evidence/connection-workbench-browser.json).
Local Chromium keyboard, mouse and emulated touch evidence is distinct from human
screen-reader, real-device and cross-browser acceptance. Straight/default geometry
retains its existing routing behavior; side-aware obstacle routing is not added.
No v2 model/edition/archive, patch/receipt, layout or Mermaid/CLI adoption, mode
change event, npm publishing or deployment occurs. C1 and broader C/Q/R gates
remain partial.

Next: define the canonical model/edition mode-preservation contract and literal
old-reader compatibility cases before moving loose sessions into those workflows.
