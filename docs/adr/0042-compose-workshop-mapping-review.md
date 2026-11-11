# ADR 0042: Compose a workbench mapping review before conversion

## Status

Accepted for the approved local workbench slice, 2026-11-11.
Boundary review: **safe with noted risk**. Temporary choices are review preferences,
not authorization to transform or overwrite a source model.

## Decision

Add a Mapping review section to the existing left sidebar. Compose the public
headless `previewEventStormingDddMapping` API; the app owns only temporary per-ID
choices, the inspected item and feedback. Native selectors expose convention,
explicit DDD roles and explicit retention. Inspect one node or incident relationship
at a time while the source canvas remains visible. Render package ambiguity,
compatibility and prospective-loss reasons rather than implementing domain rules
in the app. Existing DDD relationships can be inspected but not remapped.

Derive preview values from the displayed graph and choices on demand. Scope the
review draft and callback messages to model ID, session epoch, editor revision and
exact graph serialization. Reject stale model/source callbacks and hidden-panel
input. Reconcile drafts after source changes, including Undo; reopening an example
advances the model session epoch even when graph values happen to match. Inspection
is available in history, but choices/reset are disabled with a reason in history
or during active edits/import/layout. Preview choices never alter graph, Undo,
lineage or editions and are not included in exported model documents.

Functional reasons and loss disclosures stay visible with minimal mode or global
diagnostics disabled; optional numeric summary badges respect those settings.
Native fields, visible disabled reasons and feedback use the existing family theme.
No editable converted graph, conversion button, loss consent or apply transaction
is introduced. A future converter must independently revalidate source identity,
freshness, host policy, lifecycle, consent and provenance in one Undo transaction.

## Simplicity and alternatives

Reuse the package preview and ordinary Foldkit Model/Message/update loop. Keep a
single scoped transient draft; no renderer-owned state or external mutable store.
A single-item inspector avoids expanding all workshop cards into a long form.
Rejected: app-owned inference, automatic conversion, cached transformed graphs,
or mixing preview preferences into authoritative model JSON. Costs are a full graph
key for exact local freshness and recomputation while this section is open. No
performance qualification is claimed for very large workshop graphs.

## Verification and next work

Controller tests cover explicit/retained/default choices, blocked relationships,
source/model/revision/session replay, reopening identical examples, lifecycle,
history inspection and unchanged graph/history/editions. SSR and production-browser
checks cover native fields, reasons and diagnostics independence. Capture and inspect
light/dark evidence alongside the unchanged canvas; compare exported graphs.
Run root check/typecheck/tests. Architecture, delivery and test-quality review are
self-review. No public package, persistence codec or dependency changes.

Next bounded slice: define a headless conversion plan contract with source
provenance and explicit loss consent before adding an apply transaction.
Rollback is source reversion; no stored model data is migrated.
