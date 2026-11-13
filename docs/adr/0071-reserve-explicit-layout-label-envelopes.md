# ADR 0071: Reserve explicit layout label envelopes

## Status

Accepted for the approved package-level label-bounds slice, 2026-11-13.
Architecture, boundary and test-quality reviews are **self-review**.

## Decision

Add optional `edgeLabels` to `LayoutRequestOptions` and `LayoutRequest`. Each
entry identifies an existing edge and declares one positive finite world-unit
`Size` for the entire composite label (including badges/editors). `layoutRequest`
copies these hints; `validateLayoutRequest` validates typed engine inputs. Omitting
options preserves the previous request shape. This is not a raw-data decoder.

`EdgeRoute.label` returns a `LayoutLabelBox`: a world-coordinate center and size.
Core validates all requested envelopes and their matching routes before publishing
any geometry. Missing, unexpected, duplicate or mismatched bounds fail atomically;
stale results retain existing ignore semantics. Writable application remains one
Undo; detached read-only application preserves past/future. No graph serialization,
source metadata or wire version changes. Bounds and routes are transient.

The optional ELK adapter supplies explicit CENTER label envelopes and reads labels
in ROOT coordinates, just like route points. Synthetic engine IDs avoid source-ID
collisions. ELK skips positioning empty-text labels, so custom badges on unlabeled
edges use a private nonempty sizing token. Authored label text and renderer content
remain untouched. Returned label identity, dimensions and finite coordinates must
match the request. See ELK's [label placement](https://eclipse.dev/elk/reference/options/org-eclipse-elk-edgeLabels-placement.html)
and [edge coordinate](https://eclipse.dev/elk/reference/options/org-eclipse-elk-json-edgeCoords.html)
contracts.

Shared edge geometry uses a retained label center only while using the layout
route. Authored waypoints/path styles and collapsed endpoint projection take
precedence; a custom geometry policy remains authoritative. Foldkit label and
waypoint controls share the resolver. Fit/reveal and viewport culling include retained label envelopes.
SVG/PNG export remains based on authored graph geometry, with existing layout-route
fidelity findings; transient label bounds do not silently enter export documents.

The workbench declares 176 by 36 units per relation badge and renders a matching
fixed box containing text plus a source/DDD tag. Renderer and request share a pure
size constant. Long text ellipsizes with full text in the title. Layout stays
explicit and lazy; original-geometry reset removes transient routes. Commands own
ELK effects; no DOM measurements or hidden mutable state are introduced.

## Alternatives and consequences

Automatic text estimation would not represent arbitrary badges or inline editors.
DOM measurement belongs in a separate opt-in adapter with stale-result handling.
Persisting engine coordinates in source descriptors would compromise provenance.
A single envelope is intentionally smaller than multiple independently placed
label contracts. Other engines must return requested bounds or application fails;
force layout does not gain label support here. Supplied dimensions must match the
renderer. This is space reservation, not a universal collision guarantee for all
routing policies, oversized renderers, group headers or arbitrary graphs.

## Acceptance and rollback

Test explicit/legacy hints, invalid dimensions/IDs, missing and unexpected boxes,
stale rejection, detached bounds, geometry-policy precedence, fit and history
preservation. Run real ELK compound layouts in RIGHT/DOWN, including unlabeled
edges; installed-consumer type/runtime qualification; workbench command/source
preservation; browser rendered badge/leaf-node overlap checks and light/dark
captures. Run root typecheck, check and tests, package checks and production build.
Revert the local commit to roll back; no external resource or publication changes.
