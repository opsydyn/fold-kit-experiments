# ADR 0085: Compose C4 mapping review in the workbench

## Status

Accepted for the approved workbench review slice, 2026-11-14. Builds on ADR 0084.
Architecture, boundary, delivery and test-quality reviews are self-review.

## Decision

Add a distinct C4 mapping review section to the existing left sidebar, leaving the
canvas visible and existing DDD conversion controls separate. Astro owns ephemeral
review selection, staged form fields and explicit choices. Core owns interpretation,
ambiguity, provenance and prospective loss findings through
`previewEventStormingC4Mapping`; the host does not implement a second mapper.

Use native labelled controls for node role, structural name, unspecified/internal/
external scope, optional container/component technology and communication label.
Do not infer scope or communication. Draft changes revoke the affected prior
choice; only an explicit Preview records a replacement. Blank names prevent
preview. Leaving an item discards its unpreviewed draft, explained in the panel.
Retain, Clear and Reset are explicit reversible review actions; they do not touch
model data or Undo. Kind-incompatible group role options are disabled and explained.

Requests carry model identity, epoch, source graph/revision and edition identity.
Reject stale, foreign, hidden-panel and stale-selection requests. Graph/revision,
model/session and edition changes clear stale review state. Camera-only navigation
keeps semantic choices and recomputes current complete provenance; this is not
exact-artifact consent. Historical and busy sources protect edits while permitting
item inspection. Receipt comparison also protects choices. These controls confer
no conversion or edit authority.

Show source model/snapshot/fork ancestry, selected decisions and non-exhaustive
candidates, authored hotspot status, unresolved findings and every prospective loss.
Meaning remains visible under Minimal mode/disabled diagnostics. Optional technical
identifiers are hidden in those modes. Form and protection reasons have stable
accessible descriptions; status changes are exposed with native status semantics.
No raw source graph or graph-derived freshness key is rendered into the panel.

No conversion graph, Apply button, loss-acknowledgement token, receipt, persistence,
CLI operation or new public package contract is introduced. Existing package
architecture and canonical serialization remain unchanged.

## Alternatives and boundaries

Boundary verdict: **safe with noted risk**. Reusing the DDD Apply panel would mix
advisory C4 review with a different conversion contract. Automatic change-on-select
would make ambiguous interpretation look settled. Explicit staged preview and a
separate sidebar preserve intent and existing DDD behavior without adding a generic
mapping framework. The cost is a small ephemeral host model and source-scoped
messages; a future conversion plan must revalidate exact source/losses, containment,
live policy and atomic Undo independently.

## Acceptance and follow-up

Tests cover explicit draft/preview/retain/clear/reset, source and Undo invariance,
communication endpoint findings, scope non-inference, kind restrictions, stale/
foreign/hidden requests, graph reset, camera retention, historical/busy protection,
semantic loss/provenance content and Minimal mode. Production browser evidence
covers light/dark, keyboard Preview/focus, loss findings, immutable model/lineage,
blank-name invalidation and historical inspection/protection. Run full repository
checks before commit.

Next: define the headless C4 conversion-plan contract, including explicit membership/
containment decisions, exact source provenance and loss consent before Apply. No
npm publication, deployment, new dependency or version bump in this slice.
