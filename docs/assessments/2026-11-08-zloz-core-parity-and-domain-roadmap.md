# Zloz core: parity, domain modelling and differentiation

Assessment date: 2026-11-08. Source baseline: `9c40ac9`.
Scope: review and roadmap only; no domain feature implementation, dependency
change, publication or collaboration activation is authorized by this document.
The earlier CLI implementation is committed separately. Historical parity
receipts describe their captured revisions; this review supersedes their priority
recommendations, not their evidence.

**Delivery update:** the subsequent approved DDD renderer slice is implemented
locally. See its [qualification receipt](../../apps/zloz-demo/evidence/ddd-renderers.md).
The inventory below retains its original source baseline; DDD renderers are no
longer an open gap. Typed relationships and patterns remain open. The subsequent approved
[history slice](../../apps/zloz-demo/evidence/history.md) adds portable named
editions, read-only rewind and comparison ghosts; restore/fork, playback and
automatic persistence remain open.

## Recommendation

**Reshape the ambition from feature-count parity to an architecture modelling
workflow, while maintaining an explicit editor parity floor.** Target developers
and architects composing domain and system models in Foldkit applications. The
proposed progress is to carry workshop discoveries into architecture, review a
change, and publish it without repeatedly redrawing or translating the model.
Current alternatives include a canvas plus custom metadata, separate workshop
boards and architecture diagrams, or a model-based architecture tool.

A positioning hypothesis is: **Model a domain with people. Evolve its architecture
with agents. Review and communicate the same portable model.** This is a direction
to validate, not a shipped product claim. Today Zloz has C4 rendering, DDD semantic
descriptors, portable JSON, loss-aware Mermaid export and a standalone CLI. It does
not yet deliver the complete workflow, shared domain views or agent editing.

## Current capability inventory

Observed below means inspected tracked source and existing local qualification,
not a fresh exhaustive browser acceptance campaign. No parity percentage is
meaningful without an agreed capability and interaction test inventory.

| Area                           | Zloz baseline                                                                                           | Gap or qualification                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Canvas editing                 | Selection, keyboard editing, pan/zoom, snapping, resize, clipboard, Undo/Redo                           | Strong foundation; exhaustive device and assistive-technology qualification remains separate                                              |
| Connections                    | Creation/reconnection, policies with reasons, per-port snapping, chooser feedback                       | Directional output-to-input contract; no loose connection mode                                                                            |
| Presentation                   | Custom node/group shells, ports, edges, labels/editors, toolbars, readouts, themes, minimal diagnostics | Composability does not establish every downstream design is achievable without additional primitives                                      |
| Grouping                       | Nested groups, reparenting, containment/growth, collapse                                                | Portless groups; children use world coordinates rather than React Flow's relative parent positions                                        |
| Layout                         | Compound ELK and force adapter                                                                          | Force supports flat graphs; layout options are not a fully interchangeable engine contract                                                |
| Large graphs                   | Culling and retained bodies with live sockets/controls, internal benchmark receipts                     | No matched React Flow comparison or production-scale guarantee                                                                            |
| Edge geometry                  | Straight, stepped, smooth paths and custom rendering                                                    | No maintained authored draggable waypoint model; custom rendering alone does not supply it                                                |
| Architecture                   | Four C4 roles and eight DDD roles, geometry, validation, serialized descriptors, undoable changes       | C4 renderers exist; equivalent packaged DDD renderers and typed architectural relationships do not                                        |
| Reusable modelling patterns    | App examples, individual node factory                                                                   | No public atomic graph-fragment insertion contract with ID remapping and full rollback                                                    |
| Portability                    | Canonical graph/viewport JSON, nested Mermaid export, explicit loss reporting; local CLI qualification  | Mermaid import/parser adoption and image export remain separate work                                                                      |
| History                        | Session Undo/Redo and monotonic freshness revision                                                      | No durable named editions, semantic comparison or review/restore workflow                                                                 |
| Workshops and collaboration    | General graph composition                                                                               | No EventStorming contract or shipped collaboration runtime; another collaboration proposal exists separately                              |
| Other advanced editor features | Extensible renderer and reducer                                                                         | Rotation geometry, lasso/freehand/eraser, multi-connection conveniences and turnkey external drag/drop are not established package parity |

