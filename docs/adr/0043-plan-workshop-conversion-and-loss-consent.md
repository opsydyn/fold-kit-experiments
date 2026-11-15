# ADR 0043: Plan workshop conversion with provenance and exact-plan loss consent

## Status

Accepted for the approved headless package slice, 2026-11-11.
Boundary review: **safe with noted risk**. A reviewed plan is advisory data;
affirmative loss consent is not an authenticated approval or edit permission.

## Decision

Expose `createEventStormingDddConversionPlan` and
`resolveEventStormingDddConversionConsent` from the dependency-free core. Reuse the
existing mapping preview, DDD conventions and canonical model-document capture.
Input includes a complete source model document, a host-owned nonempty source
session ID and nonnegative safe integer revision, plus mapping options. Hosts must
advance scope on source-session replacement, even when graph values match.

Capture a detached, deeply frozen copy of the complete source as provenance:
identity/name, graph/host data, camera, editions and fork ancestry. Keep this separate
from model `origin`, which denotes edition-fork ancestry. Do not invent a timestamp,
actor, target model ID, edition or new provenance persistence format.

Plans have three semantic states. `blocked` lists every ambiguous/unmapped note or
unmapped/incompatible incident edge, with no partial change list. Explicit null
choices retain workshop meaning rather than silently discarding uncertainty.
`unchanged` has no descriptor replacements. `reviewable` lists same-ID node/edge
replacements, their original descriptors and their proposal origins. It returns
no transformed graph or editor event. Retained causal edges deliberately make no
compatibility claim; future host policies may veto them. No frames, ports,
parentage, labels, geometry or host data are synthesized or rewritten.

Bind the complete captured source/session/revision, explicit mappings, effective
DDD catalogue and preview (including targets and prospective losses) into an exact
JSON review key. It is not a hash, credential, portable plan format or trusted
attestation. It contains model data; never log it or put it into DOM attributes.
Encoding/order differences may conservatively invalidate consent. No checksum,
provider, dependency or global cache is needed.

An affirmative consent record is `{ planKey, accepted: true }`, acknowledging every
listed prospective semantic loss for that exact plan. Null revokes it. The consent
resolver rebuilds from current source/options instead of accepting an old plan;
changed source identity/content/camera/history/ancestry, session/revision, choices,
targets or conventions invalidate the record. Unresolved blockers retain precedence
and unchanged plans require no loss consent. `consented` records only this review
condition; it never means Apply is available or permitted.

A future apply boundary must independently revalidate live source/session/revision,
policy, lifecycle, Undo availability, loss consent and provenance retention in one
atomic transaction. No such executor, UI consent control, CLI command, transformed
document, schema migration or persistence codec is added here. Plans are ephemeral
review data; the embedded source remains portable through existing model v1 JSON.

## Simplicity and alternatives

Reuse the published preview rather than duplicating inference or building a second
conversion engine. Pin the whole source instead of descriptor-only breadcrumbs,
which cannot reconstruct host data or lineage. Prefer exact content over a new
hash dependency or mutable preview-ID registry. Prefer affirmative exact-plan consent
over a broad allow-loss boolean. Costs are memory/key size and conservative
invalidation; no large-model performance or identity/authenticity guarantee is made.

## Verification and review

Test first: same-ID replacements, full frozen/detached provenance and round trip,
explicit consent/revocation, whole-plan blockers, no-op, source/scope/target/rule
changes, mutable input isolation, invalid documents/choices/catalogues and unchanged
source/history. Qualify real packed Node/Bun root consumers and Bundler/NodeNext
types, including negative consent/Apply fixtures. Run root check/typecheck/tests
and API docs. Architecture, delivery and test-quality review are self-review.
Rollback is source reversion; no user document is migrated.

Next bounded slice: compose the plan/provenance and exact-plan loss acknowledgement
in the existing mapping review sidebar before implementing Apply.
