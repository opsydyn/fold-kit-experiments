# First-class architecture shapes and patterns for Flow

**Status: approved roadmap, 2026-11-08.** Slice one is implemented and locally
qualified in the [headless contract record](2026-11-08-flow-headless-architecture-qualification.md).
Opt-in C4 preset renderers and the themed system-context/container demos are
implemented in [ADR 0006](../adr/0006-composable-c4-preset-renderers.md) and the
[rendered qualification](../../apps/flow-sample/evidence/c4-renderers.md).
Pattern insertion and DDD renderer slices remain future work. The protected Orbit follow-up is
committed separately as `c7292fc`. The proposal below records the original scope;
[ADR 0005](../adr/0005-headless-flow-architecture-contract.md) defines the implemented contract.

## Recommendation and outcome

**Pursue a bounded package feature.** Engineers should be able to create a C4 or
DDD node, use a useful default appearance, replace its presentation, and insert a
coherent diagram pattern through public APIs. A consumer should not need the
Astro sample, private imports or CSS overrides to reproduce it.

The user has explicitly requested this capability. The observed foundations are
typed graph editing, port policies, groups, geometry, history and composable
FoldKit views in the package. The current alternative is generic nodes plus
consumer metadata and custom shells, as demonstrated by Orbit and onion examples.
Inference: shared semantic contracts and presets will reduce repeated consumer
work. External adoption, preferred notation and authoring success are unknown;
this is a requested product direction, not validated market demand.

Proposed appetite: three bounded implementation slices, with the first ending at
a tested headless contract. Reassess after each slice. Do not spend the first
slice on a large icon catalogue, general architecture repository or code generator.

## Domain meaning and notation

