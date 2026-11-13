# ADR 0065: Declare read-model consumption without runtime semantics

## Status

Accepted for the approved core contract slice, 2026-11-13. Architecture, boundary,
delivery and test-quality reviews are self-review. No dependency/adapter adoption,
workbench redesign, runtime execution, deployment or publication.

## Context and decision

The [pinned declaration spike](../../experiments/alchemy-domain-fidelity/README.md)
could retain views and source relations only as explicitly untyped diagram facts.
Core needs reusable language for this subset before any framework-specific adapter.

Add `read-model` to DDD node architecture and the native preset catalogue. It means
an authored query-oriented representation, not a repository, aggregate, transport
stream, executable projection or a guaranteed consistent snapshot. It is an ordinary
node, not a portless group; the existing DDD renderer uses the catalogue label.

Add directed tactical DDD role `feeds`: an aggregate/root, event-type or another
read model is the source, and a read model is the target. The descriptor expresses
an explicitly declared consumption dependency. It does not infer all events, a
filter, runtime ordering, replay, delivery, storage, key routing or handler effects.
Multiple explicit event-type edges may name selected types; source-level edges do
not enumerate or imply an event set. It conveys no strategic context relationship.
Self-consumption is permitted as an authored dependency, like other tactical
relationships; no executable feedback behaviour is inferred.

Expose a port-independent `ZlozDeclaredConsumption` with `sourceNodeId` and
`consumerNodeId`, a strict descriptor guard and `resolveDeclaredConsumption`.
Resolution requires existing nodes and the default explicit DDD roles, and returns
a detached frozen declaration, source role and logical `feeds` relationship, or
an explicit rejection. It does not create ports, infer edges, run code or authorize
an edit. The generic DDD convention/policy remains extensible; ports, duplicate
connections, protection, live revision and Undo remain editor responsibilities.

Use the existing v1 graph wire format: the new role strings are additive for this
reader, while earlier readers may reject them. No new framework fields or runtime
schemas enter reserved architecture. Existing snapshots retain their meaning.
Existing architecture-edit messages, DDD policy/controls and graph Undo carry the
new roles. Do not add a separate mutation pipeline or a redundant wire format for
the logical two-ID request.

## Alternatives and consequences

A new edge family duplicates tactical dependency machinery and widens unrelated
APIs. Host-only metadata leaves native consumers unable to recognise the meaning.
Treating a view as a domain service silently coerces semantics. The small additive
DDD contract reuses established validation, renderer, editing and persistence.
Its intentionally narrow read-model target leaves streams, sagas, policies and
other consumption meanings for explicitly reviewed extensions, not fallbacks.

Test literal reserved descriptors, invalid fields and group rejection; producer
roles and direction; missing/unsupported nodes; no graph mutation/inferred event
set; edit controls/policy/protection and one Undo; literal v1 decoding, editions,
serialization, SVG and an installed peer-free TypeScript/Node/Bun consumer.
Run root lint/typecheck/all tests and API docs. Update roadmap without closing D1
or claiming Alchemy compatibility/first-class support. Rollback is a local revert;
retain documents containing new descriptors before returning to an older reader.
