# ADR 0100: Navigate v2 changes with explicit mode inspection

## Status

Accepted for the approved package navigation slice, 2026-11-15. Follows
[ADR 0099](0099-present-v2-comparisons-with-mode-feedback-and-ghosts.md).
Architecture, delivery and test-quality reviews are self-review.

## Decision

Expose `resolveHistoryChangeNavigatorV2`, `resolveHistoryChangeFocusV2` and
`resolveHistoryChangeStepV2` over validated `compareEditionsV2` results. The host
owns the chosen baseline/selected side, filter preferences and scoped cursor.
Resolve all three against that current side; never infer a side from change kind.

Represent mode as a distinct discriminated entity with no authored graph ID.
Changed mode contributes one `changed` filter entry before stable-ID node/edge
entries. Unchanged mode contributes no change entry. Mode rows carry the actual
before/after transition, semantic true and layout false. Node IDs such as `mode`
cannot collide with mode identity. Requests/cursors include both edition IDs plus
the entity identity, never an ordinal, cached camera or captured chosen side.

Mode focus returns a `mode` target containing side, checkpoint ID and its actual
connection mode, with no editor event or geometry. Graph focus returns a `graph`
target containing that same scope and a native node/edge reveal event. Apply only
the latter to the corresponding read-only checkpoint review. Reveal preserves
selection; it can change camera, reveal ancestors and report a notice, without
editing authored graph data or adding Undo. Neither target changes editor mode.

Re-resolve filters, comparison scope, membership on the chosen side, global and
per-entry host reasons every time. An added/removed item absent from that side
stays visible with a nonempty reason; focus blocks rather than switching sides.
Normalize blank veto strings to a readable reason. Callback failures propagate
without returning a camera request. Read-only comparison pins remain unchanged.

Previous/Next use the same focus path. Next with no cursor starts at the first
visible entry; Previous needs a current entry. Do not wrap or skip an unavailable
candidate. Stale scopes and filtered/missing cursors are ignored. Update the host
cursor only on a ready decision; retain the chosen side across steps and mode
inspection. Edition IDs scope requests, not cryptographic snapshot identity:
hosts own immutable checkpoint identity and review binding. These functions accept
typed comparator projections, not arbitrary wire data or authorization proofs.

Add optional native/custom `zlozHistoryChangeNavigatorV2` and
`zlozHistoryChangeButtonV2` to the FoldKit entry. Reuse the native filter primitive;
versioned entry/request types keep mode out of v1 graph-only callbacks. Expose
replaceable/omittable filter, entry, status, reason and layout parts. Native buttons
retain keyboard semantics, disable unavailable entries and expose visible reasons;
status is polite. Custom entries own list semantics and accessible meaning.
Hosts can hide status counts or filters through parts without changing policy.

## Alternatives and boundary review

Boundary verdict: **safe with noted risk**. Core owns pure navigation decisions;
the FoldKit adapter owns HTML and emits requests for the host to re-resolve.
Reuse v2 comparison, existing filter value types, reveal events and read-only
review reducers. Avoid a second editor or shared mutable cursor. A fake mode
node would distort graph identity and camera behavior. Reusing v1's automatic
side choice would violate the host's selected comparison side. Widening v1
callbacks would break graph-only assumptions, so its behavior remains unchanged.

A ready target is a local review projection, not permission to restore or Apply.
No timer, policy cache, serialization, dependency/version change, publication or
deployment is introduced. Static rendering does not qualify mounted workbench
interaction. V2 append/merge, restore/playback, CLI/workbench and wider C/Q/R gates
remain open; C1 stays partial.

## Evidence and next

[Qualification](../../packages/foldkit-zloz/evidence/history-navigation-v2.md)
records graph/mode namespace tests, side/membership/policy/step checks, independent
read-only reviews, loose-only and reversed comparison fixtures, installed
consumers, a targeted side mutation and inspected light/dark static evidence.

Next: v2 edition append with mode retention and explicit identity-conflict handling
before restore/playback adoption.
