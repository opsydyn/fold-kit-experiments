# ADR 0106: Initialize v3 editor sessions with full-document history

## Status

Accepted for the approved headless v3 editor slice, 2026-11-15. Follows
[ADR 0105](0105-define-group-endpoints-and-coordinate-compatibility.md).
Architecture, delivery and test-quality reviews are self-review.

## Contract

Core owns a distinct `ZlozGroupEditorStateV3`, initialized only from a validated
v3 document with an explicit host-owned session incarnation. The document is the
single authored value; the session has no legacy `graph` root. Do not add an
`allowGroupPorts` flag to `EditorState`, forge a legacy editor or widen its reducer.
Session objects are trusted immutable runtime state, not a new portable format.
Hosts must allocate a different session ID when reopening/replacing a session.

Apply takes an exact source token (session, revision and complete document) and a
complete proposed document. Validate/own both, check live lifecycle/read-only
state, safe revision capacity and enabled history, then share the existing granular
policy inventory with modelling patches. A whole-document policy covers mode,
capability, viewport, labels, metadata and combined operations. Callbacks see frozen
validated values; exceptions propagate and no editor is published. A veto or stale
source returns the original session, without an Undo frame.

Targets contain every intended change in world coordinates. This low-level
transaction does not infer a group drag, expansion, reparent or deletion plan.
Future controls must compute those plans, including affected descendants/ancestors,
before calling Apply. Changing group/ordinary node kind cannot reuse shared port identities. This
symmetric guard prevents an accepted promotion from having an intrinsically
blocked inverse. Explicitly handle old ports/connections in the complete target;
removing/replacing port identities may be part of the same atomic change so Undo
can reverse the introduction of group semantics. Removing a group/port must leave a valid
complete target and pass all attached-edge deletion/reconnection and port-edit
policies.

Each successful change records one full v3 document, including coordinate space,
connection mode, capability and viewport. Undo/Redo use exact source tokens, rerun
live granular and whole-document policies in the travel direction, and increment
revision monotonically. They never restore an old revision or old permissions.
New Apply clears Redo; no-op preserves history; disabled history blocks Apply.
History is bounded (default 100, maximum 1000). Frames retain their own capability
and mode, even when the current frame disables group ports.

## Compatibility

Legacy constructors, reducer and commits remain fixed at v1/v2. Runtime misuse of
a v3 session in the legacy reducer/commit reports a version-required reason. V3
only handles explicit transactions and source-bound Undo/Redo in this slice.
Native gestures, clipboard, canonical models/editions, layouts, SVG/PNG, Mermaid,
patches, receipts and packets require separately qualified v3 contracts. Expose a
read-only boundary decision with a visible reason; never implicitly project their
input to a bare graph. Existing explicit downgrade planning remains available.
No mounted controls, dependencies, publication or deployment are included.

## Acceptance evidence

Tests must prove detached initialization; old-reader rejection; world-coordinate
movement once; full mode/capability/camera Undo and Redo; bounded/branching history;
no-op/stale/session-mismatch rejection; live lifecycle, port/edge/descendant and
whole-operation vetoes on Apply and travel; invalid targets; unsupported native
boundaries; and installed Node/Bun plus strict NodeNext/Bundler type consumers.
Run root check/typecheck/test and the staged Moon hook before committing.

## Tradeoffs and alternatives

Widening legacy frames loses capability in existing snapshots and lets old
adapters silently reinterpret the graph. A parallel full gesture reducer would
duplicate the interaction engine before its group plans are qualified. A small
headless session and shared policy engine provides the required transaction seam
without either change. It does not close C2 or qualify any adapter implicitly.
