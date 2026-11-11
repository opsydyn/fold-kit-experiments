# ADR 0046: Publish workbench Apply and receipts together

## Status

Accepted for the approved workbench slice, 2026-11-11.
Boundary review: **safe with noted risk**. Package Apply owns the transaction and
portable receipt. The workbench owns tab retention and explicit downloads; no
storage durability or imported receipt authority is implied.

## Decision

Add guarded Apply to Conversion plan review. The handler checks current model,
epoch, revision, graph key, exact plan key, consent generation and visible panel,
then recomputes the package transaction with current source, consent, lifecycle
and policy. Prospective pure results used for button enablement are discarded;
they are not cached execution grants. A live protection toggle demonstrates veto.
Blocked/stale input never changes the editor or appends a receipt.

On success, publish the returned editor plus immutable receipt in one Foldkit
Model update. Assign a stable tab-owned receipt identity/sequence, clear temporary
review/acknowledgement and keep a clear completion notice. The receipt registry is
outside graph Undo and model documents, filtered by source model ID. It survives
Undo/Redo, source edits and model switches and remains a historical fact, not a
claim that its target is the currently displayed graph. Multiple accepted applies
append distinct records. No receipt is deleted automatically.

Receipt downloads resolve the current model/epoch/receipt identity and serialize
through the package codec before issuing a Command. Browser Blob/link effects stay
inside the Command. Success/failure responses are scope checked; failure leaves
provenance in the tab for retry. Native receipt disclosures/download buttons remain
usable with minimal diagnostics and in history. Explain that closing the tab loses
undownloaded receipts and model-only JSON omits the collection. No automatic
persistence, receipt import, replay or external writes are introduced.

## Atomic policy composition

Ordinary editor policies keep their current-graph semantics. Factor existing base
editing protections into one shared app function. Conversion uses those unchanged
granular protections plus a whole-transaction semantic guard over the complete
final affected graph. When enabled, reuse the package EventStorming/DDD resolvers
and current convention options; do not infer new domain rules in the UI. This avoids
rejecting a legitimate simultaneous node/edge family change against a partial graph,
while still vetoing genuinely incompatible retained causal links. The whole guard
never overrides a base editing veto. Ordinary single-item editor policy behavior
is preserved.

## Simplicity and consequences

Reuse existing package Apply/receipt APIs, Model/Message/update and export Command
patterns. Store only immutable package receipts and local identity/sequence; no
second conversion engine, DOM state, receipt schema, model-origin rewrite or
persistence service. The registry is unbounded for this tab and preflight validation
recomputes full source/target data while consented; no large-model memory or latency
claim is made. Native disclosures keep the sidebar manageable and canvas visible.

## Verification and next work

Test first: atomic editor/receipt publication, one Undo/Redo with retained provenance,
stale/repeated/busy/history/hidden requests, live vetoes and complete-final-state
semantic enforcement, receipt scoping across model switches, duplicate applies,
download Command/failure behavior and native minimal-mode controls. Production browser
checks fork ancestry, source/target receipt equality, actual downloads, Undo/Redo,
model switches, live guards and inspected light/dark captures. Run root check,
typecheck and tests. Reviews are self-review; browser evidence is local, not a full
assistive-tech or hosted qualification.

Next bounded slice: reopen receipts for read-only before/after comparison. Parsing
must not apply or authorize any edit. Recovery here is graph Undo plus portable
original-model reconstruction from a downloaded receipt.
