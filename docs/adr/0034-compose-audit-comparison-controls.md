# ADR 0034: Compose audit comparison controls and navigation

## Status

Accepted for the approved package controls and workbench slice, 2026-11-09.
Boundary review: **safe with noted risk**. Finding identity remains edge ID/code
under one convention; revealing a finding does not repair or restore content.

## Decision

Build on ADR 0033 with a pure `resolveAuditComparisonControls` context and
`resolveAuditComparisonRequest` resolver. The host owns baseline/target IDs and
introduced/resolved/persisting filters. A null baseline means no comparison;
a null target explicitly means the current graph, independently of the displayed
camera. Named choices use owned edition IDs, preserve unavailable values visibly,
and never follow indexes, lineage or a camera change. Full comparison data remains
available when categories are filtered. Same-edition comparisons remain valid.

Finding requests carry model ID, baseline/target IDs, category, edge ID and code.
The resolver recomputes the current comparison and rechecks scope, membership,
filter visibility and host protection before returning an ordinary
`EdgeRevealRequested` event with its source reference. Resolved findings target
the baseline; introduced/persisting findings target the selected edition or
current graph. Persisting entries retain the prior finding for custom views.
The host supplies epoch checks when references must expire across navigation,
model replacement or asynchronous operations. No graph changes or Undo entries
are produced. Reason callbacks can protect individual findings; a global busy
reason disables selection/focus. Filters remain live independently.

The optional Foldkit entry supplies unstyled native selectors, checkboxes,
finding buttons, status/reason helpers and their composition. All principal parts
and layout are replaceable; undefined retains defaults and null omits a part.
Host attributes, content, labels, ordered filter subsets and count visibility
are supported. Native disabled/description/selected semantics stay model-derived.
The headless entry gains no Effect/Foldkit/runtime dependency or external state.

The workbench consumes these public APIs in its existing left sidebar. It owns
camera application, a model/epoch guard and explicit playback pause on navigation
or selector changes; filters retain playback. Historical navigation opens a
read-only source edition. Same-source reveals retain the epoch so rapid adjacent
control activations remain valid; source switches invalidate old canvas inputs.
Current navigation uses the working editor's existing
camera-only reveal path. Working graph, selection and Undo are preserved. New
model activation clears comparison IDs so they cannot cross model boundaries.
The synthetic example adds immutable editions atomically without replacing the
working graph. Minimal mode/global diagnostics hide counts and summary without
disabling controls or discarding preferences. The comparison context is computed
only while the history sidebar section is active.

## Alternatives and consequences

Reusing the displayed history edition as the audit target would change the
comparison when a resolved finding opens its baseline. Keeping independent IDs
avoids that coupling. Reimplementing the grammar in UI would duplicate audit
policy; cached request geometry could reveal stale content. Camera-only events
reuse existing navigation and avoid changing selection. Showing earlier content
in a source review makes removed edges directly inspectable without requiring
ghost visibility. Existing ghost preferences are unchanged.

No persisted schema changes, CLI changes, new dependency, publishing or deployment.
Core custom `roleOf` callbacks remain host-owned and must be deterministic.
No rendering-cache or performance claim is made for these controls. Revert code
to roll back; there are no document migrations.

## Implementation and verification

- Core: `audit-comparison-controls.ts`, public exports and request/context tests.
- Foldkit: `audit-comparison-controls-view.ts`, optional exports, native rendering,
  nullable/custom slot tests and real packed-consumer qualification.
- Workbench: `audit-comparison.ts`, model/messages/update/view integration and
  tests for source routing, stale requests, graph/Undo preservation and playback.
- Capture light/dark browser evidence for actual source reveal, filters, keyboard
  activation, diagnostics/minimal mode and intact working documents/Undo.
- Run root check, typecheck and workspace tests, build API docs and the workbench.
  Architecture, delivery and test-quality reviews are self-review.
