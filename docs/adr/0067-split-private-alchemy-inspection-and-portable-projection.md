# ADR 0067: Split private Alchemy inspection and portable projection

## Status

Accepted for the approved private workspace extraction, 2026-11-13.
Architecture/boundary/delivery/test-quality reviews are self-review.

## Decision

Add private workspace `@opsydyn/foldkit-zloz-alchemy`. Its root portable entry
accepts a versioned data-only descriptor, validates it and computes graph/findings
with core only. `/domain` separately inspects trusted already-loaded beta.85 Domain
models, statically verifies declarations and returns the portable descriptor.
A convenience function composes inspection and projection. No arbitrary module
loader, business handler/Layer/client/provider, Apply, deployment or publication.

Descriptor format `foldkit-zloz-alchemy` v1 carries exact upstream version,
namespace/model/revision, stable declaration IDs/locators, explicit view-state
claims and directed source relations. It contains no graph, imported findings,
permissions or authenticated verification assertions. Source aliases remain
explicit through differing id/locator values. Inspection checks the caller's exact
version claim before model access; portable data remains host-authored claims.

Validate plain own-data records, known fields/kinds, positive bounded strings,
raw array limits, exact locator/relation identities, uniqueness, endpoint kinds
and complete model membership before graph emission. Reject accessors/symbol fields;
this is a data boundary, not a JavaScript sandbox. Decode unknown objects, not raw
JSON text: byte/framing/duplicate-key handling stays with host text IO. Serialize
only validated descriptors; detach/freeze output and canonicalise ordering.

Keep schema presence separate from values and handlers. Stateful views map to
native read-models, and only core-accepted feeds become declared consumption.
Stateless views and other gaps retain findings. Projection never treats imported
provenance as authority or editor permission. Graph revisions remain in descriptor
provenance, not every node, preserving meaningful edition comparisons.

Core is a required peer; SDK/Effect/Alchemy are optional peers used by `/domain`.
Dev fixtures pin the exact catalog versions. Core/other packages do not import the
adapter. The new private package participates in workspace tests/typecheck, but not
release selection. Existing core version metadata 0.3.0 is not published-artifact
compatibility: the actual native core source/artifact is qualified explicitly.
Omitted-read and stateless-view strict-optional failures remain retained gates.

## Alternatives and verification

A shared entry leaks SDK dependencies into data-only clients. Importing a saved
projection trusts stale/forged graphs and findings. Evaluating user TypeScript
adds an execution boundary. Keeping only the experiment omits workspace ownership.
The split makes those boundaries explicit without upgrading upstream or core.

Test malformed/extra fields, versions, duplicate IDs, identity aliases, relations,
state claims, accessors and bounds; literal round trips, mutation isolation,
recomputed losses/native semantics, reorder/edition continuity and blocked partial
results. Test real pinned declarations with poison handlers, both retained negative
compile probes, and packed portable consumers without SDK/Effect/Foldkit/React.
Separately qualify SDK entry under Node/Bun and strict TypeScript profiles. Run
root checks/typecheck/all tests and package artifact checks. No browser/manual or
live compatibility claim. Rollback is revert of package/catalog/lock/docs changes;
no external state changes. Publication/versioning need a later explicit decision.
