# ADR 0107: Plan v3 group-port edits through live transactions

## Status

Accepted for the approved headless group-port editing slice, 2026-11-15. Builds on
[ADR 0106](0106-initialize-v3-editor-sessions-with-document-history.md).
Architecture, delivery and test-quality reviews are self-review.

## Contract and boundaries

Core owns `planGroupPortEditV3` and `applyGroupPortEditV3`. Requests carry an exact
v3 source token and one add, label, position or remove edit. Only an eligible
existing group in an explicitly enabled v3 document is editable here. Add appends
an explicitly identified port; label `null` removes the optional label; position
uses the existing exclusive offset/anchor geometry contract. There is no inferred
snapping, port identity/kind change, capability enablement or connection creation.
Lanes and hotspots stay portless. Ordinary-node edits keep their existing APIs.

A removal's complete target removes the port and every edge attached to that
exact endpoint, preserving unrelated connections and descendants. Preview exposes
the complete incident-edge list. There is no new consent protocol for ordinary
editing; hosts own their confirmation presentation. Every removed edge and edited
port remains subject to the current kernel policies.

The planner validates/owns edit data, checks exact live source and lifecycle, and
builds a complete v3 target without publishing a session or history frame. Reuse
an internal nonpublishing review of the existing transaction kernel; do not create
throwaway editors/history frames to compute a preview or duplicate its policies.
Preview reports `ready`, `unchanged` or `blocked` with a visible reason/code.
Policy callbacks see frozen validated data; unexpected callback defects propagate.

Apply accepts an edit request, not a cached plan/target. Rebuild the edit against
the exact live source and run the same atomic v3 transaction publication, with one
policy pass for the proposed change. A stale preview or old policy result grants
no permission. Successful port-plus-edge deletion is one Undo unit. Undo/Redo keep
the full capability/mode/camera document and recheck current policies, as defined
by ADR 0106. Rejection/no-op leaves editor/revision/history unchanged.

Requests/plans are runtime contracts, not portable model/receipt formats. Bound
edit ownership separately from the source document so each full document retains
its existing budget. Preserve the peer-free core entry. No dependencies, UI,
legacy reducer widening, archive/adapter adoption, publication or deployment.

## Alternatives and consequences

An app-only planner would duplicate package policy and deletion behavior. Calling
Apply to preview would allocate a prospective session/history and obscure the
publication boundary. A second policy engine would let preview diverge from
commit. The internal shared review seam keeps one authority path; the cost is a
small refactor of the existing v3 Apply implementation and explicit request types.
Connection/reconnection and complete group gesture planners remain later slices.

## Acceptance

Tests exercise all four edits, exact anchor geometry and exclusive field removal,
visible granular/whole-operation vetoes, all attached-edge deletion, independent
Undo/Redo, strict/loose preservation, no-op/branching history, stale source and
lifecycle rejection, disabled/ineligible groups, malformed edit/accessor data,
preview ownership and rechecked Apply. Qualify the installed Node/Bun API and
strict NodeNext/Bundler types; run repository check/typecheck/test, TypeDoc and the
explicit staged Moon check before committing. No browser evidence is claimed.
