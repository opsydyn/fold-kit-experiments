# ADR 0086: Plan explicit C4 conversion and containment before Apply

## Status

Accepted for the approved headless plan/consent slice, 2026-11-14. Builds on
ADRs 0084–0085. Architecture, boundary, delivery and test-quality reviews are
self-review.

## Decision

Expose a peer-free C4 conversion-plan builder and fresh-source consent resolver.
Reuse the public mapping preview and its complete detached source document,
including camera, editions, ancestry, session/revision and explicit mappings.
Require every uncertain node/incident relationship to be explicitly interpreted or
retained before returning a complete change list. No converted graph, editor event,
Apply authority, receipt, persistence or new wire version is returned.

Every proposed C4 node requires an explicit placement decision. Reinterpreting a
lane as a C4 boundary also requires placement of every direct source member,
including retained workshop and existing non-workshop nodes. Other source nodes
cannot be moved by this conversion contract. No membership is inferred or silently
retained merely because the source graph is valid.

Three placement choices have distinct meanings:

- Root: explicitly remove a diagram parent, retaining world coordinates; remove
  parent-dependent extent/expansion fields with visible disclosure. Root placement
  does not establish real-world ownership or require that every owner is drawn.
- Organization: retain exact existing membership under a retained non-C4 frame,
  without declaring C4 containment. It requires an existing parent and cannot
  reinterpret a C4 boundary as organizational grouping.
- Contained: explicitly declare a C4 container inside a software-system group, or
  a C4 component inside a container group. Both child and parent must have proposed
  or authored C4 meaning; the parent must already be a portless group. No implicit
  group promotion, element merging or ownership inference. Persons/systems do not
  become nested runtime elements through ordinary lane membership.

These local role/kind rules follow the [C4 abstraction hierarchy](https://c4model.com/abstractions).
They do not validate deployment correctness, full model architecture, enclosing
pixel bounds or ownership outside the drawn graph. Retained notes inside a newly
reinterpreted C4 boundary must be explicitly detached or explicitly interpreted as
compatible C4 elements; mixed organizational annotations inside runtime boundaries
are deferred rather than silently granted containment.

Reject malformed/duplicate/foreign choices. Return meaningful blockers for missing
membership, invalid endpoints/boundaries/role pairs and cycles. Check the combined
intended parent graph, not only one choice at a time. Privately validate the complete
projection against existing graph invariants before returning reviewable changes.
Preserve IDs, ports, edge direction, appearance, host data and world geometry.
Explicit communications replace reserved edge descriptors with plain named links;
source meaning remains in provenance. No target graph is exported in this slice.

Keep the raw preview intact; plan disclosures replace its generic membership warning
with decision-specific containment/grouping/constraint findings. Consent is required
for all prospective losses in the exact plan. The content key binds full source,
choices and findings; it contains source data and must not be logged or put in the
DOM. It is not a credential, hash or proof of human review. Rebuild from current
source/options before checking consent; null revokes it. Blocked/unchanged plans do
not become consented. Fresh consent still cannot authorize Apply.

## Boundaries and alternatives

Boundary verdict: **safe with noted risk**. Core owns validation and review data;
hosts own source identity, session lifetime and future UI/transaction policy. No
FoldKit, Astro, CLI, Effect runtime or provider dependency is added. Reusing DDD
Apply would cross modelling boundaries and omit C4 containment intent. Automatically
keeping lane children would invent runtime ownership. Returning a partially changed
graph would obscure unresolved intent. A generic conversion engine or new C4 edge
schema is unnecessary for this bounded contract.

## Acceptance and follow-up

Tests cover full provenance, explicit root/organization/containment decisions,
source members affected by boundary changes, strict scope rejection, role/kind/
parent/cycle blockers, no partial change list, world/port/data/constraint preservation,
meaning/status/placement loss reporting, immutable choices, exact-plan freshness,
consent revocation, all-retained/empty no-ops and actual installed consumers. Run
full repository checks and API docs before commit.

Next: compose plan provenance, placement decisions and exact loss acknowledgement
in the workbench before implementing guarded atomic Apply. That future transaction
must independently check live source/session/revision, lifecycle, containment,
policies, consent and one Undo, then retain conversion provenance. No npm publishing,
version bump, deployment or Apply in this slice. Rollback is revert/rebuild; source
models are never mutated by planning.
