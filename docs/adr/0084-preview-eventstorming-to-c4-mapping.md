# ADR 0084: Preview EventStorming-to-C4 mapping before conversion

## Status

Accepted for the approved headless preview slice, 2026-11-14. Extends existing
workshop semantics, C4 node types and model-document provenance. Architecture,
boundary, delivery and test-quality reviews are self-review.

## Context

Workshop actors, external participants, intent, facts, policies, discussion status
and organizational lanes do not establish runtime architecture. The existing DDD
preview is advisory; its DDD-specific conventions and relationship catalogue must
not become implicit C4 rules. Core has C4 node descriptors, but no reserved C4
relationship descriptor. This slice is review data, not permission to convert.

## Decision

Expose `previewEventStormingC4Mapping(source, choices)` from the peer-free core.
Capture a detached, deeply frozen source model document with its camera, editions,
fork ancestry and host-owned session/revision. Keep explicit choices and original
source IDs in the preview. Do not introduce a wire format, conversion graph,
editor event, consent token, ready-to-apply status or Apply operation.

All mappings require explicit choices. Actors have non-exhaustive person/system
candidates; workshop-external systems have system/container candidates without
inferred scope. Intent, facts and policies remain unmapped until explicitly
interpreted. Lanes and hotspots remain unmapped: grouping does not infer ownership,
and a resolved discussion is not validation. Null is an affirmative retain choice,
not omission. Explicit C4 descriptors must satisfy existing strict descriptor and
node-kind contracts. Hosts may name a structural interpretation rather than retain
an intent label. Preserve source descriptions unless explicitly replaced.

Inspect every relationship incident to a workshop node. No causal role, label,
proximity or compatible endpoint pair automatically becomes communication. An
explicit communication label can be proposed only between explicit C4 node
proposals or existing authored C4 nodes. Keep edge identity, endpoint identity and
direction in source provenance; do not reverse, aggregate or create connections.
Retention makes no C4 compatibility claim. C4 relationship choices are plain label
projection data, not a new reserved descriptor or an architectural correctness test.
Existing DDD/causal descriptors require visible replacement loss if reinterpreted.

Report prospective descriptor, authored status, lane interpretation, membership,
label and description losses independently. Membership remains source grouping,
not validated C4 containment; a later conversion contract must resolve this
explicitly. The complete source remains available even when a choice replaces
meaning. The preview is deterministic and source-ordered; choices are detached and
frozen without freezing caller inputs. Invalid/missing/duplicate/foreign choices
reject rather than silently drop or coerce data.

## Boundaries and alternatives

Boundary verdict: **safe with noted risk**. Core owns data validation and advisory
projection; hosts own source identity, session lifetime, review presentation and
future action authority. Only existing architecture/model-document/graph modules
are used. No FoldKit UI, CLI, Astro, provider or Effect runtime dependency is added.

Reusing DDD conversion machinery would couple distinct modelling conventions and
risk treating a DDD compatibility rule as a C4 rule. Automatic actor/system or
lane/container conversion would invent intent. Returning only a graph would lose
source history and review provenance. A new C4 edge schema is unnecessary for this
bounded label preview and would change codecs prematurely. Full document capture
costs more than graph-only preview, but retains the review context without mutable
lookups. No shared mapping engine is introduced for two domain-specific projections.

## Acceptance and follow-up

Literal workshop fixtures and independent expected decisions cover no-inference,
explicit choices/retention, source-order identity, compatible existing C4 endpoints,
blocked unresolved/DDD endpoints, kind restrictions, both hotspot statuses, lane
and membership losses, renaming/descriptions, strict choice rejection, immutable
provenance/choices, session/revision distinctions and empty sources. A real installed
consumer imports the public function/types. Run full repository checks and API docs.

Next: compose read-only workbench mapping review with explicit choices, provenance,
ambiguities and losses. Conversion planning, exact-plan loss consent, containment
resolution, live policy checks and atomic Undo remain separate future contracts.
No npm publishing, version bump, deployment, mutation or Apply in this slice.
Rollback before release is revert/rebuild; existing authored models are unchanged.
