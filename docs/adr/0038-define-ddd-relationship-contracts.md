# ADR 0038: Define DDD relationships before context-map presentation

## Status

Accepted for the approved headless package slice, 2026-11-11.
Boundary review: **safe with noted risk**. These are explicit Zloz modelling
conventions, not executable DDD invariants or certification of a domain model.

## Decision

Extend reserved edge architecture with a strictly validated `family: 'ddd'`
descriptor discriminated by `scope: 'tactical' | 'strategic'`. Tactical roles are
references, contains, emits, persists and uses. Strategic roles are partnership,
shared-kernel, upstream-downstream and customer-supplier. Named custom roles are
available in either scope. Generic upstream/downstream and customer/supplier
remain distinct; for those directional roles, source is upstream and target is
downstream. Optional upstream roles are open-host-service/published-language;
optional downstream role is conformist/anti-corruption-layer. These are annotations,
not execution, transport direction or an implementation of Context Mapper's DSL.
Symmetric partnerships/shared kernels carry no upstream/downstream fields.

Pure logical relationship input uses source/target **node IDs**, independently of
ports and rendering. It can validate portless aggregate/context frames. It is a
value contract, not a second persisted graph or an archive format. Existing graph
edges still require real output/input ports: this slice persists strategic meaning
on connectable bounded-context cards, not edges to group boundaries. Context-map
primitives and any future frame projection/storage decision remain separate.
Tactical contains does not assign a parent, and strategic relationships do not
infer technical data flow. Strategic self-links reject; tactical self references
are governed by the host's ordinary connection policy.

A public immutable rule catalogue, explicit resolver and opt-in policy compose
with existing host vetoes, port checks, connection lifecycle and node-role editing.
No DDD meaning is inferred from untyped edges. Custom rules replace the catalogue;
unknown descriptors remain syntactically portable and unresolved under a convention.
Policies for separate families ignore each other's authored meaning. Causal controls
must not overwrite a DDD descriptor or offer causal inference over it. EventStorming
rules and CLI/packet convention readers remain EventStorming-only.

Reuse graph/snapshot/edition/model v1 codecs, EdgeArchitectureChanged and semantic
history comparison. Deep-copy the new nested role list at the edit boundary and
compare descriptor values without depending on object property order or array
identity. Existing import and Undo/Redo retain authored semantics even when a
later convention rejects them. Mermaid reports omitted DDD meaning; review packets
preserve snapshots but their causal audit is still EventStorming-only.

## Simplicity and alternatives

Outcome: a reusable meaning contract with portable, undoable edge annotations.
Options checked: host data, a separate semantic store, generic relation-framework
refactor, or extending the existing reserved descriptor. Select the existing
boundary; do not braid geometry, rendering or collaboration into meaning. Preserve
strict syntax, opt-in compatibility and transactional editor safeguards. Omit new
UI, context-map shapes/starters, DDD audit commands, collaboration, dependencies,
publishing and deployment. Remaining uncertainty is future frame projection and
real-user notation preferences; do not preempt either with invented boundary ports.

## Implementation and verification

- Core architecture: DDD union/guards, family-specific guards and descriptor equality.
- Core DDD module: rule/value/decision contracts, resolver and composed policy;
  export from the dependency-free package root.
- Isolate existing causal resolver, controls, audits and convention readers by family.
- Test first: literal wire records, malformed/mixed descriptors, role/direction,
  logical group references vs drawable-port rejection, custom catalogues, mixed
  families, protected edits/node-role changes, one Undo and full codec/history loss
  disclosure. Qualify real packed root types/runtime under Node and Bun.
- Run root check/typecheck/tests, API docs and CLI/package qualification. This is
  a headless slice; no new screenshot or renderer claim. Reviews are self-review.

Rollback is code reversion; retain exported DDD documents for compatible readers.
Older readers may reject unfamiliar descriptors; unchanged envelope version does
not promise old-reader semantic support.

## Sources

[Context Mapper's context-map model](https://contextmapper.org/docs/context-map/)
distinguishes symmetric patterns from upstream/downstream relationships and side
roles. Zloz adopts that distinction, not its complete grammar or validators. Our
tactical catalogue is an explicit toolkit convention, not a claimed universal DDD
relationship taxonomy. See also ADR 0005 and ADR 0030.