C4 describes systems containing applications/data stores, then components and
code, alongside people using systems. A database can therefore be a Container;
“container” does not imply a Docker deployment unit. Start with Person, Software
System, Container and Component. Code/deployment/dynamic views follow separately.
[Primary C4 abstractions](https://c4model.com/abstractions).

C4 does not mandate shapes or colours. Ship a readable default notation with
type/name/responsibility, optional technology and explicit relationship labels.
Provide composable diagram titles and legends; colours must not be the only
meaning carrier. These defaults follow the
[C4 notation recommendations](https://c4model.com/diagrams/notation).

For DDD, separate strategic context mapping from tactical aggregate modelling.
Context maps describe relationships between bounded contexts and their teams;
an aggregate model needs to convey its consistency boundary and root, rather than
just a decorative enclosure. These are modelling aids, not executable business
invariants. [DDD Crew context mapping](https://github.com/ddd-crew/context-mapping),
[Aggregate Design Canvas](https://github.com/ddd-crew/aggregate-design-canvas).

The proposed DDD palette is our configurable notation, not a claim that DDD
prescribes one standard set of glyphs. Flow node IDs identify diagram elements;
they do not give a value object domain identity. Commands, policies and
EventStorming colours can be a later optional palette rather than silently
becoming mandatory DDD semantics.

## Package contract and boundaries

Keep this in **`@opsydyn/foldkit-flow`**. The pure root owns typed descriptors,
factories/catalogues, shape geometry/default anchors, validation and pattern
construction. The existing **`/foldkit`** entry owns default themed renderers and
palette/legend composition. Astro owns only examples and demonstration controls.
No new mandatory package, browser dependency in the root or layout engine is
needed. Existing optional force/ELK adapters must consume the same graph bounds.

Boundary verdict: **safe with noted risk**. Shape outlines affect anchors,
measurements and hit testing; descriptor persistence affects documents. Follow
[ADR 0003](../adr/0003-foldkit-flow-and-optional-layout.md) and
[ADR 0004](../adr/0004-composable-flow-presentation.md). A new ADR is required in the first implementation
slice for the precise public schema and geometry choice. None is accepted here:
this turn changes neither package boundaries nor persisted contracts.

Proposed contract, with names illustrative until the ADR:

- An optional **`architecture`** discriminated descriptor records a family and
  semantic role, with role-appropriate description/technology/references. C4 and
  DDD are separate union cases, not independent booleans.
- An optional **`appearance`** descriptor records a serializable built-in shape
  choice. Renderer functions, themes and custom shape registries remain view
  configuration. Role defaults can be overridden without changing meaning.
- A plain Flow node remains valid without either descriptor. Do not overload
  `kind`, currently reserved for groups, or take over the host's existing `data`.
- Node and relationship factories accept caller-owned IDs. Pattern builders
  produce a graph fragment; inserting it validates IDs/endpoints/membership and
  current editing policies, then commits atomically as one Undo step. A rejected
  insertion leaves no partial graph or history entry.
- Semantic relationship descriptors belong on edges, with explicit direction,
  optional protocol and composable labels. Context-mapping relationship kinds
  must preserve endpoint roles rather than relying on colour or a vague “uses”.

The application Model remains the source of truth. Changing a node's semantic
role or authored shape is a typed event with validation and Undo. Changing the
renderer/theme is presentation configuration. No second architecture store or
DOM-derived domain state is introduced.

## Initial catalogue and patterns

| Family        | Node roles                                                                     | Default presentation                                                                     | Reusable patterns                                       |
| ------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| C4            | Person, Software System, Container, Component                                  | Person adornment, typed cards, optional data-store cylinder; internal/external treatment | System context; container view within a system boundary |
| DDD tactical  | Entity, Value Object, Aggregate Root, Domain Event, Domain Service, Repository | Typed cards with configurable stereotypes; aggregate boundary around root/members        | Aggregate with root and members                         |
| DDD strategic | Bounded Context; Subdomain classification                                      | Context node for a map; labelled boundary for expanded contents                          | Context map with named directional relationships        |

Important group constraint: current groups are **portless**. In a context map a
Bounded Context is a normal port-bearing node. In an expanded view it is a group
whose internal nodes carry connections. An aggregate group contains an explicitly
identified root; it does not become a new connection endpoint. Keep these
representations explicit rather than breaking group invariants. Shared identity
across multiple diagram views is a later contract, not inferred from equal labels.

Patterns should also make existing onion/hexagonal examples reusable eventually,
but C4 context/container and DDD aggregate/context map come first. Semantic
diagnostics are advisory by default so users can document an existing system or
an antipattern. Applications can opt into stricter policy enforcement. Diagnostic
visibility follows existing global/per-part settings; required accessible names
and connection semantics remain intact when decorative content is hidden.

## Geometry, styling and accessibility

Start with a small set of qualified shapes: box/rounded card, person adornment
and data-store cylinder. Each default outline, content area, port placement and
resize behavior must agree with the pure geometry contract. A silhouette is not
complete while edges terminate at an unrelated hidden rectangle.

Preserve existing explicit normalized port anchors. Do not silently reinterpret
them when changing shape; document how authored anchors override defaults and
provide an explicit undoable reset-to-default action. Qualify cardinal defaults,
boundary projection, hit areas, selection, resizing and layout adapter bounds
before adding more outlines. Defer arbitrary SVG shape registration until that
outline contract has proved sufficient for these presets.

Default FoldKit renderers compose public frames, handles, sockets and resize
controls. Static artwork may use the public body cache; policy-controlled ports,
editors and controls stay live. Offer tokens and slots for typography, spacing,
border/fill, icon, stereotype, technology, description and relationship labels.
Consumers can omit optional chrome and supply custom shells without private
attributes or selector hacks. Demonstrate light/dark themes and minimal mode.
Accessible names include the semantic type where useful; native focus/keyboard
behavior comes from existing primitives. Formal a11y audit remains a later gate,
while these semantics are required in every slice.

## Serialization and compatibility

Observed: current v1 node validation checks known fields without rejecting
unknown keys; parse/serialize and `copyGraph` retain those JSON fields. This makes
additive optional descriptors a plausible v1 extension, **not established
backward compatibility**. New readers must validate descriptors when present.

The first slice must use literal old/new document fixtures to prove old documents
still load, unrelated `data` survives copy/export/Undo, and a pinned old consumer
can retain new descriptors while falling back to generic rendering. Check both
legacy edits and round trips: preserving unknown JSON on parse alone is
insufficient. If any supported path drops or misinterprets descriptors, document
the limitation or choose a versioned migration in the ADR. Do not bump the
document version merely for convenience, or promise older renderers know new
shapes.

## Delivery slices and acceptance

1. **Headless architecture contract.** Record the ADR; implement discriminated
   C4/DDD descriptors and catalogue, initial shape/default-anchor geometry,
   factories, validation, codec compatibility and undoable role/shape changes.
   Prove that a strict packed consumer uses the root without FoldKit/browser
   dependencies. Do not ship unsupported descriptors as if their renderers exist.
2. **C4 authoring through public APIs.** Add composable preset renderers, context
   and container pattern builders with atomic insertion, relationship labels,
   title/legend composition and workbench palette/editing. A consumer sets a node
   to a C4 role, customizes its shape/theme, connects it, edits it, exports/reloads
   it and undoes insertion without copying sample implementation.
3. **DDD authoring through public APIs.** Add tactical/strategic presets,
   aggregate and context-map builders, advisory root/membership/reference
   diagnostics, documented context-relationship roles and workbench examples.
   Demonstrate both a port-bearing context map and an expanded portless boundary.

For each implemented slice: focused behavior/geometry tests, complete workspace
typecheck/check/test gates, strict packed-consumer qualification, TypeDoc/API
examples and browser evidence for the visible portion. Retest selection, drag,
resize, port snapping/reconnection, collapse projection, Undo and cache toggles on
new shapes. Add performance measurement if renderer complexity changes enough
to affect the existing large-graph benchmark; do not equate a screenshot with
functional qualification.

Proposed success measure for the first rendered slice: one C4 context-to-container
authoring task completed entirely through public package APIs, followed by a DDD
aggregate task in slice three, with reload fidelity and one-step insertion Undo.
Baseline is currently unknown; record consumer glue required and completion
failures. The first packed-consumer/browser qualification is the measurement
window. Reshape before the next slice if this requires private imports, host-data
overwrites, incorrect edge geometry, duplicated editing state or compatibility
loss. A general multi-view architecture repository, deployment modelling,
Structurizr interchange, automatic code discovery and publication are outside
this appetite and need their own decisions.

**Recommended next:** review the
[Mermaid/agent/edition assessment](2026-11-08-flow-mermaid-agents-and-editions.md)
and its bounded interoperability spike. Broader pattern insertion and DDD
authoring remain queued through the same package APIs; the assessment implements
neither capability.
