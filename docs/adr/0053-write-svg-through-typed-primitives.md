# ADR 0053: Write standalone SVG through typed primitives

## Status and scope

Accepted for the approved bounded SVG writer slice, 2026-11-12. Extends
[ADR 0052](0052-plan-portable-svg-export.md). Boundary review: **safe with noted risk**.
Architecture, delivery and test-quality reviews are self-review. Core remains
peer-free. PNG, resource-byte embedding, arbitrary SVG/HTML/CSS, download UI,
publication and Alchemy are outside this slice.

## Decision

Expose `writeSvgExport(snapshot, options, writing)` in core. It always rebuilds its
plan rather than accepting a caller-mutated plan as authority. Unsupported planning
findings block output; losses require explicit `allowLosses: true`. Unverified fonts,
nominal bounds and host adapter fidelity remain in the final findings after writing.
`written` means a standalone SVG string exists, not that every consumer/font/browser
will reproduce an application's DOM. A blocked result contains no partial SVG.

Canonical output draws depth-ordered group outlines, edges/markers/labels, then node
outlines and labels/ports. Geometry reuses the core outline, port and edge resolvers,
including authored bends and path styles. C4/DDD/EventStorming metadata is static
text on nodes, with shared theme colors. DDD/EventStorming edge notation and side-role
artwork require an adapter or explicit semantic-edge-fallback loss acknowledgement;
a generic directed arrow does not preserve those conventions. Titles, descriptions, labels and identifiers are
escaped for XML; invalid XML characters reject. Background, dimensions/viewBox and
world clipping follow the fresh plan. Internal fragment references use a validated
prefix; callers embedding several files inline must supply distinct prefixes.

Custom declarations bind adapters by exact ID/version. Callbacks receive frozen,
owned node or edge context, theme and font data. Adapters must be pure synchronous
functions returning non-empty typed primitive arrays in world coordinates. They are
trusted host functions, not sandboxed code. Renderer mutation/failure, unsupported
fields/tags, invalid geometry/paints or exceeded budgets block atomically. Omission
must be declared in the plan. The final findings, not only planner findings, are
required review data.

The vector vocabulary is rect, circle, line, polygon, polyline, text and translated
groups, with literal fill/stroke, width and opacity. Text supports multiline spans,
anchor, size and weight. There is no raw markup/path string, arbitrary attribute,
CSS, URL, script, image/use reference or foreignObject. Custom complex paths and
resource-backed artwork are unsupported until a separately reviewed adapter exists;
this limitation is visible rather than silently converted to browser HTML.

External/missing resources already block planning. Host-declared embedded resources
also block this writer because declarations contain no byte-validation contract.
Nothing is fetched. Resource embedding needs its own format/resource validation and
qualification. System-font substitution/metrics remain unverified; literal family
names are quoted safely while standard generic families retain their meaning.

Limits default to 10,000 drawing primitives, depth 32 and 2,000,000 output UTF-16
code units. Canonical paths and custom primitives share the drawing budget; fixed
SVG infrastructure is outside that count. The character limit is checked on the
constructed output, not a peak-memory promise. Large-model copying/serialization
performance remains unqualified.

## Alternatives and consequences

DOM cloning/foreignObject would couple portability to browsers, live CSS and HTML.
Raw SVG strings would require a much broader parser/sanitizer and resource policy.
A typed vocabulary keeps serialization ownership in the package and makes rejected
features explicit. Costs are deliberate vocabulary/resource limits and a future
compatibility obligation for the public primitive/adapter API.

No graph/snapshot/model wire format changes, editor update, Undo transaction or IO
is introduced. Malformed writer configuration throws the existing core error;
rendering/qualification failures return blocked findings. Rollback before release
is a local commit revert without migration.

## Implementation and verification

- Add `svg-writer.ts` and core exports. Share internal literal-paint validation.
- Test escaped standalone output, geometry/ports/labels, custom binding/version,
  missing/failed adapters, mutation isolation, loss acknowledgement, unavailable
  resources, invalid XML/paint/geometry, unexpected fields and recursion/size limits.
- Exercise actual packed Node/Bun consumers, including a negative raw-markup type.
- Generate light, dark/custom, viewport and transparent representative SVG files.
  Open real files in Chromium; check XML parsing, paths/text, nested groups/ports,
  crop size, background, no active markup/external requests, and inspect captures.
- Run root lint/format, typecheck, all tests and TypeDoc. Keep emitted-file/browser
  qualification separate from hosted, registry, performance and manual AT evidence.

Next: compose package-owned SVG review/download controls in the workbench, retaining
findings, explicit losses, region/theme/background choices and minimal-mode behavior.
PNG and Alchemy remain deferred.
