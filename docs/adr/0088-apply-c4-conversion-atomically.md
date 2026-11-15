# ADR 0088: Apply reviewed C4 conversions atomically

## Status

Accepted for the approved package-level Apply slice, 2026-11-14. Builds on
ADRs 0086–0087. Architecture, boundary and test-quality review are self-review.

## Decision

Expose `applyEventStormingC4Conversion(editor, source, options)` in the peer-free
core. Rebuild the complete plan from current host source and conversion choices,
including explicit containment checks, before accepting exact affirmative consent.
Prepared plans and imported records never grant mutation authority. Compare live
revision, complete graph and required camera; reject read-only editors, active
gestures/connections/label drafts/camera fits, host busy reasons and disabled Undo.
Unresolved mappings or membership return a blocked result without a partial graph.
Explicit retention returns the original editor without history or a receipt.

Use one internal projection for plan validation and Apply. Preserve IDs, endpoints,
ports, world geometry, authored data, editions and fork ancestry; change only the
reviewed descriptors, labels and parent/constraint fields. C4 communication uses a
plain named link with the source workshop descriptor retained in provenance.

Run synchronous pure host vetoes against detached frozen source and complete target
values on every attempt. Reuse architecture hooks and add C4-scoped node/edge label
and membership hooks because EditorPolicy has no general label/reparent hook.
Membership checks include explicit runtime containment with unchanged parent IDs.
A whole-transaction veto can inspect the complete plan and document. Blank reasons
still protect. Failure returns the exact original editor and no conversion record.

Only after every gate succeeds, capture a frozen in-memory conversion record and
commit the entire graph once through the editor's existing transaction boundary.
Return editor and record together. One Undo restores the complete source graph;
Redo restores the target. The record retains full source/session/revision, reviewed
choices, affirmative loss acceptance and target document. It is independent of graph
Undo and must be retained by the host alongside the returned editor in one update.
No await or second event should intervene between receiving and publishing them.

## Boundaries and alternatives

Core owns graph validation, exact-plan review and atomic graph history. The host
supplies authentic current document/session and current external busy conditions;
core cannot authenticate host identity, prove human review, persist records, or
roll back external storage. Pure callbacks must not mutate host state. Callback
exceptions propagate before publication. Malformed inputs retain existing throwing
validation contracts; expected live denials are structured results.

Do not introduce a generic conversion engine or add runtime dependencies. Share
only the internal C4 projection to prevent validation/publication drift. The record
is unsigned local data; this slice adds no portable codec, import authority, UI Apply,
wire-version change, release or deployment. A portable decoder and workbench
receipt download/reopening need their own qualification.

## Acceptance and recovery

Exercise actual public Apply: semantic/label/link/membership changes, retained
geometry/data/editions, atomic rejection at every hook, immutable provenance,
source/session/camera/choice freshness, consent withdrawal, containment role
compatibility, unchanged-parent declarations, live lifecycle protection, no-ops and
one Undo/Redo. Qualify installed tarball consumers and run full repository checks
and API documentation. Recovery is one graph Undo; source remains in the returned
record. Reverting code needs no data migration. Workbench integration follows.
