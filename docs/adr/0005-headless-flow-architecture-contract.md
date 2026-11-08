# ADR 0005: Add headless architecture descriptors and shape geometry

## Status

Accepted for the first local implementation slice on 2026-11-08 following user
approval of the architecture plan and explicit approval to implement its headless
contract. This records that approved scope; renderers and pattern insertion remain
separate follow-up slices. Related: ADR 0003 and ADR 0004.

## Context and options

Consumers currently encode architecture meaning in arbitrary `data` and supply
custom views. Putting another application's convention into that field would
collide with existing host data. Overloading `kind` would break its current
portless-group meaning. A separate architecture store/package would duplicate
identity, validation and history. We choose additive typed node descriptors in
the existing dependency-free package root.

C4 is notation independent: semantic role and appearance must be separate.
Geometry has to define more than an SVG silhouette: default anchors, routing
projection and containment must describe the same outline. Existing authored
normalized anchors are deliberate and must remain unchanged.

## Decision

- Add optional `FlowNode.architecture` and `FlowNode.appearance`. Architecture is
  a closed discriminated C4/DDD union. Description is optional; C4 technology
  belongs to containers/components; DDD subdomain classification belongs to
  bounded contexts. No cross-view identity or business-invariant enforcement is
  inferred. New descriptor objects reject unknown keys and invalid values.
- Catalogue four C4 roles and eight DDD roles. An aggregate is a portless group;
  groups can represent C4 system/container or DDD aggregate/context boundaries.
  Normal contexts remain connectable nodes. Group appearances are rectangular
  in this slice, preserving current collapse/boundary behavior.
- Ship rectangle, rounded-rectangle and cylinder geometry. A future Person
  renderer uses a person adornment inside a rounded card; a disconnected human
  silhouette is not an additional outline contract. A semantic role alone does
  not change existing geometry. Explicit `appearance` opts into shape geometry.
- Geometry returns local bounds, content bounds and an SVG outline; separate
  pure functions return world boundary intersections and point containment.
  Rounded radius is `min(12, width/2, height/2)`. Cylinder cap radius is
  `min(16, width/4, height/4)`. Its content sits between the two cap interiors.
  Width/height remain the layout/selection envelope. Marquee and grouping use
  that envelope, while consumers can use outline containment for precise hits.
- Side/offset ports without explicit anchors intersect the chosen outline along
  their cardinal routing direction. Explicit normalized anchors keep their exact
  authored location; routing-boundary projection uses the shape intersection.
  Shape changes do not reset ports. `PortAnchorReset` explicitly replaces an
  authored anchor with the same side at offset 0.5 through existing port policies
  and Undo. Port snapping continues to author normalized envelope coordinates;
  it does not pretend every authored anchor lies on a curved outline.
- Native port positioning and anchor handles use the same node-aware canonical
  anchor as headless edges/previews. Existing one-argument `portAnchor` retains
  its rectangular semantics for callers without a node.
- Node architecture/appearance changes use typed events, optional host vetoes,
  current read-only/gesture gates, detached JSON and `commitGraph`. Exact no-ops
  produce no revision/history. Accepted changes invalidate stale layout/routes,
  cancel pending connections and commit one Undo step. A null descriptor removes
  the property. Changing semantics does not implicitly change appearance.
- Keep document version 1: new fields are optional and have no meaning for old
  consumers. Prove this against the pinned pre-change core at `ce978a2`, including
  legacy rename/move/copy/export. Old consumers display generic nodes and use old
  rectangular geometry; they do not understand shapes. No claim extends to
  unrelated third-party serializers or future descriptor extensions.

## Consequences and limits

No runtime dependency or new package is added. A standalone validated node factory
chooses a catalogue appearance unless one is supplied; caller IDs, dimensions,
ports and data remain caller-owned. Parenting/group assembly is a subsequent
graph operation. This factory returns detached document values.

Default `/foldkit` views still draw generic nodes in this slice; headless shape
geometry is for consumers composing an outline. Preset renderers, semantic edge
descriptors, advisory relationship/root diagnostics and atomic pattern insertion
are not advertised as implemented. Unknown descriptor fields/roles in a future
reader require an explicit compatibility decision rather than silent guessing.

Rollback is reverting this additive API before publication. Documents containing
these fields remain retainable by the pinned previous core, with generic
rendering/geometry; record that limitation rather than claiming visual parity.
Revisit when adding custom outlines, shaped groups or multi-view references.

## Implementation and verification

- `types.ts`, `architecture.ts`, `architecture-node.ts`: typed catalogue,
  descriptors, strict guards, group-role invariants and detached factory.
- `graph.ts`: validate descriptors for both parsed and programmatic graphs.
- `node-shape.ts`, `geometry.ts`: outline, content, containment, default anchors
  and routing projection; retain explicit-anchor overrides and legacy rectangles.
- `editor.ts`: transactional descriptor changes, fresh host policies, explicit
  reset through the existing port edit path; adapt anchor editing to node-aware
  geometry without introducing a second state store.
- Port composition/context/handles: use canonical node-aware anchors.
- Tests: literal old/new v1 fixtures, malformed values, geometry at corners,
  small dimensions and after resize, edit/clear/no-op/rejection, history,
  stale-layout rejection, preserved host data and explicit anchors.
- Qualify the pinned old reader/editor and strict packed root consumer. Build
  TypeDoc, run full workspace typecheck/check/test, document results and commit.

This ADR has a single owner: the current package slice. The first rendered C4
slice must qualify visible outline/port alignment and keyboard/resize interactions
before claiming default architecture presentation support.

## Local verification, 2026-11-08

- [x] Literal v1 fixtures preserve host data and descriptors; the pinned old core
      retains them through rename/move/copy/paste/Undo/export.
- [x] Invalid roles/fields/groups fail atomically; policy vetoes and read-only
      gates preserve graph/history; no-ops preserve revision.
- [x] Canonical ports, SSR controls and shape geometry agree, with explicit
      anchors preserved through changes and resize.
- [x] Real ELK and force regressions pass. Force leads explicitly clear the
      conservative envelope before routing from a curved outline.
- [x] Strict packed root consumer compiles in Bundler/NodeNext with exact optional
      properties and runs on Node/Bun without FoldKit or Effect installed.
- [x] Workspace typecheck/check/test and warning-strict TypeDoc generation pass.

See [qualification](../assessments/2026-11-08-flow-headless-architecture-qualification.md)
for the regression history, source evidence and remaining rendered acceptance.