Source anchors: [architecture contract](../../packages/foldkit-zloz/src/architecture.ts),
[public model/events](../../packages/foldkit-zloz/src/types.ts),
[C4 renderer](../../packages/foldkit-zloz/src/c4-renderer.ts),
[Foldkit adapter](../../packages/foldkit-zloz/src/foldkit.ts),
[CLI qualification](2026-11-08-zloz-cli-qualification.md).

React Flow's [example catalogue](https://reactflow.dev/examples) includes both
free examples and subscription examples; distinguish a supplied example from a
built-in core capability when comparing integration effort. It already documents
[Undo/Redo](https://reactflow.dev/examples/interaction/undo-redo),
[Yjs collaboration](https://reactflow.dev/examples/interaction/collaborative),
[editable edge control points](https://reactflow.dev/examples/edges/editable-edge),
[rotation](https://reactflow.dev/examples/nodes/rotatable-node), and
[image export](https://reactflow.dev/examples/misc/download-image).
Its [accessibility](https://reactflow.dev/learn/advanced-use/accessibility) and
[server rendering](https://reactflow.dev/learn/advanced-use/ssr-ssg-configuration)
are also documented. None of these alone is a credible Zloz USP.
See its [sub-flow coordinates](https://reactflow.dev/learn/layouting/sub-flows)
and [strict/loose connections](https://reactflow.dev/api-reference/types/connection-mode)
for contract differences rather than assuming identical behavior.

## Package ownership and invariants

Keep reusable semantics, geometry, validation, reducers, patterns, diffs and
serialization in the pure core. Put default views and composable slots in the
optional Foldkit adapter. Keep layout and format/runtime adapters optional. Astro
composes reference experiences; it must not become the sole owner of a feature.
Do not add a package per notation until dependencies or distribution justify it.

The existing eight DDD roles are `entity`, `value-object`, `aggregate-root`,
`aggregate`, `domain-event`, `domain-service`, `repository`, `bounded-context`.
These are semantic node types, not a complete DDD modelling system. A diagram ID
is distinct from an entity's business identity; value objects still need diagram
IDs. An aggregate boundary expresses a modelling decision, not runtime enforcement
of transactional consistency. See the community-maintained
[aggregate design canvas](https://github.com/ddd-crew/aggregate-design-canvas).

The architecture descriptor is closed and validated. Adding EventStorming roles,
relationships or durable editions requires an explicit compatibility decision;
old strict readers cannot automatically understand a new family inside version 1.
Preserve historical wire identifiers when necessary for saved-data compatibility.
Host `data` remains host-owned; avoid undocumented reserved keys as a substitute
for public semantic contracts.

## Ordered delivery track

Each row is a proposed bounded slice, with its own implementation and commit.
Orders 3–7 are directional and should be reconsidered after the preceding model
has been exercised. Publication remains last and is not part of this track.

| Order | Slice                                           | Acceptance boundary                                                                                                                                                                          |
| ----- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | DDD preset renderers                            | Package-level node/group views for all eight existing roles; Order aggregate demo in light/dark; no new persisted fields                                                                     |
| 2     | Named editions and semantic comparison          | Immutable revision artifacts, distinguish semantic/layout changes, read-only comparison, restore as a new transaction; coordinate with collaboration design                                  |
| 3     | Atomic pattern insertion                        | Pure fragment builder plus one undoable insertion: deterministic caller-owned IDs, collision remapping, parent/port remapping, policy checks, whole-graph validation and no partial mutation |
| 4     | Typed DDD relationships and context maps        | Separate tactical relationships from strategic context-map relationships; direction/roles, validation, serialization, Undo and explicit Mermaid loss handling                                |
| 5     | EventStorming discovery primitives              | Versioned descriptor decision, free placement, optional links, events/commands/actors/policies/aggregates/read models/external systems/hotspots; uncertainty remains valid                   |
| 6     | Workshop patterns and architecture traceability | Optional lanes/order and process patterns; explicit references between workshop findings, DDD concepts and C4 elements, preserving human decisions                                           |
| 7     | Agent modelling operations                      | CLI capabilities and validated patch/dry-run contract, stable identities, expected revision checks and reviewable changes before any writable-agent integration                              |

**Next slice detail:** add DDD node/group renderers analogous to `zlozC4Node` and
`zlozC4Group` (names to confirm during implementation). Provide visible role text,
composable badges/body slots and a legend, theme tokens, and customizable shape
presentation. Preserve live ports, controls, resize, keyboard behavior, body-cache
composition and diagnostic switches. Use a small Order model showing root,
entity, value object and event. Demonstrate every other role in the palette.
Qualify public consumer imports, canonical round trips, both themes and existing
Undo behavior. No domain rules hidden in Astro or forced CSS overrides.

**Relationship guardrail:** begin with connectable context nodes for context maps
and root/node ports for tactical diagrams. Existing group boundaries have no
ports. Boundary relationships require an explicit model/projection design; do not
invent invisible proxy nodes or violate the group invariant. Consider partnership,
customer/supplier and upstream/downstream roles, shared kernel, conformist,
anti-corruption layer, open host service and published language as a candidate
vocabulary, not an approved exhaustive enum. Separate relationship type, endpoint
roles and integration strategies rather than collapsing them into edge labels.
The [DDD Crew context-mapping reference](https://github.com/ddd-crew/context-mapping)
provides terminology; domain design advice should be advisory, while broken
references and invalid graph structure remain hard validation errors.

**EventStorming guardrail:** the method is a
[flexible collaborative exploration workshop](https://www.eventstorming.com/),
not simply a set of colored nodes. Distinguish Big Picture discovery from process
and software-design modelling. Allow unconnected events, hotspots, competing
interpretations and unfinished stories. Give roles text/icons as well as optional
conventional colors, with a configurable palette. Past-tense labels can be guided
without an English-only validator. Explicit ordering/lane data must be separate
from incidental x coordinates and must not fabricate business timestamps.
The [community glossary](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet)
is a reference, not a requirement to adopt its artwork. A single-user demo cannot
qualify a collaborative workshop product.

## History and time travel as a first-class pillar

User clarification: history/time travel is central to the product direction,
alongside semantic modelling and portability. Bring its contract forward directly
after DDD renderers, before adding more persisted domain vocabulary. Use Foldkit's
history capabilities where appropriate, while explicitly designing durable model
history; runtime replay alone does not establish this product contract.

Deliver incrementally: first named immutable editions with a read-only historical
view and safe return to the present; then semantic/layout comparison; then restore
or fork an earlier edition into a new working model. Preserve the current model
until the user chooses a transition. A fork initially means a separate model
lineage; branch merging is separate scope. Add playback controls only after the
revision/transition contract is clear, respecting reduced motion and diagnostics.

Core owns revision artifacts, lineage, compatibility, pure comparison and restore
operations. Foldkit owns composable timeline, edition picker and comparison views;
Astro demonstrates them. Keep document revisions separate from the editor's
monotonic freshness token and session Undo stack. Define what is captured, how
editions persist and how source identity is retained before claiming deterministic
replay. Coordinate retention and concurrent restore behavior with collaboration.

History comparison must include opt-in **ghost nodes and edges**, following the
Tech Radar precedent: previous positions/outlines, movement connectors, and clear
added/removed/changed states. Keep ghosts read-only and outside editable graph,
ports, hit testing and Undo. Use text/legend and line treatments as well as color;
allow global and individual visibility controls for a clean view. Ghosts represent
a selected comparison baseline, not speculative intermediate business states.

The intended USP includes **exploring how a system evolved**, not merely editing
its latest diagram. Demonstrate two architecture editions, rewind without edits,
compare meaningful changes, return to the present, and restore/fork explicitly.
This is planned capability, not evidence that durable time travel has shipped.

## Parity work alongside the domain track

Prioritize primitives that improve the target workflow: atomic palette insertion,
authored edge waypoints, useful exports and discoverable navigation/settings.
Evaluate floating/proximity connections, external drag/drop and rotation against
concrete modelling tasks before committing them. Loose/undirected connections
require a deliberate port-contract decision. Whiteboard drawing and a full
workflow execution engine have lower priority until demonstrated needs arise.

Keep keyboard access, readable semantic labels, focus behavior, non-color meaning,
reduced motion and recovery in each slice. The user's deferred comprehensive a11y
test campaign remains a later gate, not a reason to defer accessible design or to
claim parity with React Flow's tested accessibility surface.

Keep performance claims local until representative workloads are qualified. A
future comparison should use the same hardware, production build, node/edge
content, graph sizes and interaction tasks. Existing internal before/after cache
benchmarks do not establish superiority over React Flow.

## Decision challenge: architecture workflow as the USP

### Trigger

Product differentiation and future shared model/serialization boundaries.

### Proposal and claims

Compose DDD, EventStorming and C4 with portable meaning and reviewable change.
The claim to test is reduced translation/reimplementation work for a target team,
not universal superiority, exclusive ownership of a notation or raw speed.

### Existing-platform ownership

React Flow already supplies extensible editor primitives and advanced examples.
Architecture modelling from a shared model is not new either:
[Structurizr workspaces](https://docs.structurizr.com/dsl/cookbook/workspace/)
contain a model and views. Reusing optional layout engines is sensible; replacing
them does not itself improve domain modelling. The separate collaboration
proposal owns its runtime investigation; this review does not duplicate or
activate it.

### Durable differentiated value

The proposed value is the combination of package-owned semantic contracts,
functional undoable operations, customizable Foldkit views, explicit conversion
losses, agent-readable tooling and reviewable model evolution. It is defensible
only if consumers can complete real tasks with less custom glue and preserve
meaning through the lifecycle. A working compiler or CLI alone is insufficient.

### Strongest counterargument

A team could add DDD cards and metadata to React Flow or use a mature modelling
product. Foldkit adoption and a new semantic contract add switching cost. If our
benefit is only a palette of shapes, it is weak differentiation and does not
justify a broad model repository or collaboration platform.

### Claim-to-evidence map

| Claim                                  | Current evidence                                                                 | Gap                                                  | Required evidence                                                |
| -------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------- |
| Core supports architecture semantics   | Observed: C4/DDD types, validation, codec, C4 views                              | DDD presentation and relationship meaning incomplete | Public-package DDD consumer and loss-aware relationship fixtures |
| Portable, agent-readable output exists | Observed: JSON/Mermaid contracts and locally qualified CLI                       | Import, editing and edition workflow absent          | Round-trip and validated change-review scenarios                 |
| This is the desired direction          | Reported: user's repeated architecture, customization and agent-tooling requests | Wider adopter demand unknown                         | Real modelling work and repeat use by intended consumers         |
| The combined workflow reduces work     | Inferred opportunity                                                             | No current baseline or comparative task evidence     | Compare completed model tasks and manual translation steps       |
| Zloz outperforms React Flow            | Unknown; no matched evidence                                                     | No qualified comparison                              | Matched benchmark before any performance marketing claim         |

### Minimum credible slice

Start with the DDD renderer slice above using existing contracts. Proposed
appetite: two engineering days for implementation and local qualification;
reassess rather than silently expanding into relationships, a model repository
or collaboration. This is an effort cap proposal, not a delivery promise.

Follow with two internal models and one independent package consumer using only
public APIs. Before claiming a USP, propose a one-week pilot with three intended
users completing at least two related modelling tasks. Primary measure: completed
artifact workflow and manual translation steps relative to their current method;
baseline is unknown. Record custom glue, lost meaning, corrections and repeat use.
This is proposed research, not research conducted or permission to contact people.

### Stop conditions

Reshape if the renderers are decorative without reducing implementation effort,
relationships require private data hacks, strict rules block legitimate workshop
uncertainty, or scope exceeds the proposed slice appetite. Do not fund the wider
workflow solely from successful demos. Revisit the USP if pilot tasks do not show
less translation work or a reason to reuse the same model.

### Verdict

**proceed**

### Rationale

The existing semantic foundation makes DDD presentation a small, reversible next
step. Confidence is high in technical fit and limited in demand or competitive
advantage. Proceed with that bounded recommendation and evidence collection;
feature implementation still awaits the next approved slice.
