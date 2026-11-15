# ADR 0105: Define group endpoints and coordinate compatibility

## Status and authority

Contract definition completed for the approved C2 planning slice, 2026-11-15,
against `03284a8d` in the isolated worktree. The choices below are the recommended
implementation contract, not shipped API behavior or a declaration of C2 parity.
Implementation, the proposed new wire generation and acceptance of the intentional
React Flow differences need the next explicit approval. No runtime, reader,
public export, package version, publication or deployment changes in this slice.

Follows [ADR 0005](0005-headless-flow-architecture-contract.md),
[ADR 0103](0103-qualify-v2-portable-adapter-boundaries.md) and
[ADR 0104](0104-adopt-native-v2-authoring-and-review.md).
Architecture, boundary, delivery and test-quality reviews are self-review.

## Trigger and observed baseline

`ZlozNode.position` and existing grouping transactions use world coordinates.
`validateGraphForConnectionMode` requires a `kind: 'group'` parent and rejects
ports on groups. Group movement includes descendants once; grouping/ungrouping
preserve world positions. `portEditReason` and native port controls independently
exclude groups. These are package invariants, not limitations removable by a
custom renderer or a permissive connection callback.

React Flow documents parent-relative child positions, other node types as parents
and a handle-free convenience group type. See its
[sub-flow guide](https://reactflow.dev/learn/layouting/sub-flows), checked
2026-11-15. This is a bounded comparison of documented semantics; it does not
establish a complete parity inventory or a better user experience.

The [decision challenge](../assessments/2026-11-15-zloz-c2-group-contract-decision.md)
permits defining this contract while holding runtime implementation to a separate
approval and compatibility gate.

## Domain and ownership

- **Group:** an explicit authored containment boundary, identified by
  `kind: 'group'`; it may have a custom visual shell. Its geometric envelope is
  rectangular in this contract. Semantic meaning and visual appearance remain
  independent of membership.
- **Parent:** another group in an acyclic ownership forest. A spatial overlap is
  not membership. C4/DDD containment and EventStorming lane organization keep
  their existing distinct semantics.
- **Authored group port:** a normal identified `Port` owned by a group, reached by
  the existing `{ node, port }` endpoint identity. It is not an alias for a child.
- **Collapsed proxy:** derived presentation of an edge attached to a hidden child.
  It grants neither a new authored port nor a new target/Apply permission.

Core owns geometry, validation, membership, policy evaluation and transactions.
Foldkit owns message/render/lifecycle composition. Hosts own document incarnation,
I/O, live policy and current consent. Layout adapters translate their engine's
coordinates; they cannot change the canonical coordinate convention. Export and
review adapters must report capability/fidelity boundaries explicitly.

## Decision 1: keep one world-coordinate convention

Retain `position` as the world-space top-left of the authored envelope at every
nesting depth. Camera pan/zoom never changes authored geometry. Parent movement
applies the same delta to each included descendant exactly once, including a
selection containing both an ancestor and a descendant.

Grouping, ungrouping and reassignment do not implicitly translate positions.
A reparent action validates its complete result, including parent extents and
expansion rules, and either commits it once or returns an explicit reason. It
must not clamp, move a child or grow a protected ancestor behind the user's back.
Any permitted extent/ancestor expansion is part of the same preview and Undo.

Parent-relative input requires an explicit boundary adapter which resolves the
complete ancestor chain before construction. No heuristic coordinate detection,
`data` convention, mixed-coordinate node array or view-only subtraction is allowed.
The document does not store both relative and absolute positions.

This intentionally differs from React Flow's child position convention. Acceptance
of this difference is part of C2 closure, not automatically granted by this ADR.

## Decision 2: keep explicit semantic parenthood

Only `kind: 'group'` nodes own children. A group may use a custom renderer and,
with the new capability below, own ordinary ports. A regular visual appearance
therefore does not require weakening ownership into arbitrary `parentId` targets.
Missing parents, ordinary-node parents, self-parenting and cycles reject atomically;
array order does not determine validity. Empty and nested groups remain valid.

Do not automatically promote an ordinary node to a group when a child is dropped.
An explicit future promotion must validate architecture/appearance constraints and
membership/port effects as one reviewed transaction. General ordinary-node
parenthood and nonrectangular group geometry are proposed deferrals, not approved
exclusions or implemented features. These differences stay visible on the roadmap.

## Decision 3: opt-in authored group ports

A default group remains portless. An explicit document capability permits normal
`ports` on eligible groups; it does not convert groups automatically. Reuse the
existing port IDs, labels, input/output kinds, side/offset and explicit normalized
anchors. Reuse ordered connection identity and strict/loose eligibility. Port kind
never supplies a DDD side role, a causal role or a symmetric relation.

Eligible generic groups and C4 software-system/container or DDD aggregate/context
frames can opt in without inferring a semantic relationship. EventStorming lanes
remain portless organizational frames; hotspots remain portless annotations. No
feature or policy callback can override those semantic constraints. Architecture
creation defaults and all old formats retain their current portless behavior.

For `(x,y,w,h)` and normalized port anchor `(u,v)`, the canonical anchor is
`(x + w*u, y + h*v)`. Side/offset and explicit-anchor precedence remain the same as
ordinary nodes. Move and resize affect anchors through that formula; they do not
rewrite port IDs or normalized anchors. Resize retains child world positions,
subject to the complete existing containment/extent plan. Route caches invalidate
on authored geometry changes.

Connection creation/reconnection, per-port edit/connect rules, chooser rejection
reasons and edge/corner snapping must use this same eligibility and geometry.
Snapping stays opt-in; bypass, per-port overrides and one-gesture Undo apply equally
to group-owned ports. A DOM socket cannot make an invalid graph connectable.

## Decision 4: separate collapsed presentation from authored identity

Collapsing a group does not edit the graph, mode, ports, children or endpoints and
creates no authored Undo entry. Existing authored/presentation history boundaries
remain explicit. The current collapsed rectangle is 224 by 56; expose the effective
presentation envelope to consumers rather than duplicating its constants.

Resolve an owned group port against the visible group's effective envelope. An
edge ending at a hidden descendant continues to store that descendant's endpoint;
its boundary projection is a nonauthorable proxy, using the existing collapsed
routing behavior. These are distinct identities even if screen positions overlap.

An edge from an owned boundary port to a descendant hidden by that same collapsed
group is internal and hidden; its identity remains authored. Edges between visible
owned ports remain visible, including otherwise permitted self-connections. A
hidden nested group and its owned ports project through the visible collapsed
ancestor just like any hidden endpoint. These cases need explicit visibility
fixtures; the current portless classifier must not be assumed sufficient.

An interaction may target an actual group port. It may not silently reconnect a
child edge to that port, create a port from a proxy or change an edge's endpoint
because of collapse. Ambiguous hits need explicit choice/reveal, with protection
reasons and keyboard access; DOM paint order is not permission. Expanding restores
original anchors and descendant presentation without graph edits.

## Decision 5: use an explicit future v3 envelope

Do not widen `validateGraph`, v1 codecs, v2 connection/model/edition readers or
`EditorOptions` in place. Current v2 readers allow only their declared document
fields and retain portless-group validation. Group ports change a structural graph
invariant; hiding them in unknown fields risks silent loss in older readers.

The proposed standalone construction target is conceptually:

```ts
// Proposed contract only: these names are not exported APIs yet.
type GroupDocumentV3 = Readonly<{
  version: 3;
  coordinateSpace: 'world';
  connectionMode: 'strict' | 'loose';
  capabilities: Readonly<{ groupPorts: boolean }>;
  graph: GroupGraphV3;
  viewport?: Viewport;
}>;
```

`GroupGraphV3` preserves the existing node/edge/endpoint field identities while
validating them under explicit group capability. A false capability rejects every
ported group, including unconnected groups. A true capability permits eligible
ported groups; it does not require a group to have ports. Require exact envelope
fields, owned data, finite geometry, declared mode and boolean capability. Unknown
versions, capability keys and coordinate conventions reject explicitly. Version 3
must not be smuggled through a v2 type assertion or legacy `EditorState`.

The first reader/capture must enforce the existing portable-evidence envelope:
2,000,000 UTF-16 string characters, depth 64 and 100,000 scanned values, with
owned-data string/key and traversal limits no looser than those existing defaults.
Callers may tighten limits, not increase them. Reject duplicate decoded keys,
nonfinite numbers, accessors without invoking them, unsupported object prototypes
and unrecognized structural fields; `data` remains the explicit data-only
extension point. Hosts/CLI separately bound bytes before fatal UTF-8 decoding.
Differentiate invalid syntax/shape from a valid but unsupported version,
capability or coordinate convention; return a reason/path and no target on failure.
Unexpected implementation defects must not be converted into a successful decode.

The first upgrade inputs are validated standalone v1 graphs/snapshots (strict)
and v2 connection documents (their declared mode), not complete models or archives.
Upgrade is explicit and detached: preserve world
coordinates and identity, retain/default the documented mode and start with group
ports disabled. Never mutate the source. Down-conversion may produce reviewed v2
data only when every group is portless and the graph passes the old mode-aware
validator. Otherwise return findings and no target. Do not drop ports/edges,
retarget to a child or change node kinds as a supposed lossless downgrade.

A v3 model/archive must preserve the capability, coordinate convention and mode at
**each** checkpoint and origin. Mixed generations need explicit upgrade/rejection
rules before adoption. Patches, receipts, review packets, Mermaid metadata, CLI,
SVG/PNG and layouts remain version-required until their native v3 contracts are
qualified; a new snapshot decoder alone does not authorize them. CLI must separate
valid-but-unsupported formats from malformed data. No blanket version bump across
all existing artifacts is authorized by this definition.

The cost of another wire generation is real. Revisit this decision before coding
if a capability extension can demonstrate equally explicit old-reader rejection,
no silent field loss and less cross-adapter complexity. Merely accepting an
`allowGroupPorts` editor option is not an equivalent alternative.

## Policy, destructive edits and Undo

Before any commit, recheck source incarnation/revision, editing lifecycle, group
capability, group/port eligibility and the current granular/whole-operation
policies. Policy callbacks see owned validated data. A veto anywhere leaves graph,
selection, revision, history and provenance publication unchanged.

- Parent/group movement checks every affected descendant and any expanding
  ancestor once. Resize and reparent include all implied changes in their plan.
- Port removal uses the existing port-edit and complete attached-edge deletion
  rules; a protected incident edge blocks removal. Bulk operations are all-or-none.
- Ungrouping a ported group is blocked with a visible reason until its ports and
  incident connections are explicitly handled. It must not erase boundary meaning
  or invent child routing. Legacy portless ungroup behavior remains unchanged.
- Deleting a group accounts for descendants and all incident boundary/child edges
  through the complete existing deletion policies. One allowed transaction yields
  one Undo; rejection yields none.
- An accepted authored change retains graph, coordinates, mode and capability in
  one Undo/Redo unit. Stale permission/consent or a hidden preview cannot authorize
  a new commit. A disabled Undo history blocks an operation promising atomic Undo.

## Acceptance matrix and implementation plan

First implement **only** the standalone v3 headless document/validation/upgrade and
blocked-downgrade contract after approval. No group interaction or v3 editor is
part of that first implementation. Use literal independent wire records, including
valid unconnected ports so an edge is not the only capability test.

| Case                                                              | Required result                                                                    |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Legacy nested group fixtures                                      | Existing v1/v2 readers and writers keep their exact results and portless guards.   |
| V3 world envelope, capability false, portless groups              | Accepted; strict/loose mode retained explicitly.                                   |
| Capability false plus an unconnected group port                   | Rejected without a target.                                                         |
| Capability true, group output to ordinary input                   | Strict-compatible when the complete graph and semantic checks pass.                |
| Capability true, input-to-input                                   | Strict rejects; explicit loose mode permits only an otherwise valid pair.          |
| Ported lane/hotspot, missing/duplicate IDs/ports                  | Rejected even with group capability enabled.                                       |
| Unknown coordinate/capability/version, duplicate/deep JSON        | Explicit structured failure before publication; finite and size limits apply.      |
| Missing/ordinary parent, self-parent, cycle, child-first ordering | First four reject; child-first valid ownership is accepted independently of order. |
| Explicit upgrade                                                  | Source unchanged; positions/IDs/mode retained; no ports invented.                  |
| Portless downgrade                                                | Revalidate old mode-aware graph; own the detached target.                          |
| Ported downgrade, even without edges                              | Findings, no target, no silent omission.                                           |
| Old v1/v2 readers see v3                                          | Reject the envelope; never reinterpret as a legacy graph.                          |

Later editor/renderer/adapter acceptance is specified now, but implemented in
separately approved vertical slices:

1. Geometry literals: group `(100,80,400,300)`, right midpoint port anchors at
   `(500,230)`. Child `(140,140)` remains in world coordinates. Moving the group
   by `(40,-20)` yields group `(140,60)`, child `(180,120)` and port `(540,210)`;
   ancestor/descendant multiselection never doubles the delta.
2. Resizing to `(100,80,500,400)` anchors that port at `(600,280)` without moving
   the child. Collapsed 224-by-56 presentation anchors it at `(324,108)`, without
   changing the authored graph, endpoints, stored size or Undo count.
3. Stale/during-gesture/read-only/protected operations reject atomically. A late
   veto of a descendant, expanding ancestor or incident edge rolls the entire
   proposal back. One accepted move/resize/reparent/port edit reverses fully with
   one Undo, including capability/mode changes where explicitly supported.
4. Owned-port versus collapsed-proxy ambiguity needs explicit creation/reconnect
   evidence, keyboard alternatives and no endpoint rewrite. Per-port snapping,
   bypass and protected choosers remain live.
5. ELK needs real compound-node port qualification and world/local round trips;
   its current group branch cannot be assumed to handle them. Force remains
   explicitly ineligible for grouped graphs. SVG/PNG, custom renderers and Mermaid
   need truthful bounds/identity/fidelity reporting. Adapter rejection is safer
   than guessed routing or a missing port.
6. Packed Node/Bun and strict NodeNext/Bundler consumers, TypeDoc export review,
   literal compatibility fixtures and mounted light/dark/Minimal/keyboard evidence
   precede any claim of interactive delivery. Comprehensive AT/device acceptance
   remains last; accessible controls remain mandatory in every slice.

Primary change areas: new versioned document/types/codecs adjacent to
`connection-document.ts`; version-fixed validation/ownership helpers adjacent to
`graph.ts`; later shared group geometry/presentation and `port-*` controls,
`editor.ts` transactions, history and capability-aware adapters. Preserve old
wrappers through explicit validation contexts rather than globally relaxing guards.
Use the ADR 0103/0104 portability inventory for every future boundary.

The first implementation should add a version-fixed module such as
`src/group-document-v3.ts`, literal `test/fixtures/group-document-v3-*.json` and
`test/group-document-v3.test.ts`. Keep old graph/connection wrapper tests, add
packed entry/type coverage in `test/package.test.ts`, and review any new `index.ts`
exports/TypeDoc. If shared validation helpers change, their context must default
only at the old wrapper boundary, never from global state. Module/export names are
prospective and must be confirmed with the implementation contract; no such API
is shipped by this ADR.

## Consequences and stop conditions

The retained world convention avoids storing derived coordinates and preserves
existing geometry/Undo. Explicit parenthood avoids inferring domain ownership from
visual style. Group ports provide direct boundary connections without fake child
nodes or view hacks, but demand a versioned compatibility and presentation path.
These are product/design inferences, not measured customer acceptance or proof of
superiority over React Flow.

Stop before implementation if old readers can accept and lose the new meaning,
if an ordinary editor can commit data its serializer rejects, if a proxy becomes
an authored endpoint, if a migration rewrites positions/identity, or if an adapter
needs unreported data loss. Broader ordinary-parent or shape support needs its own
contract amendment. No visual evidence or runtime tests are claimed for this
specification; implementation acceptance above remains outstanding.
