# ADR 0021: Fork editions with explicit model lineage

## Status

Accepted for the approved fork slice, 2026-11-09. Extends ADRs 0018–0019.
Boundary review: **safe with noted risk**. Document identity must be separate from
local diagram IDs and the editor's session revision/Undo state.

## Decision

Add a dependency-free `ZlozModelDocument` and a separate strict
`foldkit-zloz-model` version-1 envelope. It carries a host-supplied ID/name,
current snapshot, its own edition collection and nullable immediate origin.
Origin pins the parent model's ID/name and an immutable copy of the exact source
edition. It is provenance, not a cryptographic attestation or an entire ancestry
DAG. Hosts allocate model IDs unique within their registry; core rejects self-parent identity.
Existing graph/snapshot version 1 and edition-archive version 1 are unchanged.
Strict old readers reject the new envelope; graph-only exports deliberately omit
identity and lineage. Do not put reserved identity keys in host-owned node data.

`forkEdition` resolves an edition ID in the validated source document's own
collection, checks a host veto and distinct/nonempty target identity, and returns
a detached immutable new document with no editions of its own. IDs for nodes,
edges and ports are preserved inside the new model scope, including group and
endpoint references. No clocks, UUIDs or changes to the source are invented.
`createModelEditor` uses the normal editor initializer, with a fresh revision,
empty Undo/Redo, no selection/clipboard/routes/gestures, and the snapshot camera
unless the host explicitly overrides it. Ordinary edits/Undo are independent.
Forking a read-only source is not an edit of it; the host controls permission to
create the destination through the explicit fork policy.

The workbench owns an active identity and parked editor/edition sessions in its
Foldkit Model. It composes the public document functions at the boundary; it does
not duplicate document graph data alongside the live editor. Switching preserves
the other editor and Undo, resets transient UI drafts, and is blocked during
active gestures, layout and imports. Local-storage reads reuse the existing
request/revision guard so a late read cannot cross models. Canvas messages carry
model identity and an active-session epoch; stale callbacks are ignored even
after returning to the same model. These tokens are session data, not provenance. History transitions rotate the
epoch too. A keyed Foldkit workbench boundary remounts canvas resources at each
epoch so new callbacks bind to the new editor while late callbacks fail closed. Theme/diagnostics are
workspace preferences. Export model JSON preserves identity and origin; existing
snapshot and edition exports keep their narrower contracts. Sessions are not
automatically persisted or advertised as durable multi-user branches.

## Alternatives and scope

Adding fields to graph v1 would break strict readers and couple graph operations
to workspace identity. Reusing restore would replace the current model and mix
its Undo with the fork. Deeply nesting previous workbench Models would braid UI
configuration with provenance. A separate immutable document and small session
records preserve ownership and existing editing contracts.

No branch merging, playback, autosave, collaboration runtime or npm publication.
Core has no new runtime dependency. API/codec, packed consumer, app reducer and
light/dark browser evidence qualify the slice. Architecture/delivery/test reviews
are self-review, not independent attestation.
