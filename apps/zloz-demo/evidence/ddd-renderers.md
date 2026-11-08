# DDD preset renderer qualification — 2026-11-08

- **result:** complete
- **claim:** package-owned DDD node/group views cover the eight existing semantic roles; the workbench composes an Order aggregate example in light/dark.
- **evidence:** source/packed-consumer tests, workspace check/typecheck/tests, production build, generated TypeDoc, and the [local Chromium transcript](ddd-renderers-browser.json) with inspected screenshots below.
- **remaining uncertainty:** local qualification only; no deployed update, npm publication, full assistive-technology campaign, typed DDD relationships or durable history implementation.
- **next:** define the durable history contract and implement named editions/read-only rewind, with opt-in comparison ghosts following Tech Radar.

Recommendation: **needs follow-up** for the next history slice; the renderer slice
is locally qualified and ready for review. Architecture, delivery and test review
were self-review, not independent agent review.

## Delivered boundary

`@opsydyn/foldkit-zloz/foldkit` exports `zlozDddNode`, `zlozDddGroup`,
`ZlozDddContentContext`, `ZlozDddContentRenderer`, `ZlozDddNodeOptions`. Inert badge,
role, name, subdomain, description and body slots are separate from live controls.
Native sockets remain outside retained artwork, and custom sockets from the
render context are preserved. The core root and version-1 wire format do not
change. Aggregate/context groups remain portless; normal context nodes connect.
Default group headers are compact and descriptions remain available to custom
slots. DDD notation colors are not prescribed.

The workbench adds **Open DDD Order aggregate**, a DDD node-design option, a
catalogue-derived eight-role legend and a custom consistency-owner badge. Edges
express authored examples through labels, not a new relationship schema or
executable invariant. The renderer decision is recorded in
[ADR 0017](../../../docs/adr/0017-add-composable-ddd-preset-renderers.md).

## Verification

Baseline `bun typecheck` and `bun run check` exited 0 before implementation.
The first renderer test run failed because `zlozDddNode` did not exist. The final
focused C4/DDD renderer run passes **8 tests / 90 assertions**; demo tests pass
**15 tests / 102 assertions**. Tests cover all roles, other-family fallback,
canonical cylinder geometry, portless boundaries, scoped themes/minimal mode,
content omission/replacement, accessible native selection names, read-only/source
feedback outside cached artwork, JSON round trips and Undo.

`bun typecheck`, `bun run test` and `bun run check` pass. The root suite includes
installed tarballs under Node/Bun and TypeScript consumer checks; the packed DDD
consumer imports both renderers and custom options without private source paths.
The final presentation and fixture refinements were followed by focused type/
renderer/demo checks and a rebuilt production workbench. TypeDoc generates both
DDD functions and the three renderer types in the optional Foldkit module.

The [browser script](ddd-renderers-browser.mjs) exercises the production static
build, actual native controls and JSON downloads. It verifies custom badge,
retention/focus/DOM identity, keyboard movement, node/group resizing, connection
creation, collapse/expand, Undo, minimal mode and document-preserving theme
switches. Initial visual inspection found crossing example edges; authored port
placement and a stepped repository edge corrected that presentation. An initial
browser run timed out waiting for export in Minimal mode. That existing workbench
presentation omits the Export JSON control; the corrected harness verifies its
absence and explicitly leaves Minimal mode for document comparisons. The exporter
was not changed.

No deployment or publication command was run. Historic compatibility qualification
is unchanged; this slice adds views over descriptors already supported by the
canonical codec.

## Visual evidence

Inspected locally at 1600 × 1100 in Chromium, with reduced motion enabled:

- [Light workbench](ddd-workbench-light.png)
- [Dark workbench](ddd-workbench-dark.png)
- [Light canvas](ddd-order-light.png)
- [Dark canvas](ddd-order-dark.png)

Both themes preserve role text, authored outlines, sockets, readable group bounds
and the persistent-canvas/sidebar composition. This is browser and visual evidence,
not comprehensive accessibility certification or cross-browser qualification.
