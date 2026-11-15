# ADR 0045: Apply DDD conversion atomically with portable provenance

## Status

Accepted for the approved package transaction slice, 2026-11-11.
Boundary review: **safe with noted risk**. The host supplies live model/session
identity and external busy conditions. Policies are pure synchronous vetoes.
Receipts are unsigned data, never authorization to edit.

## Decision

Expose `applyEventStormingDddConversion` in the dependency-free root. Accept live
EditorState, authoritative current model document/session/revision and mapping,
explicit consent, policy and optional host busy reason. Rebuild the package plan
and consent decision on every call; do not accept cached plans or imported receipts
as Apply authority. Require source revision plus exact graph and camera to match
the live editor. Source documents without a camera must be recaptured/reviewed
with the live camera. Host metadata and session identity must be current; the core
cannot verify state held outside its supplied inputs.

Reject read-only, active gestures, pending connections, edge-label drafts, camera
fits and host-only busy conditions. Unresolved plans block wholly. No-op plans
return the same editor without a receipt or Undo requirement. Real changes require
Undo enabled and affirmative exact-plan loss consent.

Stage a complete validated target document by replacing only proposed architecture
descriptors at existing node/edge IDs. Preserve labels, appearance, geometry, ports,
parentage, wiring, host data, camera, model identity/name, editions and fork ancestry.
Run a whole-transaction policy against the plan and final document, then granular
node/edge architecture vetoes for every change. Existing EditorPolicy hooks keep
their current-graph contract; all callback values are detached frozen copies.
The bulk hook provides final-state inspection for atomic semantic checks. Strict
source-oriented semantic policies can conservatively veto a conversion; do not
bypass host vetoes or simulate a sequence of partial edits to force permission.

Only after every validation/veto succeeds, construct provenance and call the shared
`commitGraph` boundary once. Return editor plus receipt together. A late veto or
throw publishes nothing and preserves the original editor, graph, Undo and redo.
Successful graph conversion is one Undo step; redo returns the converted graph.
Selection/camera remain, redo branch clears and cached routes invalidate normally.
Host publishes the returned editor/receipt synchronously as one model update.

## Provenance retention and format

Return an immutable `ZlozEventStormingDddConversion` receipt containing the complete
source document/session/revision, effective mappings, affirmative loss-acceptance
claim and complete target document. Source provenance stays separate from model
`origin` (edition-fork ancestry). No clocks, actors or receipt IDs are invented.

Add independent `foldkit-zloz-ddd-conversion` v1 serialization/parsing. Reuse existing
model v1 codecs and plan validation; strict parsing rejects unknown fields/versions,
malformed/unacknowledged/unresolved receipts and targets containing edits beyond the
reviewed descriptor replacements. Reconstruct the target independently from source
and mappings before accepting a receipt. This is structural/semantic consistency,
not proof of execution, human acceptance or authenticity. Parsing never applies.

Graph/snapshot/edition/model v1 codecs and existing documents are unchanged. Persist
or export the whole receipt when conversion provenance is required; saving only the
target model omits conversion receipts. Physical persistence belongs to a host
Command/adapter, outside this synchronous headless transaction. Undo changes graph
state, not the immutable audit receipt. Hosts retain each receipt as historical data.

## Simplicity and alternatives

Reuse plan, consent, model capture and one graph commit. Reject descriptor-only
breadcrumbs, encoding metadata into labels/data, and rewriting fork ancestry.
Adding conversion history to model v1 would change every model consumer; a separate
additive receipt carries full before/after provenance without that coupling.
Costs are receipt size, full source/target validation and conservative policy/key
invalidation. No large-model performance, cryptographic trust or external storage
atomicity claim is made. No workbench Apply button, CLI command, deployment or npm
publication is introduced.

## Verification and review

Test first: multi-node/edge single Undo/redo, full retained source, stable identities
and nonsemantic fields, late veto rollback, complete-target/current-graph policy
contracts, lifecycle/Undo/freshness/consent guards, unresolved/no-op/replay behavior,
portable before/after model round trips, literal bad wire versions/shape, forged
extra edits and throwing policies. Real packed Node/Bun and Bundler/NodeNext consumers
exercise the root API and receipt. Run root check/typecheck/tests and API docs.
Architecture, delivery and test-quality review are self-review. Recovery is graph
Undo plus original model reconstruction from the receipt; old user data is not migrated.

Next bounded slice: expose guarded Apply and portable receipt retention/download in
the workbench, publishing the editor and receipt in one Foldkit update.
