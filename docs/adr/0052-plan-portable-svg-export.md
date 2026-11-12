# ADR 0052: Plan portable SVG export before writing files

## Status

Accepted for the approved E3 contract slice, 2026-11-12. Boundary verdict:
**safe with noted risk**. Architecture, delivery and test-quality reviews are
self-review. PNG, SVG serialization, downloads, browser capture adapters, dependency
adoption, publication and Alchemy integration are outside this slice.

## Context and decision

Zloz needs a reusable image-export boundary before browser or raster adapters.
Canonical graph data cannot reveal which HTML shells, badges, inherited CSS,
external images or custom geometry a host uses. A developer screenshot script is
neither the public API nor proof of portable output fidelity.

Core exports `planSvgExport(snapshot, options)` plus bounds, region, renderer,
font/asset, theme, finding and plan types. The function is synchronous and pure,
validates/detaches the canonical graph and configuration, and never touches editor,
selection, gesture, camera, history, DOM, filesystem, network or browser APIs.
Plans are ephemeral projections, not a new graph wire format or a permission token.

The host explicitly chooses:

- Whole-model authored bounds with non-negative world-space padding; camera crop
  with a required camera and CSS-pixel surface size; or a positive finite explicit
  world rectangle. Scale changes output dimensions, not the world viewBox.
- Light/dark palette resolved from the existing shared themes, with an export paint
  subset and numeric edge width. Background is theme, transparent or explicit paint.
- Literal font family/size/weight and optional declared font asset identity.
- Built-in or unknown renderer coverage for nodes and edges, plus per-item overrides.
  Node declarations cover body/ports/badges; edge declarations cover paths/labels/markers.
  Host-only overlays are outside canonical-model output.
  Overrides specify canonical fallback, intentional omission, unsupported content,
  or a named/versioned SVG adapter with world-space bounds and a fidelity declaration.
- Resource declarations with identity, image/font/stylesheet kind and host-declared
  embedded/external/missing availability. The planner neither fetches nor verifies bytes.
- A non-blank accessible title and optional description, retained as literal text.

## Bounds and fidelity

Whole-model nominal content bounds union authored node/group envelopes, authored
edge bends and declared custom SVG bounds. Empty models use a finite 1×1 world
artboard. Padding is explicit; it does not magically measure text ink, port artwork,
strokes, self-loops/custom curves or transient layout routes. Automatic model bounds
therefore carry `bounds-estimated`. This is a planning contract, not tight-fit proof.

Viewport scope means a crop of the canonical model, not a snapshot of UI filtering,
collapsed presentation or retained DOM. Keep off-screen nodes/edges in the plan so
crossing edges can be clipped by a later writer rather than dropped by endpoint
filtering. Every plan specifies clipping at its viewBox. Explicit crops intentionally
retain their chosen dimensions; the planner does not silently expand them.

Theme paints support literal hex (3/4/6/8 digits), `none`, `transparent`, and bounded
space-separated numeric `rgb(...)` with optional numeric alpha. CSS variables,
external URLs, host-inherited colors and unsupported paint syntax produce a
blocking finding, with the original value retained for review. Edge width resolves
to a positive finite number or null with a blocking finding. Export themes cover
only declared paint tokens and edge width, not live stylesheet/layout reproduction.

System fonts are not embedded. Declared embedded resources still need writer byte,
glyph and resource validation. Text wrapping and ink bounds remain unverified.
No custom adapter becomes qualified merely because the host says `equivalent`:
all named/versioned SVG declarations report `renderer-unverified`; approximate
adapters also report loss. Fallback, omission and connections to omitted nodes
carry item-addressed loss reasons. Omission affects the declared graphic only,
never recursively deletes graph content or rewrites endpoints. Unknown renderers,
external/missing assets and unresolved paints block. Findings sort by stable item
identity/code, independently of manifest order.

A plan is `blocked` if any finding is unsupported, otherwise `reviewable`. Neither
status means a file exists or visual fidelity is proven. A future writer must bind
the exact declared adapters/resources, escape literal text/attributes, honor bounds,
theme and clipping, and surface its own qualification/loss findings. PNG comes after
that SVG boundary and real emitted-file/browser qualification, with pixel budgets.

## Alternatives and consequences

DOM cloning would couple the core package to a browser and inherited host resources;
it would also encourage misleading screenshot parity claims for HTML/custom nodes.
App-only export would violate package ownership. Immediate SVG/PNG generation would
combine planning, adapters, resource loading, fonts and raster limits before those
contracts are reviewable. A pure plan keeps these responsibilities separate.

Costs: hosts must declare renderer coverage honestly; canonical graph data cannot
audit omitted host decoration. Bounds are nominal until measured/qualified by a
writer. The plan includes a detached graph, which has unqualified large-model cost.
Paint support is deliberately smaller than all CSS. There is no exact-fidelity or
performance claim. The public declaration vocabulary requires compatibility review
if changed after consumers adopt it.

## Implementation and verification

- Add `src/svg-export.ts` and exports in core `src/index.ts`, without optional UI peers.
- Reuse graph validation/copy and existing light/dark palettes. Keep IO outside core.
- Test independent numeric model/viewport/explicit bounds, nested groups/ports/labels,
  authored bends, empty artboards, theme resolution and background independence.
- Test per-item unknown/custom/fallback/omit behavior, duplicate/missing manifest
  targets, font/assets, invalid/overflowing numbers, detachment and unchanged editor.
- Exercise positive/negative public types and runtime under actual packed Node/Bun
  consumers. Generate TypeDoc and run root lint/format, typecheck and all tests.
- Update package docs/roadmap and record the local evidence separately from future
  emitted SVG, visual/device, hosted or registry qualification.

Before release rollback is a local commit revert, with no data migration. Next:
implement the bounded SVG writer and representative emitted-file/browser evidence
from this contract. Keep PNG and Alchemy deferred.

**Approved follow-up:** [ADR 0053](0053-write-svg-through-typed-primitives.md) implements
the bounded writer with typed adapters and emitted-file/browser evidence. The planning
record above retains its original scope; resource embedding and PNG remain deferred.
