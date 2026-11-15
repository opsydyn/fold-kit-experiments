# ADR 0064: Qualify Alchemy declarations in an isolated spike

## Status

Accepted for the approved bounded spike, 2026-11-13. This is not acceptance of a
production integration. Review after the spike evidence, no later than 2026-11-14.
Architecture, boundary, delivery and test-quality review are self-review.

## Context and decision

The [integration review](../assessments/2026-11-13-zloz-alchemy-domain-integration.md)
identified public declaration metadata and unqualified semantic/version gaps.
Keep the implementation under `experiments/alchemy-domain-fidelity`, outside the
workspace globs. Pin Domain and Alchemy beta.85, Effect 4.1.0 and TypeScript 6.0.3;
consume a locally packed core. Install in the experiment only, without scripts.
Do not change root catalogs/lockfile, production dependencies, core roles or hosting.

Read public fields of trusted synthetic declarations only. Do not load arbitrary
source paths or build Layers, call handlers, commands, stores, APIs or providers.
Produce a bounded, detached, immutable, versioned source manifest; map to canonical
Zloz graphs with per-declaration/relation findings and provenance. Preserve unknown
semantics explicitly. IDs use namespace/model/kind/name; reordering cannot change
them, collisions reject, and renames are remove/add unless an explicit one-to-one
identity override preserves continuity. No business instance IDs or payloads.

Map a bounded context, aggregate-root type, commands/events and policies to existing
node roles as candidate visual projections, not executable equivalence. Preserve
views/streams as visibly untyped nodes with explicit findings. Keep declaration
relationships labelled and source-linked but semantically untyped, with findings;
message-flow declarations do not prove strategic DDD relationships or handler
behaviour. Missing source references block graph emission instead of producing
dangling edges. Model membership is parent grouping, with its source fact retained.

Qualify an actual Domain fixture and two editions with independently authored golden
manifest/graph expectations. Test reordering, shared event declarations, conflicting
duplicate identities, aliases, renamed declarations, missing references, finite
resource limits, detached source data and zero handler invocations under Node and
Bun. Existing core decode/history/export helpers must consume the emitted graph.

## Alternatives and consequences

Adopting a production adapter now hides beta/vocabulary uncertainty. Adding Domain
roles to core first guesses semantics. A plain handwritten data fixture alone
cannot prove compatibility with the real package. The isolated pinned experiment
allows real declarations without importing Alchemy into core; costs are a separate
lockfile/build/test command and synthetic rather than user-task evidence.

Stop if public fields require private stores, untrusted module evaluation, runtime
execution, dependency upgrades or silent coercion. Record gaps instead of expanding
scope. Do not treat diagram Undo/history as backend event replay. No provider
execution, publication, deployment, source generation or live transport. Rollback
is removal/revert of this isolated experiment and its documentation.
