# ADR 0087: Review C4 placement and exact losses before Apply

## Status

Accepted for the approved workbench plan-review slice, 2026-11-14. Builds on
ADRs 0085–0086. Architecture, boundary, delivery and test-quality reviews are
self-review.

## Decision

Compose the package's C4 conversion-plan/consent APIs in the existing left sidebar.
The package determines required members, compatibility, blockers, complete source
provenance and prospective losses. The host owns ephemeral selection, staged
placement fields and affirmative acknowledgement. No second containment resolver,
conversion graph, Apply action, receipt or public package contract is introduced.

Require an explicit Review action for root, organization or declared containment;
never select a parent automatically. Show package findings for incompatible groups,
roles or cycles. Mapping changes remove placement choices that no longer belong to
the required-member scope, preventing later resurrection. Source graph/model/
edition changes clear stale review; camera changes retain semantic choices but
withdraw exact-source acknowledgement. Selection-only inspection preserves it.

Bind acknowledgement to current source scope, exact plan key and a monotonic host
review generation. Revocation and draft/source/protection changes invalidate queued
acceptance events, even if an earlier plan key later returns. Hide/reopen increments
the generation without discarding still-valid affirmative review. Historical/busy
and other read-only sources protect edits and acknowledgement with visible reasons.

Reconcile every app transition, including early-return import/read-only branches,
through the public update wrapper. Preserve existing results/commands and source
editor identity. This avoids leaving valid-looking acknowledgement after a reader
opens and closes through a different update path. No editor mutation authority is
created by the wrapper or by consent.

Use native labelled controls, stable reviewed-member keys, target/status feedback,
associated protection reasons and keyboard acknowledgement. Keep provenance,
blockers, losses and acknowledgement visible independently of numeric diagnostics.
The exact-content plan key remains callback data, never rendered as a DOM key or
readout. The canvas and existing mapping review remain visible/useful.

## Boundaries and alternatives

Boundary verdict: **safe with noted risk**. Recomputing package plans avoids
host/core semantic drift. Auto-placement or an always-enabled consent flag would
hide unresolved intent. Checking only the key would allow a withdrawn event to
become valid after A→B→A; source-scoped generations close that host review gap.
Reconciliation only in the ordinary update tail would miss early-return reader
paths. The wrapper centralizes review-state invalidation without changing domain
editor transactions. No new dependency, canonical schema, version or persistence.

## Acceptance and next

Tests cover staged placement, package blockers, explicit acknowledgement/revocation,
source/Undo/edition invariance, camera and reader round trips, hidden/stale/foreign
requests, obsolete member pruning, required lane members, compatible containment,
read-only protection and semantic diagnostics independence. Production browser
captures light/dark, keyboard placement/acknowledgement, visible root loss and
historical protection while exported source/lineage remains unchanged.

Next: implement package-level guarded atomic C4 Apply with current source/session/
revision, lifecycle, live policies, containment, exact consent and one Undo, retaining
provenance. No Apply, receipt download, npm publication or deployment in this slice.
