# Custom port anchor qualification

Local Chromium qualification on 2026-11-05 using the built sample. The **Port
anchors** selector authors a diagonal circle-perimeter preset through one public
core edit. Its value follows the document, including Undo and Redo.

- [Card anchors](port-anchors-cards.png)
- [Circle-perimeter anchors](port-anchors-orbits.png)
- [Matching preview](port-anchor-preview.png)

Both card and SVG node designs passed browser journeys for:

- Actual port-center and SVG path-end agreement within one CSS pixel, including
  the card's visual border and padding.
- Preset editing as one Undo/Redo step, with selector/document agreement.
- Anchor rescaling during width/content-height changes and tracking node movement.
- Preview/committed curve equality on a new connection and target reconnection.
- Reachable reconnection controls outside the node's visual box.
- Real ELK and force layout preserving authored anchor data and endpoint agreement;
  Undo restores the prior layout with the same anchors.

No page runtime errors were observed. The sample's shared geometry function uses
side-aware cubic tangents for custom anchors, keeping the visible approach to
circle-perimeter ports clear of the node artwork. Legacy raised curves retain
their existing presentation. This example is not a general custom-shape obstacle
solver.

Reproduce from the repository root:

```sh
bun run --filter @opsydyn/flow-sample build
cd apps/web
node --input-type=module <../flow-sample/evidence/port-anchors-browser.mjs
```

The harness uses the existing web Playwright dependency and a temporary loopback
server, closes resources and writes screenshots under
`/tmp/foldkit-flow-port-anchor*.png`. Existing node/group composition journeys
also passed after the frame coordinate-plane separation.

Package tests cover finite/range/exclusivity validation, legacy and new document
round-trips, atomic edits/no-ops, detached caller coordinates, read-only/gesture
protection, stale layout invalidation, thick visual borders, all four boundary
hints under real ELK, force routing leads and layout Undo. The packed consumer
checks public anchor helpers and editing, along with the shared renderer and
layout adapter contracts. TypeDoc includes the new public types and functions.
Outside-box coordinates, arbitrary routing normals and painted-shape obstacle
inference remain outside this slice.
