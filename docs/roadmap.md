# FoldKit Experiments Product Roadmap

This roadmap turns the two packages into a coherent FoldKit data-application stack:

- `@opsydyn/astro-foldkit` owns Astro rendering, hydration, navigation, and island lifecycle.
- `@opsydyn/foldkit-viz` owns pure chart math and FoldKit-compatible interaction primitives.
- `apps/web` is the reference product and integration test surface.

## Roadmap Ownership

This file is the canonical cross-package product roadmap and release sequence.
[`ROADMAP.md`](../ROADMAP.md) is the supporting `foldkit-viz` chart inventory,
primitive-parity audit, and implementation history. It links here for product
priorities rather than duplicating their status.

Current packages target FoldKit `0.170.x`, Effect `4.1.x` and the
`@foldkit/vite-plugin` `0.29.x` line. Published: astro-foldkit `0.13.0`, foldkit-viz
`0.17.0`, effect-three `0.6.4` and the Zloz family `0.3.0`. Earlier compatibility
notes remain in the [0.167 migration guide](migrations/foldkit-0.167.md) and the
[0.169 notes](releases/foldkit-0.169.md); the [0.170 guide](migrations/foldkit-0.170.md)
covers Effect 4.1, route `Transition` and `AsyncData.matchDataSplitEmpty`.

## Viz: data-science release track — 2026-11-13

**Goal:** make foldkit-viz the first choice for data-science and engineering charts on
the web, with a clear reason to pick it over Plotly, Vega-Lite and Observable Plot.

**Where it stands.** The primitives are close to D3: scales, curves, shapes, map
projections, hierarchy layouts, force simulation, Voronoi, contours, KDE, binning
and colour schemes. The chart layer on top is thin:

- The Cartesian layer draws linear axes only; log, symlog and time axes are not
  possible, and time ticks and labels use local time only.
- About eight chart geometries ship: line, scatter, histogram, bars, error bars,
  interval band, segments and orbit. Around 45 full charts exist only as `apps/web`
  demos.
- There is no grammar of marks, channels and facets, which is what makes Plotly
  Express, Vega-Lite and Observable Plot fast to use.
- Regression, ECDF, QQ and hexbin are missing, and nothing renders beyond SVG,
  which struggles past about 10,000 marks.
- Interaction primitives (brush, zoom, selection, nearest-by-x) exist but are not
  composed into linked views.

**Where we can win:** server-rendered charts that ship no JavaScript until they are
interactive; accessibility by default; typed, pure, testable geometry; and a planned
JSON-serialisable spec that suits generated charts and other languages.

**Release status:** 0.18.0 to 0.22.0 are complete on the `feat/viz-roadmap-scales`
branch and not yet released. 0.21.0 meets two of its three exit criteria; see below.

### 0.18.0 — Foundations (next release)

- [x] Scale-generic Cartesian layer: x and y take linear, log, symlog, power or time
      scales, and ticks and default labels follow the scale. Time axes default to UTC so
      server and browser agree. Existing configurations are unchanged.
      [Design](superpowers/specs/2026-11-13-scale-generic-cartesian-design.md).
- [x] Statistical transforms: least-squares linear and polynomial fits with
      confidence bands, LOESS, ECDF, QQ quantiles and moving windows.
- [x] Two-dimensional binning, rectangular and hexagonal, feeding a cell geometry.
- [x] Cell geometry (`chart/cells`) for the heatmap, calendar-heatmap and
      correlation-matrix shapes. Moving those demos onto it did not happen in 0.19.0
      and carries to 0.21.0.
- [x] Downsampling for long series: LTTB and min-max (M4).

**Exit criteria:** the web app shows a log-scaled time series, a regression with its
confidence band and a 100,000-point series downsampled to the plot width, each
server-rendered with axes from the chart layer.
Met by the web app's `/data-science` page, which adds a hexagonal density view.

### 0.19.0 — Grammar of marks (design first)

- [x] Specification and ADR: marks (dot, line, area, bar, rule, text, cell), channels
      (x, y, fill, stroke, r, title), scales and legends inferred from channels, facets
      for small multiples, and layered marks on shared scales. Box, density and link
      marks and a symbol channel move to the promotions below. Box and link shipped
      there; the density mark and the symbol channel did not, and carry to 0.21.0.
- [x] A declarative, JSON-serialisable spec rendered through the same pure geometry,
      server-rendered by default. [ADR 0037](adr/0037-a-declarative-grammar-of-marks-for-foldkit-viz.md);
      `compilePlot` and `foldkit/plot`, shown on the web app's `/plot-grammar` page.
- [x] Promote box and violin, candlestick, parallel coordinates, treemap and
      sunburst, and sankey from the demos as marks: `box`, `violin`, `link` with
      interval bars, `parallel`, `treemap`, `sunburst` and `sankey`.

**Exit criteria:** each promoted demo is re-expressed as a spec, and its web-app page
is rebuilt from the library.
Met: the seven demos on the web app's `/charts` page are now plot specs, pre-rendered
with no JavaScript, and their bespoke chart modules are removed. Their hover
highlights became native tooltips; interaction in the spec is 0.20.0 work.

### 0.20.0 — Scale and interaction

- [x] Optional canvas painting for dot, line and cell marks from the same geometry,
      as an adapter beside the FoldKit one; the geometry stays renderer-agnostic.
      `dense` dot marks compile to packed typed arrays; `canvas/plot` paints any
      geometry, and `plotCanvas` puts the canvas under an SVG overlay.
- [x] Hit-testing, two-dimensional nearest hover and a crosshair. `indexPlot` uses
      a uniform 16-pixel grid built by counting sort rather than a quadtree: it
      builds in linear time over typed arrays and answers a query from nearby cells.
- [x] Linked brushing across views through a mark's `highlight`, which dims rows
      outside a range or set of values. This closes the linked-view item of the
      Viz interaction layer below.
- [x] Zoom and pan bound to the chart scales: `invertPlot` and `invertAxis` map
      pixels back to data, and a zoomed domain is written back into the spec.

**Exit criteria:** a one-million-point scatter linked to a histogram, hovering within
one frame.
Met by the web app's `/explore` page. Measured in headless Chromium against the dev
server on 2026-11-13: compiling the dense scatter takes 173–200 ms, indexing it about
40 ms, and a nearest query about 0.008 ms. Hover from pointer move to painted overlay
has a median of 2–4 ms and a 95th percentile of 16 ms, at the edge of one frame;
a production build should have more headroom. Moving the brush recompiled the
scatter: 500–570 ms from pointer release to painted canvas. (An earlier figure of
680 ms included a fixed wait in the measuring script.) 0.21.0 makes it incremental.

### 0.21.0 — Cartesian coverage

At the start of this release, seven of the web app's chart demos shipped from the
library; about 40 chart modules still lived in `apps/web/src/ui`, built on the library's primitives but not exported.
This release moves every chart on x and y axes into the grammar.

- [x] Carried from 0.19.0: a symbol channel on dot marks, drawn with `shape/symbol`
      and shown in the legend; and a `density` mark, a one-dimensional kernel density
      drawn as an area and outline, with a two-dimensional form drawn as contour lines
      computed in plot pixels.
- [x] Stacking and grouping: `stack` on bar and area marks, with zero, normalised,
      diverging and wiggle offsets (the last for streamgraphs), and `group` on bar
      marks for side-by-side series, reusing `shape/stack` and the chart layer's
      grouped bars.
- [x] A `bin` transform on a new `rect` mark: histograms from raw rows by threshold
      count or explicit thresholds, and two-dimensional rectangular histograms, so a
      histogram needs no pre-binned data. Hexagonal binning stays in `chart/cells`:
      hexagons tile only in pixel space, which the grammar reaches after scales.
- [x] Highlight without recompiling: `highlightPoints` restyles a dense mark's
      compiled geometry and keeps its hover index valid, and the canvas painter draws
      tiny points as squares. The `/explore` brush fell from 500–570 ms to 84–107 ms,
      not to one frame; see the exit criteria.
- [x] Promote the demos the grammar expresses today: area, bar, bubble, bullet,
      bump, calendar heatmap, correlation matrix, curve comparison, diverging bar,
      heatmap, line, log scatter, scatter, threshold bar, tile-grid map, timeline,
      waterfall and zoomable line. The three cell demos close the 0.18.0 cell item.
- [x] Promote the demos that need the features above: diverging stacked bar,
      streamgraph, histogram, histogram brush, symbol scatter and density contour.

**Exit criteria:** those 24 demos are plot specs, rendered on the server, and their
modules in `apps/web/src/ui` are removed. The interactive ones (histogram brush and
zoomable line) keep their interaction through overlays and the 0.20.0 helpers, not
bespoke modules. The `/explore` brush highlights within one frame.

Two of three met. All 24 demos are specs, and 22 `ui` modules are removed;
`histogram-chart` and `scatter-chart` stay because the linked-charts,
request-diagnostics and comparison reference apps use them. Zoomable line and
histogram brush are small apps over specs. Small additions the demos needed:
`clip`, `axis: false`, and constant marks such as reference rules drawing once.

Not met: the `/explore` brush takes 84–107 ms from pointer release to painted
canvas (headless Chromium, dev server, 2026-11-14), of which 57–77 ms is the
canvas rasterising a million squares. One frame needs GPU drawing or a separate
highlight layer, which moves to Later.

### 0.22.0 — Beyond Cartesian

[Design](superpowers/specs/2026-11-14-plot-beyond-cartesian-design.md).

- [x] Polar coordinates: a plot-level `coordinates: 'polar'` maps x to angle and y
      to radius, so bars become radial bars and wind roses, and a line or area over
      categories closes into a radar. Sectors centre on their category. An `arc`
      mark gives pie, donut and gauge: slices in row order over a sweep from `start`
      to `end`, rather than a separate pie transform.
- [x] A `geo` mark over GeoJSON features through a plot-level projection, fill from
      a feature property for choropleths, and a `graticule` mark. Dots and text
      place longitude and latitude through the projection. Zoom is the projection's
      `zoom` and `center`, not the 0.20.0 domain helpers, which suit axes.
- [x] Network and tree marks: `tree` (tidy or cluster, left to right or radial),
      `pack`, `chord`, `arc-diagram` and `force`. The force layout runs a seeded
      simulation to a fixed count at compile time, so the output stays static
      geometry.
- [x] A `voronoi` mark for cells around points. Building it found that the
      Delaunay port's orientation test had the wrong sign, so triangulations were
      not Delaunay and Voronoi cells missed their sites; that is fixed, with a
      regression test.
- [x] Promote radar, wind rose, donut, gauge, choropleth, zoomable choropleth, map
      projections, chord, arc diagram, force graph, packed circles, tidy tree, radial
      tree and Voronoi.

**Exit criteria:** every chart demo is a library spec except the three that
showcase primitives rather than charts (easing curves, colour spaces and
phyllotaxis), and `apps/web/src/ui` holds no chart modules.
Met, with the exception 0.21.0 recorded: `histogram-chart` and `scatter-chart`
remained for the linked-charts, request-diagnostics and comparison reference apps.
They are now removed too; see "Reference apps on plot panels" below.
Also fixed along the way: world maps no longer draw a stripe where a country
crosses the antimeridian.

### Reference apps on plot panels

[Design](superpowers/specs/2026-11-14-plot-panel-design.md).

- [x] `ui/plot-panel` in the web app: one interactive child over any plot spec.
      Hovering a dot reports the point, hovering a bar reports its exact bin
      range, arrow keys step through targets, and a drag on a continuous x axis
      selects a range. Parents pass `highlight` and `emphasis` back as view props.
      It is focusable, announces the active target and lists every target in a
      hidden table. Its pointer facts reach the dispatcher synchronously, so they
      keep their order with key presses and leaves.
- [x] Linked charts, request diagnostics and comparison compose plot panels,
      keeping their parent-owned inspection, brushing and machine states.
- [x] `ui/histogram-chart`, `ui/scatter-chart` and the shared helpers only they
      used are removed.

**Exit criteria:** every chart in the web app comes from the grammar.
Met: `apps/web/src/ui` holds the plot panel, the carousel, and the three demos
that show primitives rather than charts (easing curves, colour spaces and
phyllotaxis). Checked in Chromium on 2026-11-14: hovering and brushing link the
charts in all three apps.

### Later — Reach

- One-frame repainting of a million points: WebGL points, or a highlight layer
  that repaints only the brushed points.
- DuckDB column input and streaming appends, after the Arrow input in "Viz: Polars
  and Arrow data" below.
- SVG and PNG export, and themes beyond light and dark.
- A Jupyter widget that renders the JSON spec.
- Three-dimensional surfaces and scatter through effect-three.

The deliberate non-goals below still hold: foldkit-viz gains no DOM or event runtime
and no dependency on `foldkit/http`.

## Viz: Polars and Arrow data — 2026-11-14

**Status:** standalone piece of work, separate from the release track above.
[Assessment](superpowers/specs/2026-11-14-polars-assessment.md), with a measured
spike.

**Outcome:** data held in Polars (Rust, Python or Bun) or any Arrow source plots
through the grammar at scale, without becoming a million row objects, and programs
in other languages can write checked plot specs.

**Where it stands:** Polars already plots on the server through `nodejs-polars`
with no library changes. A million rows reach JavaScript as Arrow in 9 ms
against 246 ms as row objects, and once data is columnar the grammar's own
per-row reads are the cost.

- [x] Columnar data input: `data` accepts a column table (names to typed or plain
      arrays, and a length) as well as rows. `read` gets a column path, and dense
      marks read typed columns directly. Transforms that write new rows keep
      writing rows. [Design and results](superpowers/specs/2026-11-15-columnar-data-design.md):
      a million-row Polars frame plots as a dense scatter in 86 ms through Arrow
      columns, against 248 ms through row objects.
- [x] An Arrow adapter typed structurally (`numRows`, `getChild(name).toArray()`),
      so flechette and apache-arrow tables plot without foldkit-viz depending on
      either: `fromArrow`, which turns 64-bit integers and dates into JSON numbers.
- [x] A JSON Schema for `PlotSpec`, generated from the types and published with
      the package, with every example spec in the repo checked against it, so
      Rust (`serde`) and Python programs can emit checked specs.
      `tools/plot-schema.ts` writes `schema/plot-spec.schema.json`, published as
      `@opsydyn/foldkit-viz/plot-spec.schema.json`; the `schema-check` task fails
      in CI when the types change without it. The web app's 64 example specs
      (the gallery, the plot grammar page and the interactive apps' builders)
      all validate and round-trip as JSON.
- [ ] An example of the summary pattern: a server route that aggregates a large
      Polars frame and plots the result, beside `/explore`'s client-side million
      points.
- [ ] Later, once the columnar input exists: translate bin, stack and density
      into Polars or DuckDB queries, as VegaFusion does for Vega.

**Exit criteria:** a million-row Arrow table from Polars compiles to a dense
scatter faster than the same data as row objects, measured and recorded; a Rust
or Python program's spec is validated by the published schema; and the summary
example runs in the web app.

**Not planned:** Polars in the browser, whose WASM build is an alpha, and any
dependency on Polars or Arrow inside foldkit-viz.

## Zloz: brand and product direction — 2026-11-08

**Status:** brand migration, identity assets, promo and workbench hosting are
delivered. The remaining improvements are tracked below.

### Name and positioning

- **External product name:** **Foldkit Zloz**. Use **Zloz** in public-facing copy
  and ASCII **zloz** for future slugs, URLs and command spelling.
- **Origin:** **Złóż**, Polish for “fold, assemble, put together.” Preserve the
  accented spelling in the name's explanation; use Zloz externally for ease of
  typing and sharing.
- **Rebrand:** Flow → Zloz.
- **Identity:** “More than a flow editor. A system composition toolkit.” What
  began as a node-and-edge editor now supports composing, exploring and
  communicating complex systems.
- **Primary tagline:** “Compose systems. Connect ideas.”
- **Supporting strapline:** “Compose. Connect. Communicate.”
- **One-line description:** “Foldkit Zloz is a functional, extensible graph toolkit
  for interactive node editors, C4 architecture modelling, and Mermaid export.”

**Brand architecture:** Foldkit is the UI toolkit; Zloz is the graph and system
modelling toolkit within that family.

### Three core capabilities

| Capability      | Product promise                                                        |
| --------------- | ---------------------------------------------------------------------- |
| **Compose**     | Build interactive graphs with nodes, edges, ports and connections.     |
| **Model**       | Describe software architecture with built-in C4 modelling.             |
| **Communicate** | Export models as Mermaid diagrams for documentation and collaboration. |

### Design principles

- **Functional at heart:** pure functions, composition and immutable data.
- **Headless by design:** separate the graph model from its visual form.
- **Extensible by default:** let engineers build their own nodes, edges, layouts
  and tools without hacks or overrides.
- **Open by nature:** models should travel beyond the editor rather than remain
  trapped inside it.

### Brand and site delivery

1. **Brand and naming migration — delivered.** Public packages, imports, routes
   and API documentation use Zloz. Saved-data compatibility and deprecated
   source aliases are documented separately in the migration guide.
2. **Distinct Zloz logo and shared family identity.** Create a logo representing
   Zloz, while following the styling, typography and visual identity established
   by the Viz and Three promo sites. Define reusable assets and light/dark usage.
   Three [SVG concepts and family-header proofs](assets/zloz/README.md) are now
   available in both themes. **B — Nested frame is selected by the user**. The
   [final identity assets](assets/zloz/final/README.md) include outlined wordmarks,
   light/dark and monochrome marks, favicon and usage rules. The board uses the
   Viz/Three neutral-and-blue palette and locally bundled Inter typography.
3. **Promo site.** Build a dedicated Zloz product site in the same family as Viz
   and Three, presenting the positioning, principles and Compose / Model /
   Communicate capabilities with real package-backed examples.
   The [dedicated static shell](../apps/zloz-promo/README.md) is now implemented
   locally: selected identity, family themes, core-generated C4 preview, model/
   Mermaid downloads and a developer guide with shared Viz/Three syntax
   highlighting. [Local evidence](../apps/zloz-promo/evidence/promo.md) records
   browser and nested-base-path checks. A [native Compose example](../apps/zloz-promo/evidence/compose.md)
   now demonstrates selection, connection creation, cancel and Undo/Redo, with
   readable narrow layouts and shared highlighted source.
4. **Full demo site.** Develop an Astro-shell, native Foldkit demonstration site
   comparable in scope and navigation approach to Tech Radar. Build on the
   persistent-canvas left-sidebar workbench; expose graph composition, C4 models,
   Mermaid export, examples and API/type-contract documentation. Keep reusable
   functionality in packages and use the app to compose and demonstrate it.
5. **Cloudflare hosting.** Published and qualified: [workbench](https://zloz.opsydyn.xyz/)
   and [promo](https://opsydyn.github.io/fold-kit-experiments/zloz/).
   Both website deployments are independent of npm publication.
6. **Initial npm publication — delivered.** Core, ELK, force and Mermaid packages
   are available as `@opsydyn/foldkit-zloz*` at **0.3.0**. Future releases still
   require packed-consumer and release qualification; website delivery does not
   establish registry correctness.

The current implementation uses `packages/foldkit-zloz*` and
`apps/zloz-demo`. Its [nested Mermaid export](../apps/zloz-demo/evidence/mermaid-subgraphs.md)
and [persistent-canvas sidebar](../apps/zloz-demo/evidence/sidebar.md) provide the
local baseline for the Zloz demo. Site delivery and registry publication are
separate from that existing local evidence.

**Naming cleanup:** all four package/release identities use Zloz; the API title
is **Foldkit Zloz API**, with canonical `/zloz/api/` navigation. Deprecated source
aliases and saved-data protocols are documented in the [migration guide](zloz-migration.md).
No Flow-named package may be released; obsolete release PR #110 was closed.

**Standalone Effect CLI:** the unpublished [`@opsydyn/foldkit-zloz-cli`](../packages/foldkit-zloz-cli/README.md)
now provides `zloz validate` and `zloz mermaid export`. Typed Effect CLI commands,
Schema JSON decoding, the canonical core codec, scoped platform streams and
structured errors produce versioned agent-readable output. Strict/report loss
policies, a 1 MiB UTF-8 byte budget, Node/Bun installed binaries and 0/1/2/130 exit
contracts are qualified locally; CI runs the same checks. Core/Mermaid stay pure; parser adoption
and Mermaid import remain subsequent work. Release/publication activation remains
separate. The historical imperative fidelity driver is not the production CLI.

**Planning completed — 2026-11-08:** the [naming migration inventory](assessments/2026-11-08-zloz-naming-migration-inventory.md)
and [shared logo/site brief](assessments/2026-11-08-zloz-logo-and-site-brief.md)
record candidate package mappings, compatibility boundaries, family styling,
logo directions and promo/demo information architecture. They are historical planning records; the ASCII technical names have since
been implemented. The user selected **B — Nested frame**
after reviewing the three SVG concepts.

**Next bounded promo slice:** export the edited Compose graph as canonical JSON
and Mermaid, with explicit conversion-loss review. The static shell, highlighted
developer guide and native Compose island are implemented locally.
Both board and promo must keep the Viz/Three family styling, including light/dark
themes; a separate dark-green identity is not intended. The separate
feature recommendation for searchable sidebar settings remains on the workbench
track.

**Mini map discoverability — delivered:** Navigation exposes a **Mini map** toggle
using the existing `overview` preference and diagnostics/Minimal mode behavior.

## Zloz core: parity and domain modelling — reconciled 2026-11-14

**Current source baseline:** `7fa7b3d9`, isolated `codex/zloz-context-map` branch.
Package manifests identify 0.3.0; branch implementation, registry publication and
hosted deployment are separate states. This reconciliation checks no current
PR/CI/registry state and authorizes no npm publication or deployment. CLI publication
remains deferred. The latest main integration supplies the requested `private: true`
CLI manifest guard and removes public publish configuration, closing the local R1
manifest gap. Local packing remains consumer qualification, not publication.

The [November 14 roadmap/compatibility reconciliation](assessments/2026-11-14-zloz-core-roadmap-reconciliation.md)
is the current inventory and next-feature recommendation. It supersedes the dated
[November 13 inventory](assessments/2026-11-13-zloz-domain-compatibility-reconciliation.md)
and [November 12 completion audit](assessments/2026-11-12-zloz-core-completion-audit.md),
which retain their original source/evidence baselines. E1–E3/P1–P2 and the approved
D1a workshop, D1b C4 mapping/Apply/portable-receipt/CLI and D2 authored-DDD-audit
chains are locally implemented within documented limits. C1–C4 scope decisions,
Q1–Q4 qualification remains open; release qualification is separate from the now-present R1 manifest guard. The approved
C1 headless v2 contract is now recorded below; editor and portable adoption remain
open, and the linked assessment retains its dated source baseline.

The [2026-11-08 assessment](assessments/2026-11-08-zloz-core-parity-and-domain-roadmap.md)
is a historical gap analysis, not a current inventory. Full React Flow parity,
performance superiority and a validated competitive USP remain unestablished.

Maintain two tracks: a reliable, customizable editor floor and an architecture
modelling lifecycle. Package-owned functionality stays reusable; Astro composes
and demonstrates it.

### Delivered capabilities

| Capability                                 | Current scope and evidence                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Architecture presentation                  | C4 presets and nine DDD roles including read-model, composable node/group renderers, light/dark demos. [DDD receipt](../apps/zloz-demo/evidence/ddd-renderers.md).                                                                                                                                                                                                                                                  |
| Atomic patterns                            | Validated fragments, deterministic ID remapping, live policies, rollback, C4/DDD starters and one Undo. [Pattern receipt](../apps/zloz-demo/evidence/pattern-insertion.md).                                                                                                                                                                                                                                         |
| EventStorming discovery                    | Semantic cards, process starter, typed causal links, custom data-only conventions, undoable meaning and composable editing controls. [Discovery](../apps/zloz-demo/evidence/event-storming.md), [relationships](../apps/zloz-demo/evidence/relationships.md), [controls](../apps/zloz-demo/evidence/relationship-controls.md).                                                                                      |
| History and comparison                     | Immutable named editions, read-only rewind, ghost geometry, semantic/layout comparison, comparison controls and change navigation. [History](../apps/zloz-demo/evidence/history.md), [comparison](../apps/zloz-demo/evidence/comparison-controls.md), [navigation](../apps/zloz-demo/evidence/change-navigator.md).                                                                                                 |
| Playback                                   | Opt-in playback, pause/rewind, reduced-motion handling, composable transport and identity-based scrubber. [Engine](../apps/zloz-demo/evidence/edition-playback.md), [controls](../apps/zloz-demo/evidence/playback-controls.md), [scrubber](../apps/zloz-demo/evidence/edition-scrubber.md).                                                                                                                        |
| Restore, forks and model portability       | Guarded graph-only restore with one Undo; separate model identity, pinned origin and independent Undo for forks; canonical model JSON import/export and CLI validation. [Restore](../apps/zloz-demo/evidence/edition-restore.md), [forks](../apps/zloz-demo/evidence/model-forks.md), [import](../apps/zloz-demo/evidence/model-import.md).                                                                         |
| Causal audit and edition-aware audit delta | Package and Effect CLI reports; introduced/resolved/persisting findings; composable workbench controls, filters and source-aware reveal. Artifact creation and regression gating are separate. [CLI audit](../packages/foldkit-zloz-cli/evidence/relationship-audit.md), [comparison](../packages/foldkit-zloz-cli/evidence/relationship-comparison.md), [workbench](../apps/zloz-demo/evidence/audit-controls.md). |
| Portable review packets                    | Optional Mermaid package and CLI combine chosen snapshots, source/model identity, convention catalogue, audit comparison and both Mermaid projections. Loss reporting requires explicit opt-in; errors reject atomically. [Packet receipt](../packages/foldkit-zloz-cli/evidence/review-packet.md).                                                                                                                 |

These receipts qualify their stated local/package/CLI surfaces. They do not prove
that every feature is deployed, comprehensively accessible or faster than another
editor. Graph/snapshot/edition v1 compatibility remains unchanged; full model JSON
preserves identity, editions and origin that diagram-only imports omit.

### Remaining work and completion criteria

Core is **not complete**. The current
[domain/compatibility decisions and qualification gates](assessments/2026-11-14-zloz-core-roadmap-reconciliation.md)
identify implemented work, unresolved gaps and proposed dispositions. Recommendations
are not approved exclusions. Historical receipts qualify only their stated scope.

1. **Editor floor (E1–E3):** E1 waypoint data/controls and E2 normalized palette
   placement/interaction are implemented below, with package tests and local
   browser evidence. The E3 SVG planning contract is implemented below; SVG
   writing and representative browser qualification are implemented below;
   SVG/PNG review/download and opt-in retained routes/centre label envelopes are
   implemented locally; see [SVG evidence](../apps/zloz-demo/evidence/svg-retained.md)
   and [PNG evidence](../apps/zloz-demo/evidence/png-retained.md). These chains no
   longer need new implementations. Physical-device/manual AT
   acceptance remains distinct from synthetic and Chromium qualification; these
   branch additions are unreleased.
2. **Portable review lifecycle (P1–P2):** strict packet decoding, Effect CLI
   validation/inspection and guarded read-only workbench reopening are implemented
   on this branch, unreleased. See the [reader receipt](../apps/zloz-demo/evidence/review-reader.md).
   Headless modelling-patch proposals/dry runs are also implemented on this branch;
   see the [patch receipt](../packages/foldkit-zloz/evidence/modelling-patch.md).
   Strict versioned patch text decoding is implemented; see the
   [decoder receipt](../packages/foldkit-zloz/evidence/modelling-patch-parse.md).
   P2's remaining local chain is implemented: Effect CLI dry run, exact-content
   review/acknowledgement, policy-aware atomic Apply, one Undo and retained/downloaded
   provenance. See [completion evidence](../apps/zloz-demo/evidence/p2-completion.md).
   The separately scoped Alchemy review/private descriptor adapter has local
   progress; SDK/provider/publication gates remain separate. Broader D/C/Q audit
   rows remain open.
   Review packets and conversion receipts remain distinct; reading does not import
   either into the working model.
3. **Domain and compatibility decisions (D1–D2, C1–C4):** approved D1a's seven-role
   workshop semantics, native controls and SVG/PNG artwork, D1b's explicit C4 mapping,
   placement/consent, atomic Apply, portable receipts/read-only reopening/CLI inspection,
   and D2's authored convention audit/review/deltas are implemented locally. See
   [current API/evidence inventory](assessments/2026-11-14-zloz-core-roadmap-reconciliation.md).
   These scopes do not promise every modelling vocabulary or universal architecture
   correctness. Strict output→input (C1), world-coordinate/portless groups (C2),
   layout bounds/cancellation (C3) and advanced catalogue decisions (C4) still require
   implementation or explicit approved dispositions. P2 already supplies atomic
   multi-operation edge edits; a dedicated multi-connect interaction remains separate.
   Full parity and proposed deferrals are not approved by this reconciliation.
4. **Qualification (Q1–Q4):** refresh packed consumer/SSR-hydration evidence and
   representative benchmarks with agreed budgets. Run comprehensive accessibility
   and device acceptance after functional work; accessible interaction remains a
   requirement in every slice. Close all feature rows and scope decisions with
   linked acceptance evidence before declaring bounded core completion.

Release follow-through is a separate gate: reviewed commits/PR, current CI,
package identity and artifact/provenance/consumer qualification before separately
approved publication or deployment. Automatic persistence, collaboration and team
runtime remain separate planning streams; no infrastructure activation is implied.
Keep unrestricted visual composition and diagnostics preferences first class.

**Implemented on this branch, unreleased:** composable packet preview/consent
controls in the optional Mermaid adapter and History sidebar, using chosen audit
sources, exact-content freshness and host protection without changing graph/Undo.
See the [workbench receipt](../apps/zloz-demo/evidence/review-packet-controls.md).

**DDD relationship contract — implemented on this branch, unreleased:** typed
tactical/strategic descriptors, explicit logical resolution, configurable
conventions and opt-in policies reuse canonical codecs, semantic history and
Undo. Causal tooling remains family-scoped; logical frame references do not create
drawable group endpoints. See [ADR 0038](adr/0038-define-ddd-relationship-contracts.md)
and the [package qualification receipt](../packages/foldkit-zloz/evidence/ddd-relationships.md).

**Context-map presentation — implemented on this branch, unreleased:** package
projection, connectors and labels share existing geometry/interaction contracts;
a four-context starter uses real ports and atomic insertion. The workbench shows
light/dark themes, custom source badges, native editing/Undo and a presentation
toggle independent of diagnostic visibility. See [ADR 0039](adr/0039-compose-context-map-presentation.md)
and [local evidence](../apps/zloz-demo/evidence/context-map.md).

**DDD editing controls — implemented on this branch, unreleased:** package-owned
pattern/side-role controls recheck inspector/revision and live policy, preserve
authored descriptions/absence and apply ordinary undoable events. Native helpers
and custom workbench wrappers show protected fields without hiding stored meaning.
See [ADR 0040](adr/0040-compose-ddd-relationship-editing-controls.md) and
[local evidence](../apps/zloz-demo/evidence/ddd-relationship-controls.md).

**Workshop mapping preview — implemented on this branch, unreleased:** a pure
package API proposes EventStorming-to-DDD node and incident-edge mappings, keeps
ambiguous intent explicit, accepts per-ID choices and reports prospective semantic
loss without changing the graph/history. Existing DDD anchors and unrelated C4
meaning remain preserved. See [ADR 0041](adr/0041-preview-event-storming-ddd-mappings.md)
and [package evidence](../packages/foldkit-zloz/evidence/event-storming-ddd-preview.md).

**Mapping review panel — implemented on this branch, unreleased:** the left
sidebar composes the package preview with explicit choices, native inspection,
ambiguity/compatibility/loss reasons and independent diagnostics preferences.
Temporary choices are source/session scoped and leave graph, Undo and lineage
unchanged. See [ADR 0042](adr/0042-compose-workshop-mapping-review.md) and
[local evidence](../apps/zloz-demo/evidence/mapping-review.md).

**Conversion plan contract — implemented on this branch, unreleased:** package-owned
plans pin complete source provenance and host session/revision, list same-ID
semantic replacements and block unresolved intent. Explicit all-loss consent is
bound to a freshly rebuilt exact plan; it grants no edit permission. See
[ADR 0043](adr/0043-plan-workshop-conversion-and-loss-consent.md) and
[package evidence](../packages/foldkit-zloz/evidence/event-storming-ddd-conversion-plan.md).

**Plan provenance and loss acknowledgement — implemented on this branch, unreleased:**
the Mapping review sidebar composes the package plan/consent resolver, shows source
and fork provenance, blockers and all prospective losses, and records only transient
exact-plan acknowledgement. Callback generations prevent revival after withdrawal
or source change-and-revert. Graph, Undo and authoritative exports remain unchanged.
See [ADR 0044](adr/0044-review-plan-provenance-and-losses-in-workbench.md) and
[local evidence](../apps/zloz-demo/evidence/mapping-plan.md).

**Atomic package Apply — implemented on this branch, unreleased:** the core
rebuilds and validates the live plan/consent, stages descriptor-only replacements,
checks whole/granular policies and commits once. Portable conversion receipts retain
full source, target and mapping provenance independently of unchanged model v1/fork
ancestry. Late vetoes preserve the editor; Undo/Redo covers the complete graph change.
See [ADR 0045](adr/0045-apply-ddd-conversion-atomically-with-portable-provenance.md)
and [package evidence](../packages/foldkit-zloz/evidence/event-storming-ddd-apply.md).

**Workbench Apply and receipt retention — implemented on this branch, unreleased:**
Mapping review rechecks the package transaction, current source/consent and complete
final-state semantics, then publishes editor plus a per-model retained receipt in
one Foldkit update. Receipt download is a scoped Command; Undo/Redo and model switches
preserve immutable provenance. See [ADR 0046](adr/0046-publish-workbench-apply-and-receipts-together.md)
and [local evidence](../apps/zloz-demo/evidence/mapping-apply.md).

**Portable receipt reopening — implemented on this branch, unreleased:**
Mapping review validates downloaded receipts and shows a detached read-only
Before/After canvas, recorded changes, ancestry and loss reasons. Working models,
Undo and consent remain unchanged; invalid input preserves the last good comparison.
See [ADR 0047](adr/0047-reopen-conversion-receipts-as-read-only-comparisons.md) and
[local evidence](../apps/zloz-demo/evidence/receipt-review.md).

**Receipt change focus — implemented on this branch, unreleased:**
Recorded nodes and connections have explicit Focus before/after controls backed
by public history navigation primitives. Scope, membership, surface and gesture
checks guard detached camera changes; native focus, selected-row feedback and
minimal-mode controls preserve the working graph and receipt. See
[local evidence](../apps/zloz-demo/evidence/receipt-focus.md).

**Receipt change stepping — implemented on this branch, unreleased:**
The core package exposes pure stable-identity Previous/Next resolution through
existing focus/filter contracts. Workbench controls preserve the chosen side,
show position and stop at boundaries; stale cursor/side callbacks cannot advance.
See [ADR 0048](adr/0048-step-through-receipt-changes-on-the-selected-side.md) and
[local evidence](../apps/zloz-demo/evidence/receipt-step.md).

**Receipt side continuity and overview — implemented on this branch, unreleased:**
Before/After switches preserve focused node/connection identity, camera focus and
traversal position. Show receipt overview clears selection and fits all nodes on
the chosen side. Live availability guards preserve the previous view on rejection.
See [local evidence](../apps/zloz-demo/evidence/receipt-side.md).

**Updated next-track priority (2026-11-13):** the user's consolidated completion
request moves PNG next after P2, then a separately scoped Alchemy integration
review. This supersedes the earlier all-core-first sequencing, without declaring
D1–D2/C1–C4 or Q1–Q4 complete. Provider activation, dependency adoption and deployment
remain separate decisions.

**Authored edge waypoints — implemented on this branch, unreleased:** named
world-space bends, finite/identity validation, public preview/edit contract, live
revision/policy/protection checks, one Undo and additive v1 persistence. Shared
geometry covers labels/hit paths, reconnection preview, culling, fit/reveal,
overview and history. Copy/pattern insertion translates bends; layout and endpoint
moves preserve their authored world positions. Native authoring controls remain
open. See [ADR 0049](adr/0049-author-portable-edge-waypoints.md) and
[package evidence](../packages/foldkit-zloz/evidence/edge-waypoints.md).

**Composable waypoint controls — implemented on this branch, unreleased:** public
transient gesture/preview and control resolvers, native handle/action/readout helpers
and an opt-in Foldkit slot. Pointer drag commits once on release; Escape discards,
arrow keys nudge, Alt bypasses the grid and Delete removes the focused bend. Live
policy/revision checks, diagnostics preferences and light/dark themes remain shared.
The workbench offers Off/Native/Custom designs and independent bend protection.
See [ADR 0050](adr/0050-compose-waypoint-interaction-controls.md) and
[local qualification](../apps/zloz-demo/evidence/waypoint-controls.md).

**Headless palette/external placement — implemented on this branch, unreleased:**
immutable scoped sessions, explicit world/screen/client targets, grid and optional
node-frame anchor snapping, parent intent, live policy/freshness checks and one
atomic Undo. Preview is detached and non-publishing; cancel/restart/commit reject
old callbacks. Pattern insertion shares private proposal preparation, preserving
its existing public contract. See [ADR 0051](adr/0051-plan-and-apply-headless-placement.md)
and [package evidence](../packages/foldkit-zloz/evidence/placement.md).

**Palette interaction — implemented on this branch, unreleased:** core control
resolver/update facts and optional native/custom Foldkit entry/action/host/preview
helpers. A scoped input resource supports mouse/touch and keyboard placement,
fresh origin samples, cancellation and live protection. The workbench supplies C4
and DDD cards with a native/custom switch. See
[interaction evidence](../apps/zloz-demo/evidence/palette.md).

**SVG export contract — implemented on this branch, unreleased:** pure package
planning for canonical model/camera/explicit bounds, shared theme paints, backgrounds,
font/assets and renderer coverage. Item-addressed findings distinguish omission,
fallback, unverified adapters and unsupported content. No SVG file is emitted yet.
See [ADR 0052](adr/0052-plan-portable-svg-export.md) and
[contract evidence](../packages/foldkit-zloz/evidence/svg-export.md).

**SVG writer — implemented on this branch, unreleased:** standalone canonical SVG
strings, shared geometry/labels/ports, safe typed vector adapters, atomic rejection,
explicit loss acknowledgement and retained uncertainty. Real light/dark/custom/crop/
transparent files have local Chromium evidence. Resource-byte embedding is unsupported.
See [ADR 0053](adr/0053-write-svg-through-typed-primitives.md) and
[writer evidence](../packages/foldkit-zloz/evidence/svg-writer.md).

**Current continuation:** SVG review/download controls and validated embedded-font
resources have since been implemented (see the later receipts above). P2's reviewed
patch lifecycle and package-owned PNG export are locally implemented. The Alchemy integration review now proposes a bounded declaration-fidelity spike; broader compatibility/qualification work
remains tracked separately.

## Release: Keyed Chart Comparison

**Outcome:** users can compare charts in a dynamic collection without losing
each panel's selection and inspection state when panels move.

- [x] Add, remove, and reorder chart panels using stable app-owned IDs and
      `foldChildAt`.
- [x] Link panel selections through typed child OutMessages and parent-owned
      selection policy.
- [x] Verify in automated tests that reorder preserves state and late Messages for removed IDs
      cannot recreate panels.
- [x] Implement the same-source promo/download workflow; generated comparison,
      line, histogram and scatter projects install, typecheck and build locally.
- [ ] Complete controller-owned desktop/390px, keyboard, reduced-motion and
      standalone browser acceptance. Further controller QA is pending exclusive
      Firefox access; no live pass is inferred from automated tests.
- [x] Publish the runnable promo example and FoldKit 0.167 package updates
      through the authorised release workflow; verify hosted and registry results.

All five source tasks and the final correction wave are implemented and reviewed.
The final source checkpoint passed 529 tests, typechecks, lint and production
builds. The scatter-axis spacing correction is implemented but its visual
recheck and the complete browser journeys remain pending. Release integration
also preserves main's dataset explorer and deployment support; its combined
verification is recorded separately. See the
[qualification record](superpowers/specs/2026-10-08-keyed-chart-comparison-qualification.md).

Follow-on candidate: a VirtualList-backed Stateflow event explorer. The bounded
KeyedQuery dataset explorer now exists in `packages/dataset-explorer` and is
hosted by both apps. Query's stale-result protection
does not replace the request-diagnostics example's interruptible route-exit
contract. Keep Query, Machine, and browser lifecycle ownership in applications.

## Viz direction: parity and chart excellence — 2026-10-05

The [concrete visx parity map and stretch goals](assessments/2026-10-05-visx-parity-and-chart-excellence.md)
records the current local source baseline, all 47 gallery examples, public/API
limits and proposed acceptance criteria. It distinguishes implemented geometry,
application-only recipes, promo exposure and behavioural qualification.

Proposed next Viz sequence: controlled brush/zoom/linked inspection; trustworthy
signals with explicit quality and uncertainty; expressive foldout/distribution
compositions; measured scale and reproducible exports. Precision and expressive
views share pure geometry and parent-owned Foldkit state. This is planning only;
each slice needs its own specification and implementation decision.

M1's local [controlled Signal desk qualification](superpowers/specs/2026-10-05-controlled-signal-exploration-qualification.md) now records the implemented pure helpers and native example, with native touch and representative-user comprehension explicitly unperformed. F1–F3 remain partial. The [M2 quality/uncertainty design](superpowers/specs/2026-10-05-trustworthy-signal-quality-design.md) is approved, with an executed [test-first implementation plan](superpowers/plans/2026-10-05-trustworthy-signal-quality.md). M2 implementation now has [automated qualification](superpowers/specs/2026-10-05-trustworthy-signal-quality-qualification.md); independent review findings are addressed and native Firefox mouse/keyboard/layout checks are recorded. Held-pointer, hardware touch and assistive-technology acceptance remain open. The approved error-bar and captured comparison follow-up is now implemented locally under its [executed plan](superpowers/plans/2026-10-05-signal-error-bars-and-comparison-baseline.md), with [qualification evidence](superpowers/specs/2026-10-05-signal-comparison-qualification.md). P2 error-bar geometry and P3 independent captured comparison are delivered; wider parity and native acceptance remain partial. A [post-review browser follow-up](superpowers/specs/2026-10-05-signal-comparison-native-qualification.md) now qualifies390/1280 light/dark layouts, off-screen comparison, table/source and held Capture/Clear/Escape paths. Independent capture loss, hardware touch/scrolling, screen-reader announcements and comprehension remain open. The [approved event-lane design](superpowers/specs/2026-10-05-signal-event-lane-design.md) now defines an optional independent caller event feed, exact-time selection and density-aware shared lane. The approved [test-first plan](superpowers/plans/2026-10-05-signal-event-lane.md) now has local implementation and [qualification evidence](superpowers/specs/2026-10-05-signal-event-lane-qualification.md). This delivers the event-lane portion of P4; replay/live transport and wider device/accessibility acceptance remain open. Next: direct accessibility and device acceptance of the existing Signal desk.

## Product Thesis

Build the most useful Astro host and chart-primitives layer for FoldKit applications: server-compatible islands, route-aware application lifecycle, typed parent-owned state, and linked data visualizations that remain pure and testable.

## Next Rerelease Slice: Stateflow Observatory

**Outcome:** `/stateflow` makes app-owned Machine transitions and typed Port
activity visible through a deterministic graph, replay timeline, and inspector.

- [x] Keep the Machine, replay policy, trace Model, Commands, and typed inbound
      replay/outbound telemetry Ports in `apps/web`.
- [x] Expose plain graph records and the pure `layoutStateFlow` API through
      `@opsydyn/foldkit-viz/stateflow`; no Machine execution or Port subscriptions
      belong in the viz package.
- [x] Host the page as an Astro `client:load` island using the existing lifecycle
      bridge, without adding integration APIs or async visualisation ownership.
- [x] Use FoldKit's [`Dom.streamFromMediaQuery`](https://github.com/foldkit/foldkit/pull/1424)
      in the app to record the current and changed reduced-motion preference;
      Astro remains a lifecycle host and `foldkit-viz` remains pure.
- [x] Document the reusable remote filter, brush, and zoom load pattern: an
      app-owned Command loads data, app-owned AsyncData/Model state records the
      result, and typed Ports carry host input/output only. The app owns keyed
      interruption/cancellation and replacement sequencing; `foldkit-viz`
      receives derived records and computes geometry synchronously.

**Observatory enhancements (all in `apps/web/src/apps/stateflow`):**

- [x] Specimens: any `Machine.define` machine, erased to plain records with its Message
      schema and named examples. Request diagnostics and a checkout ship; a picker
      switches between them.
- [x] Replay as a fold: the Model keeps encoded events and a cursor, and every state
      is the machine replayed to the cursor, so a scrubber moves both ways.
- [x] A layered layout (ranks along the flow, rank-skipping edges over the top, back
      edges under), with the message on every edge and its recency (`lastSeenAt`) as
      a fade. App-owned: D3 has no layered layout, so it stays out of `foldkit-viz`
      until a reference implementation is chosen. The force layout stays selectable.
- [x] Ignored messages counted and shaken off on their state; a swimlane of the
      session with each event's Commands.
- [x] Live mode: request diagnostics reports each machine message on a
      `BroadcastChannel`; the observatory, listening, records and replays them.
- [x] Coverage: edges taken in the trace, FoldKit's dead transitions and unreachable
      states, and a breadth-first search over the named examples whose shortest path
      to each edge is offered as a Vitest case (and run in `specimen.test.ts`).
- [x] Shareable sessions as a link (decoded into the page Flags on the server), and a
      top-to-bottom layout at phone width.

**Release gate:** implementation and documentation do not establish rerelease
readiness. The packed-consumer and workspace verification gates still apply.
See the [viz usage](../packages/foldkit-viz/README.md#remote-visual-loads) and
[Astro host usage](../packages/astro-foldkit/README.md#remote-visual-loads).

## Now: Astro Production Boundary

**Outcome:** an Astro consumer can mount a typed FoldKit app with stable server output, predictable hydration, and verified teardown.

- [x] Define a typed `defineApp<Props, Model, Message>` contract without `any` at the public boundary.
- [x] Replace the empty Astro SSR renderer with a stable, documented server output contract.
- [x] Make client embedding idempotent and lifecycle-safe across `astro:unmount`.
- [x] Add focused tests for renderer recognition, app loading, SSR output, hydration setup, and disposal.
- [x] Add a package-consumer verification fixture that resolves the published package exports.
- [x] Document the server/client boundary and the supported Astro client directives.

**Exit criteria:** `@opsydyn/astro-foldkit` has typed public APIs, no empty undocumented SSR behavior, and a passing consumer-level package smoke test.

## Next: Navigation-Aware Astro Apps

**Outcome:** FoldKit apps can react to Astro navigation without owning a second router.

- [x] Define an adapter from Astro navigation lifecycle events to application Messages.
- [x] Handle `coldLoad`, `entered`, `exited`, and `stayed` at the application boundary with app-owned `Route.isEntering` route policy.
- [x] Support normalized repository/document paths with `rest`.
- [x] Verify state preservation and disposal across Astro View Transitions.
- [x] Add a route-aware example to `apps/web`.

**Exit criteria:** a route-driven example can distinguish cold load, route entry, route exit, and within-route payload changes with typed tests. Verified by the request-diagnostics unit, Story, Scene, package smoke, and production build checks recorded in the navigation bridge plan.

## Now: Interruptible Application Lifecycle

**Outcome:** an Astro-hosted FoldKit app can stop obsolete remote work while
the application retains ownership of command keys and cancellation policy.

- [x] Make request-diagnostics reloads interruptible with
      `Command.define({ interrupt: true })`.
- [x] Sequence the replacement request through the interrupt outcome Message;
      never return interruption and replacement commands in one update batch.
- [x] Cancel an active app-owned request on Astro route exit without starting a
      replacement request.
- [x] Document keyed cancellation for remote filter, brush, and zoom loads;
      keep `foldkit-viz` pure and synchronous.

**Exit criteria:** the reference app proves reload and navigation cancellation,
and the documented pattern has no Astro or Viz package API coupling.

## Completed: FoldKit 0.136 Compatibility

**Outcome:** both packages and the reference app use FoldKit's current render,
Command, and test contracts without weakening package ownership boundaries.

- [x] Propagate one render-scoped `HtmlBuilder` through Astro, app, Storybook,
      and chart view boundaries.
- [x] Migrate interruptible work to object-form
      `Command.define({ interrupt: true })` while preserving app-owned keys and
      cancellation policy.
- [x] Adopt `Scene.given` and `Story.given`, with subscription-origin coverage
      for the health uptime tick.
- [x] Add the locale-aware Astro Greeting showcase for FoldKit Document
      language and direction metadata.

**Exit criteria:** package builds, packed-consumer tests, application tests,
Storybook, TypeDoc, and the hydrated Greeting interaction all pass against
FoldKit 0.136.x.

## Next: FoldKit Viz Interaction Layer

**Outcome:** chart consumers can compose selection and navigation interactions without rewriting event plumbing for every chart.

- [x] Define controlled parent-owned selection contracts for brush, zoom, hover, and active series.
- [x] Add linked-view helpers for histogram-to-scatter and scatter-to-table workflows. Plot specs link through `highlight` (foldkit-viz 0.20.0, `/explore`).
- [x] Keep all interaction state and math framework-agnostic with no runtime `foldkit` dependency. Enforced by `test/framework-boundary.test.ts`: only `src/foldkit` may import FoldKit or Effect, and no module touches the DOM.
- [x] Add keyboard/focus event contracts compatible with FoldKit `OnKeyDownFocus`. `interaction/keyboard` maps keys to chart commands (arrows, Page Up and Down, Home, End, Escape, Enter and Space, with modified keys left to the browser); `foldkit/keyboard` gives handlers for `OnKeyDownPreventDefault` and `OnKeyDownFocus`, the latter with roving focus. The plot panel uses them.
- [x] Add accessible data summaries or table projections for chart views. `describePlot` summarises compiled geometry and `plotTable` projects a spec's data; `plotChart` and `plotCanvas` take both as options, and every gallery chart and plot panel uses them.
- [x] Add property and interaction tests for domain conversion, clearing, clamping, and linked updates. fast-check properties cover every axis type's round trip, pointer conversion, zoom and pan bounds, selection clamping and clearing, and `highlightPoints`; a seeded sequence test covers linked charts.

**Exit criteria:** two charts can share a typed selection model while each remains independently reusable and testable.
Met, 2026-11-14: linked charts, request diagnostics and comparison compose independent plot panels through typed out-messages and a parent-owned inspection or selection, and each panel is tested alone.

## Next: Reference Data Explorer

**Outcome:** the demo app proves the complete product boundary in one credible workflow.

- [x] Load data through `foldkit/http` with browser-safe tracing defaults.
- [x] Model request/loading/filtering/failure states with `experimental/machine`.
- [ ] Use `AsyncData.loadIfMissing` where cached data should not be revalidated on every revisit.
- [x] Render linked histogram and scatter charts through parent-owned filtering.
- [x] Exercise command mappings with `Story` and mounted child mappings with `Scene` tests.
- [x] Add route entry/exit behavior through the Astro integration.

**Exit criteria:** `/request-diagnostics` is a documented reference application, not only a demo page.

## Later: Release Quality

**Outcome:** both packages are dependable for external consumers.

- [x] Add package export and packed-consumer tests to CI through `bun run test`.
- [x] Add API reports or generated type-surface checks for public exports. `tools/api-surface.ts` writes
      `etc/api-surface.md` for every entry point (58 in Viz, 4 in Astro); CI fails when the surface changes
      without the report (`bun run api:check`).
- [x] Add compatibility coverage for the supported Astro range. `tools/astro-compat.ts` packs the
      integration and builds a fixture site on each major; Astro 5.18, 6.4 and 7.4 pass in the `astro-compat`
      CI job. Astro 4 fails, as expected below the `>=5.0.0` peer: FoldKit's Vite plugin needs the Vite
      environment API.
- [x] Publish migration notes for FoldKit minor/breaking changes such as `matchDataSplitEmpty` and route
      `Transition`: [FoldKit 0.170 and Effect 4.1](migrations/foldkit-0.170.md).
- [x] Track package changelogs and versioning independently with release-please (`astro-foldkit` versus `foldkit-viz`).
- [x] Add performance checks for bundle size and large chart datasets. `tools/bundle-budget.ts` holds each
      Viz entry point to a gzipped budget in CI (`bun run size:check`); `test/performance.test.ts` times a
      million-row compile, index, 1,000 queries, highlight and bin against budgets about ten times a
      laptop's times.

## Deliberate Non-Goals

- [ ] Do not make `foldkit-viz` depend on `foldkit/http` or `experimental/machine`.
- [ ] Do not build a second router inside either package.
- [ ] Do not turn `foldkit-viz` into a DOM/event runtime; keep rendering and browser wiring at the app boundary.
- [ ] Do not treat broad baseline lint cleanup as a prerequisite for product slices.

**PNG export — implemented on this branch, unreleased (2026-11-13):** bounded pure
planning/review, opt-in browser encoding with safe SVG/custom adapters, exact PNG
preview/download bytes, source/settings freshness, protection and explicit loss
acceptance. Native/custom controls and light/dark/transparent/viewport/scale demos
live in the workbench sidebar. See [ADR 0063](adr/0063-rasterize-reviewed-model-artwork-as-png.md)
and [local PNG evidence](../apps/zloz-demo/evidence/png-export.md). This completes
the functional PNG boundary; broader font/browser/device and D/C/Q qualification
remain tracked separately. The approved Alchemy review is recorded below.

**Alchemy Domain review — complete, self-review (2026-11-13):** exact published
beta.85 peers align with this checkout, and public declaration metadata is present.
Current docs drift from parts of the pinned API, and several Domain constructs
lack equivalent Zloz roles. Recommend an optional adapter boundary, starting with
a read-only declaration-fidelity spike; no dependency/provider/runtime adoption
has occurred. See [the decision and stop conditions](assessments/2026-11-13-zloz-alchemy-domain-integration.md).
Recommendation: **needs review**. Existing D/C/Q qualification remains open.

**Alchemy declaration-fidelity spike — implemented locally, unreleased (2026-11-13):**
The private experiment pins beta.85 and maps a real synthetic Domain fixture under
Node/Bun, with golden manifests/graphs, explicit untyped roles/relationships, strict
identity/alias checks and core edition comparison. The outside-repo consumer needs
neither Foldkit nor React. Standard omitted-read declarations expose a retained
strict-optional TypeScript compatibility failure; the positive fixture has an
explicit read contract. Production adapter adoption remains on hold.
See [ADR 0064](adr/0064-qualify-alchemy-declarations-in-an-isolated-spike.md) and
[spike receipt](../experiments/alchemy-domain-fidelity/evidence/receipt.md).
Next proposed slice: framework-neutral read-model and declared-consumption contracts
under D1, then revisit optional adapter extraction and its compatibility gate.
D/C/Q closure and user-task qualification remain open. Recommendation: **needs review**.

**Read models and declared consumption — implemented locally, unreleased (2026-11-13):**
Core now recognises native DDD read-model nodes and directed tactical `feeds`
relationships, with a framework-neutral two-ID declaration guard/resolver. The
explicit source may be an aggregate/root, event type or read model; target is a
read model. Existing DDD rendering, policy/controls, serialization, editions and
Undo compose the descriptors without runtime assumptions or new dependencies.
See [ADR 0065](adr/0065-declare-read-model-consumption-without-runtime-semantics.md)
and [contract evidence](../packages/foldkit-zloz/evidence/declared-consumption.md).
This addresses the read-model/dependency subset of D1, not streams/sagas/policies,
EventStorming-to-C4 mapping or complete D/C/Q closure. Next proposed slice: qualify
an optional read-only Alchemy adapter against this native subset, retaining exact
version/identity/loss reporting and the upstream strict-optional compatibility gate.
Recommendation: **needs review**. No adapter adoption or release is implied.

**Optional read-only Alchemy candidate — qualified privately (2026-11-13):**
The isolated candidate now has a packed adapter entry, exact caller-declared
beta.85 gate, native stateful-view/read-model and core-resolved consumption mapping,
immutable source/projection/findings and complete fixture topology coverage.
Stateless/mixed-source rejection and chained view identity are tested. Installed
Node/Bun and strict NodeNext/Bundler consumers pass without Foldkit/React.
Omitted-read and stateless-view strict-optional compiler failures remain explicit;
only the local unreleased core source/artifact is qualified, not published 0.3.0.
See [ADR 0066](adr/0066-qualify-a-private-read-only-alchemy-adapter.md) and
[candidate evidence](../experiments/alchemy-domain-fidelity/evidence/adapter-receipt.md).
Next proposed slice: extract a private workspace adapter with separate Domain
inspection and portable validated projection entries. Keep SDK/runtime imports out
of the portable boundary; full compatibility and release remain separate gates.
Recommendation: **needs review**. No production dependency/provider adoption occurred.

**Private Alchemy workspace adapter — extracted locally (2026-11-13):**
`@opsydyn/foldkit-zloz-alchemy` is private. Its portable root decodes a strict,
versioned data descriptor and recomputes graph/findings using core only; `/domain`
separately inspects trusted already-loaded declarations with exact caller-declared
beta.85 gating. Packed runtime/type consumers verify the split without SDK/Effect
on the portable path. Identity aliases, complete source-fact coverage, native
read-model/consumption mapping and edition continuity remain tested. The two
upstream strict-optional compiler failures and unpublished native-core requirement
remain explicit gates. No Apply, provider or release integration was added.
See [ADR 0067](adr/0067-split-private-alchemy-inspection-and-portable-projection.md),
[package contract](../packages/foldkit-zloz-alchemy/README.md) and
[qualification](../packages/foldkit-zloz-alchemy/evidence/qualification.md).
This completes the extraction proposed above, not D/C/Q closure or general SDK
compatibility. Next proposed slice: read-only workbench descriptor review through
the portable entry, with bounded host text decoding, source provenance and visible
loss findings before any editing. Recommendation: **needs review**.

**Read-only Domain descriptor workbench — implemented locally (2026-11-13):**
The left-sidebar Domain review accepts paste or a bounded UTF-8 JSON file through
the private adapter's portable root. Host preflight checks 1 MiB, depth/value limits,
decoded duplicate keys and framing before projection. A detached navigation-only
canvas shows declared provenance, source-fact coverage and every loss/unverified
finding, including under Minimal mode. Bad input preserves the previous review;
read identities reject cancellation/supersession/context races. The working model,
Undo, editions, lineage and consent remain untouched. First-measurement Fit and
explicit Fit/return controls complete the single-canvas review. Native SDK execution,
Apply and release remain outside scope; exact beta.85, upstream strict-optional
failures and unpublished native-core requirements remain gates.
See [ADR 0068](adr/0068-review-alchemy-descriptors-through-a-bounded-host-boundary.md)
and [tests/browser/visual evidence](../apps/zloz-demo/evidence/alchemy-review.md).
This completes the descriptor-review slice proposed above, not broader D/C/Q
closure. Next proposed slice: package-level source-fact navigation linking each
finding to its node or relation in the detached canvas. Recommendation: **needs review**.

**Package-level finding navigation — implemented locally (2026-11-13):**
The private portable adapter now resolves findings into source-linked node/relation
navigation recipes. Requests bind host review scope plus full canonical descriptor
content and finding identity; activation rechecks live read-only/measurement/gesture,
protection, coverage, target/endpoints and core visibility. Missing/ambiguous/hidden
facts have explicit reasons. Recipes reveal collapsed targets before selection,
without graph/Undo changes. Native workbench Reveal buttons preserve keyboard focus,
show selected-target feedback and compose with Minimal mode, invalid-input retention
and review replacement guards. SDK imports, Apply, execution and publication remain
outside this slice; existing compatibility gates remain unchanged.
See [ADR 0069](adr/0069-reveal-portable-findings-with-scoped-navigation-recipes.md),
[portable API](../packages/foldkit-zloz-alchemy/README.md#finding-navigation-portable-entry)
and [tests/visual evidence](../apps/zloz-demo/evidence/alchemy-finding.md).
This completes the finding-navigation slice above, not general Domain fidelity or
broader D/C/Q closure. Next proposed slice: opt-in descriptor-preview layout using
the existing ELK adapter, preserving source identity/findings while improving dense
relation-label readability. Recommendation: **needs review**.

**Opt-in descriptor preview layout — implemented locally (2026-11-13):**
Core now exposes `applyPreviewLayout`, sharing geometry validation with normal
layout while preserving read-only state and Undo. Domain review lazily invokes the
existing ELK adapter on explicit Arrange, with RIGHT/DOWN, Cancel and Restore
original controls. Source projection/IDs/coverage/findings and working model/history
remain unchanged. Scoped active requests reject stale, failed or cancelled results;
preview navigation invalidates pending work. Finding requests survive layout and
restore. A reproduced grouped ELK option bug is fixed: direction/spacing now reach
group parents as well as root. Real engine, installed-consumer, workbench and browser
checks retain inspected light/dark evidence. SDK/runtime/publication gates remain.
See [ADR 0070](adr/0070-layout-detached-descriptor-previews-with-elk.md),
[core API](../packages/foldkit-zloz/README.md#read-only-preview-layout-unreleased)
and [qualification/captures](../apps/zloz-demo/evidence/alchemy-layout.md).
This completes the preview-layout slice above, not D/C/Q or full label fidelity.
Next proposed slice: package-level edge-label bounds in layout requests, allowing
ELK to reserve space for labels and custom badges. Recommendation: **needs review**.

**Explicit layout label envelopes — implemented locally (2026-11-13), unreleased:**
Core accepts validated, detached per-edge composite label sizes in layout requests
and retains centered world-coordinate result boxes. Missing/unexpected boxes fail
atomically. Shared view geometry, controls, fit/reveal and culling consume the boxes
while preserving authored/custom geometry precedence. ELK reserves CENTER labels
in compound RIGHT/DOWN layouts, including custom badges with no graph text. The
workbench demonstrates a fixed text-plus-tag renderer sharing its declared 176 by
36 envelope. Source/projection/findings and working Undo remain unchanged.
See [ADR 0071](adr/0071-reserve-explicit-layout-label-envelopes.md) and
[qualification/captures](../apps/zloz-demo/evidence/alchemy-label-bounds.md).
This closes the preceding label-bounds slice; D/C/Q gates remain open.

Next proposed slice: opt-in measured label envelopes through the Foldkit lifecycle,
with stale-result protection before re-layout, so custom renderers need not keep
manual size constants in sync. Recommendation: **needs review**. No automatic
measurement, engine adoption or publication is implied.

**Opt-in measured label envelopes — implemented locally (2026-11-13), unreleased:**
Core provides transient measurement state, complete-batch validation and repeated
request/revision/exact-source/render-key checks. A scoped Foldkit Mount waits for
font readiness, measures fractional HTML border boxes once in world units and
releases observers/timers on completion, failure or cancellation. Missing labels
and bounded deadlines produce visible failures. The view is unchanged by default;
custom hosts can compose the same probe. Domain review demonstrates intrinsic
compact/expanded badges, Measure/Cancel, explicit Arrange, theme invalidation and
focus-preserving protection reasons. Measurement and layout preserve source,
findings, working graph and Undo; installed consumer, native-boundary, SSR and
browser evidence accompany [ADR 0072](adr/0072-measure-rendered-labels-with-scoped-freshness.md)
and [qualification/captures](../apps/zloz-demo/evidence/measured-labels.md).
This closes the preceding measurement slice; D/C/Q and publication gates remain.

Next proposed slice: explicit group-header envelopes in layout requests, allowing
custom C4/DDD container headings to reserve space instead of relying on ELK's
fixed header padding. Recommendation: **needs review**. No implementation of that
follow-up, automatic layout, provider activation or publication is implied.

**Explicit group-header envelopes — implemented locally (2026-11-13), unreleased:**
Layout requests accept detached header sizes, padding and gap for unique groups.
A pure resolver supplies world header rectangles, minimum bounds and child padding;
core rejects incomplete space reservations atomically while preserving stale/Undo
and read-only semantics. C4/DDD renderer options share this geometry and keep
compact collapsed headings. ELK reserves nested/empty groups in RIGHT/DOWN, with
real-engine wide/tall and cross-boundary-edge qualification of its pinned compound
minimum-vector correction. The workbench demonstrates opt-in expanded headings,
explicit Arrange, cancellation, original geometry, themes/Minimal mode and measured
edge-label composition. Source/findings/working history remain unchanged. See
[ADR 0073](adr/0073-declare-group-header-layout-envelopes.md) and
[qualification/captures](../apps/zloz-demo/evidence/group-headers.md).
This closes the prior heading-bounds slice; D/C/Q and publication gates remain.

Next proposed slice: opt-in measured group-heading bounds using the existing scoped
measurement/freshness pattern, so custom C4/DDD headings can size intrinsically.
Recommendation: **needs review**. No automatic layout or publication is implied.

**Opt-in measured group headings — implemented locally (2026-11-13), unreleased:**
Intrinsic C4/DDD group headings now accept size-free identity/padding/gap specs.
Core validates complete measured batches, combines sizes into layout declarations
and rechecks source/revision/renderer/collapsed visibility before reuse. A scoped
Foldkit Mount shares the existing box observer, deadline, cleanup and isolation
logic with edge measurement. The workbench demos summary/provenance variants,
Measure/Cancel, explicit Arrange, theme invalidation and combined edge/heading
measurement. Source/findings/working Undo remain unchanged. See
[ADR 0074](adr/0074-measure-intrinsic-group-headings.md) and
[qualification/captures](../apps/zloz-demo/evidence/measured-group-headers.md).
This closes the preceding measured-heading slice; D/C/Q and publication gates remain.

Next proposed slice: define opt-in SVG export fidelity for retained layout routes
and measured label anchors, with explicit custom-renderer findings, before extending
PNG. Recommendation: **needs review**. No export behavior or publishing is changed
by this recommendation.

**Retained layout SVG contract — implemented locally (2026-11-13), unreleased:**
Core captures detached routes/label envelopes and plans their effective bounds
against exact source and host renderer keys. Invalid/stale batches and custom
content limitations are explicit; authored geometry keeps native precedence.
The writer blocks non-empty retained layout until the rendering slice. Defaults,
working history, review controls and PNG remain unchanged. See
[ADR 0075](adr/0075-plan-retained-layout-svg-fidelity.md) and
[contract evidence](assessments/2026-11-13-zloz-svg-layout-contract.md).
This closes the preceding contract proposal. D/C/Q and publication gates remain.

Next proposed slice: consume retained routes and label anchors in the SVG writer
and vector-adapter context, qualify emitted files, and expose explicit workbench
review opt-in before extending PNG. Recommendation: **needs review**.

**Retained layout SVG writer — implemented locally (2026-11-13), unreleased:**
The existing writer now consumes validated retained paths and centre label anchors,
matching native authored-geometry precedence. Vector adapters receive frozen route,
box and resolved geometry context; safe text primitives support middle baseline.
The planner's prior top-left interpretation of label bounds is corrected to the
native/ELK centre convention. Package review includes layout in exact-artifact
identity. The workbench offers unchecked SVG opt-in without changing source/Undo
or PNG. This supersedes the preceding planning-only writer restriction. See
[ADR 0076](adr/0076-write-retained-layout-svg.md) and
[verification and captures](../apps/zloz-demo/evidence/svg-retained.md).
D/C/Q, provider and publication gates remain unchanged.

Next proposed slice: opt-in retained-layout PNG review/encoding using the qualified
SVG boundary, with stale-result protection and pixel-budget/browser evidence.
Recommendation: **needs review**. No publication or provider activation is implied.

**Retained layout PNG — implemented locally (2026-11-13), unreleased:**
PNG review/encoding now qualifies the existing SVG layout context end-to-end.
Queued render payloads bind to validated, frozen routes/label boxes and copied
limits. Stale/changed/cancelled reviews cannot publish old pixels. The workbench
has an independent unchecked PNG setting with missing-route protection, preserving
source/Undo and the SVG choice. Existing dimension/pixel/byte limits apply before
allocation; custom badge pixels, light/dark output, transparency and 2x dimensions
have browser evidence. See [ADR 0077](adr/0077-adopt-retained-layout-png.md) and
[verification/captures](../apps/zloz-demo/evidence/png-retained.md).
This closes the preceding PNG proposal. D/C/Q and publication gates remain.

**Domain/compatibility reconciliation — completed locally (2026-11-13):**
[Current assessment](assessments/2026-11-13-zloz-domain-compatibility-reconciliation.md)
records exact package boundaries, delivered export/layout work, open D1–D2/C1–C4
items, proposed item-specific deferrals and Q/R evidence gaps. No scope deferral
is silently approved; full parity, core completion and a validated USP remain
unestablished. This closes the preceding documentation proposal.

**Headless DDD audit — implemented locally (2026-11-13), unreleased:**
`auditDddRelationships` uses the current resolver/catalogue and returns deterministic
entries for every authored edge: typed-compatible, blocked or unrelated. Structural
graph errors and invalid conventions reject separately; nested descriptors and
endpoints are detached. No meaning is inferred or graph/Undo/wire formats changed.
Literal expected reports and installed consumers qualify the headless contract.
See [ADR 0078](adr/0078-audit-declared-ddd-relationships.md) and
[package evidence](../packages/foldkit-zloz/evidence/ddd-relationship-audit.md).
This closes the prior headless-report recommendation. The local DDD completion
entry below now covers UI/CLI/delta integration; other D/C/Q/release gates remain.

**DDD Effect CLI audit — implemented locally (2026-11-13), unreleased:**
`zloz ddd audit` exposes the exact core report and per-edge diagnostics through an
additive `ddd-audit` JSON operation. Exits are 0 compatible, 1 incompatible, and 2
invalid input/rules/invocation. Version-one DDD catalogue files use bounded Effect
Schema decoding and core validation. Existing causal commands and convention
files remain separate. Node/Bun binary and installed-consumer evidence is linked
in [qualification](../packages/foldkit-zloz-cli/evidence/ddd-audit.md) and
[ADR 0079](adr/0079-expose-ddd-audit-through-effect-cli.md).
This closes the prior CLI recommendation; no publishing or manifest change.

**DDD review and comparison — implemented locally (2026-11-13), unreleased:**
The approved combined slice completes the D2 convention audit workflow: public
`compareModelDddRelationships`, standalone/current/edition review controls,
composable FoldKit views, live guarded edge/source/target navigation and Effect CLI
`ddd compare` with structured JSON. Findings use edge ID/code identity; one catalogue
applies to both sides. Exit 0 for comparison means no introduced findings, not a
compatible target. Invalid input/catalogues/edition selectors reject separately.
The workbench composes custom finding cards in History with independent baseline
and target selections, read-only edition navigation, paused playback, diagnostics
preferences and unchanged working graph/Undo. Tests, installed Node/Bun consumers,
light/dark browser evidence and API documentation are recorded in
[qualification](../apps/zloz-demo/evidence/ddd-audit.md) and
[ADR 0080](adr/0080-complete-ddd-audit-review-and-comparison.md).

D2 is complete for **authored relationship conventions and their audit/review/delta
workflow**. This does not establish universal DDD correctness, new topology rules,
DDD review packets or closure of D1/C/Q/R. Those are not silently counted as done.
No npm publishing, version bumps, deployment or provider activation.

**D1a workshop semantics — implemented locally (2026-11-13), unreleased:**
The package distinguishes external-system causal participants, portless hotspot
annotations with required authored open/resolved status, and portless lane groups.
Strict role/kind/port validation and public semantic projection preserve existing
world-coordinate membership, codecs, semantic history, live policies and Undo.
An explicit opt-in workshop relationship catalogue supports systems issuing and
handling commands/emitting events; the original default remains unchanged so old
builtin review packets remain reproducible. CLI data-only role decoding supports
external-system but rejects annotation/frame roles. DDD preview leaves new roles
unmapped; explicit replacement retains provenance and requires loss consent,
including hotspot status. Existing note artwork declines the roles; SVG reports
unqualified built-in artwork with explicit adapter/fallback escape paths. No new
renderer, theme, layout engine, annotation attachments or C4 conversion is claimed.
See [ADR 0081](adr/0081-define-eventstorming-workshop-semantics.md) and
[qualification](../packages/foldkit-zloz/evidence/event-storming-workshop.md).
This closes the approved headless vocabulary contract, not renderer, D1b/C/Q/R
qualification. No npm publishing or deployment.

**Native workshop presentation/editing — implemented locally (2026-11-13), unreleased:**
Package node/lane renderers now support external-system participants, open/resolved
hotspots and organizational frames using native geometry, sockets/collapse/resize,
shared headers and optional body caching. Status/content/controls and semantic
handle descriptions are composable, with scoped light/dark accent tokens. Pure
role/status controls recheck selection, visibility, revision, descriptor, lifecycle
and live policy before ordinary Undoable events. Explicit native status buttons,
visible protection reasons and custom layouts stay usable independently of numeric
diagnostics. Port additions to annotations/groups return capability denials without
changing graph/Undo. A public starter and Astro Inspect demo show opt-in conventions,
custom badges, facilitator protection, history read-only state and native keyboard
controls. See [ADR 0082](adr/0082-compose-workshop-renderers-and-controls.md) and
[tests/light-dark evidence](../apps/zloz-demo/evidence/workshop.md).
This closes the approved native presentation slice. Built-in portable SVG/PNG
artwork remains gated; causal defaults, codecs, D1b/C/Q/R and publication are unchanged.

**Portable workshop artwork — implemented locally (2026-11-14), unreleased:**
Built-in SVG now qualifies external-system outlines/ports, labelled lane frames and
open/resolved hotspot text with light/dark theme accents. Authored geometry/status
is preserved without changing graph, codecs or Undo. The original built-in
unsupported-role guard is superseded for these projections. Custom UI badges and
semantic edge notation still disclose fidelity loss and require explicit consent;
font/ink/wrapping findings remain. PNG uses the reviewed SVG unchanged, qualified
by actual Blob equality, independent RGBA comparison and local accent-pixel checks.
Workbench evidence covers both themes, preview/download bytes, status/theme
freshness and Undo. See [ADR 0083](adr/0083-qualify-workshop-portable-artwork.md) and
[artifact/browser qualification](../apps/zloz-demo/evidence/workshop-export.md).
This closes the portable workshop artwork slice, not D1b/C/Q/R or publication.

**D1b headless C4 mapping preview — implemented locally (2026-11-14), unreleased:**
`previewEventStormingC4Mapping` captures the complete source document, camera,
editions, fork ancestry and host session/revision. Explicit choices propose C4
node descriptors/names or plain communication labels; null retains source meaning.
No defaults infer scope, runtime boundaries, protocols or causal equivalence.
Ambiguous actor/external-system candidates remain advisory. Intent/facts/policies,
lanes and hotspots remain unmapped until explicitly interpreted or retained.
Existing node-kind rules and authored C4 endpoint checks apply. Loss disclosures
cover reserved meaning, authored status, organizational frames/membership, labels
and descriptions. Output is immutable source-ordered review data, with no graph,
editor event, consent token or Apply operation. See
[ADR 0084](adr/0084-preview-eventstorming-to-c4-mapping.md) and
[package qualification](../packages/foldkit-zloz/evidence/event-storming-c4-preview.md).
This closes the approved preview slice, not D1b conversion/containment, C/Q/R or
publication. No new edge schema, wire version, runtime dependency or npm publishing.

**D1b workbench mapping review — implemented locally (2026-11-14), unreleased:**
A dedicated C4 sidebar composes the package preview while preserving the canvas.
Native staged fields expose role, structural name, scope, technology and communication
labels. Preview, Retain, Clear and Reset change advisory choices only. Draft edits
revoke the affected prior choice; blank names and incompatible group roles are
protected. Source model/snapshot/ancestry, ambiguities, status/membership and other
losses stay visible independently of numeric diagnostics. Scoped requests reject
stale/foreign/hidden targets; historical/busy and other read-only reviews show
protection reasons. Graph/model/edition changes clear stale review; camera movement
keeps semantic choices while refreshing provenance. Native controls are keyed by
reviewed source/item, with a rendered-target status for accessible context.
See [ADR 0085](adr/0085-compose-c4-mapping-workbench-review.md) and
[local tests/visual evidence](../apps/zloz-demo/evidence/c4-mapping.md).
No conversion, Apply, loss-consent token, receipt, new public package API or npm
publication is introduced. This closes the workbench review slice, not D1b conversion
or broader C/Q/R qualification.

**D1b headless C4 conversion plan — implemented locally (2026-11-14), unreleased:**
Core now builds blocked/reviewable/unchanged plans over the public preview, with no
partial change list when intent remains unresolved. Each proposed node and every
direct member of a reinterpreted lane require explicit root, retained organization
or declared C4 containment. Group kind, local system→container→component hierarchy,
combined parent cycles and existing graph invariants are checked. Root detachment
preserves world geometry and discloses removed membership/parent settings; retained
notes cannot silently become runtime children. Complete source/history/ancestry and
explicit choices are frozen in provenance. Plan disclosures qualify membership
meaning, constraints and original workshop/status/relationship losses. A fresh-source
consent resolver binds affirmative acknowledgement to exact source, mappings,
placements and findings; consent is not Apply permission. See
[ADR 0086](adr/0086-plan-explicit-c4-conversion-and-containment.md) and
[package qualification](../packages/foldkit-zloz/evidence/event-storming-c4-conversion-plan.md).
No target graph, Apply, receipt, UI/CLI operation, new wire schema or npm publication
is introduced. D1b conversion/Apply and broader C/Q/R gates remain open.

**D1b workbench plan/placement review — implemented locally (2026-11-14), unreleased:**
The C4 sidebar now composes package plans and exact consent. Required-member
selection, staged root/organization/contained placement and explicit Review expose
package compatibility/blocker findings without selecting a parent automatically.
Source provenance, exact plan losses and affirmative/revocable acknowledgement
remain available in Minimal mode. A source/item scope, full plan key and host
review generation reject stale or withdrawn callbacks, including same-key camera
and read-only review round trips. Every update path reconciles review state,
including early-return reader/import branches. Obsolete membership choices are
pruned instead of resurrected when mappings return. Source model, ports, geometry,
editions and Undo stay unchanged. Local production keyboard/light-dark/history
captures and source/lineage comparisons qualify the bounded interaction path.
See [ADR 0087](adr/0087-review-c4-placement-and-exact-losses.md) and
[visual/test qualification](../apps/zloz-demo/evidence/c4-plan.md).
No Apply, receipt, new package API/wire version, npm publishing or deployment.
D1b atomic conversion and broader C/Q/R gates remain open.

**D1b package-level atomic C4 Apply — implemented locally (2026-11-14), unreleased:**
The public Apply API rebuilds current plans/containment and exact consent, compares
live graph/camera/revision, and checks lifecycle, read-only, external busy, enabled
Undo and live whole-transaction/architecture/label/membership policies. One shared
internal projection prevents review/publication drift. Every rejection leaves the
original editor intact; successful publication returns one graph Undo transaction
and a frozen source/choice/target provenance record together. Explicit containment
is policy-controlled even when its parent ID stays unchanged. Host identity,
synchronous editor/record publication and storage remain host responsibilities.
See [ADR 0088](adr/0088-apply-c4-conversion-atomically.md) and
[qualification](../packages/foldkit-zloz/evidence/event-storming-c4-apply.md).
No workbench Apply, portable receipt codec, npm publishing or deployment in this
slice. D1b host integration and broader C/Q/R completion gates remain open.

**D1b workbench atomic C4 Apply — implemented locally (2026-11-14), unreleased:**
The left sidebar now exposes guarded Apply after mapping/placement review and exact
loss acknowledgement. It rechecks core validation and live host semantic policies,
shows protection reasons, rejects stale/replayed callbacks and publishes editor plus
frozen conversion record in one synchronous update. Relevant policy round trips
withdraw consent and invalidate old callbacks. Retained source/target meaning remains
inspectable through Undo/Redo, example changes and Minimal mode. Records are tab-local
and separate from portable DDD receipts; reload loses them. Production light/dark
keyboard evidence checks protection, publication, retained provenance and exported
source/target graphs with one Undo/Redo. See
[ADR 0089](adr/0089-publish-c4-apply-and-provenance-in-workbench.md) and
[visual/test qualification](../apps/zloz-demo/evidence/c4-apply.md).
No C4 receipt download/import, new wire format, npm publishing or deployment.
D1b portable review and broader C/Q/R gates remain open.

**D1b portable C4 conversion receipts — implemented locally (2026-11-14), unreleased:**
The public core serializer/parser qualify the existing C4 v1 record as a strict
portable receipt. Both rebuild source/options and require exact complete target
projection, including camera, authored graph data, editions and ancestry. Unsupported
versions, unknown reserved fields, unresolved/invalid choices, non-reviewable plans
and target alterations are rejected. Decoding yields frozen data without Apply or
current consent. Receipts are unsigned consistency evidence, not authenticated history.

The workbench validates retained records before creating download Commands, retains
them on failure for retry, and reuses the bounded 5 MiB fatal-UTF-8 reader and detached
comparison for C4 and DDD. C4 has recorded placement/loss findings, before/after,
change navigation, overview and light/dark/Minimal-mode support. Invalid or stale reads
preserve the previous comparison and exact working editor/Undo; closing restores it.
See [ADR 0090](adr/0090-validate-portable-c4-conversion-receipts.md) and
[qualification](../apps/zloz-demo/evidence/c4-receipt.md). No npm publishing or deployment.
Broader domain/agent workflow and C/Q/R completion gates remain evidence-scoped.

**D1b Effect CLI C4 receipt inspection — implemented locally (2026-11-14), unreleased:**
`zloz c4 receipt inspect` strictly decodes portable C4 v1 receipts and reports full
source provenance, target document, explicit choices, before/after history changes
and recorded plan losses. JSON declares `authority: read-only-evidence`; historical
acceptance never grants current consent. Loss findings remain data and exit 0.
Unsupported format/version exits 1 without inspecting the payload; invalid input,
I/O/UTF-8/JSON, invocation and output failures exit 2 with structured diagnostics
and no partial inspection. The CLI retains its bounded 1 MiB file/stdin reader.
No Apply, session activation, file writes, dependencies, core/wire version changes,
npm publishing or deployment. See
[ADR 0091](adr/0091-inspect-c4-receipts-through-effect-cli.md) and
[CLI qualification](../packages/foldkit-zloz-cli/evidence/c4-receipt-inspect.md).

**Roadmap reconciliation — completed locally (2026-11-14):**
[The refreshed assessment](assessments/2026-11-14-zloz-core-roadmap-reconciliation.md)
closes the stale approved-domain implementation inventory, retains C1–C4/Q1–Q4
scope/qualification gates and corrects the batch-transaction gap: modelling patches
already support atomic multi-operation edits. No runtime or manifest change,
new scope exclusion, publishing or deployment is authorized.

**C1 headless mode/wire contract — implemented locally (2026-11-14), unreleased:**
`resolveConnectionPortPair` defines strict defaults and explicit loose input/output
kind compatibility without granting permission. Dedicated capture/parse/serialize
APIs persist v2 connection documents and retain authored data/camera; existing v1
codecs and editors remain strict. Legacy structural/connection validation now share
the strict matrix. Explicit downgrade planning blocks loose-only edges without a
partial snapshot or reports loose-mode removal before saving a strict-compatible
snapshot. Pinned pre-mode Node/Bun code rejects v2 and retains v1 editing/Undo.
See [ADR 0092](adr/0092-stage-explicit-v2-connection-documents.md) and
[qualification](../packages/foldkit-zloz/evidence/connection-v2.md). This is not loose
editor, model/archive, patch/receipt, layout, Mermaid/CLI or UI adoption; C1 remains
partial and C2–C4/Q/R are unchanged. No publication or deployment.

**C1 headless editor adoption — implemented locally (2026-11-14), unreleased:**
`createEditorFromConnectionDocument` revalidates/detaches explicit v2 source,
retains its mode and initializes its camera; legacy initialization stays strict.
The fixed session mode reaches editor-owned copying/validation, creation and
reconnection commits/contexts, ordinary edits and history. Current kind checks,
per-port/end/global policies, ordered duplicates and read-only/gesture guards
remain live. Creation source restaging carries explicit chooser intent in loose
mode; pointer reducer previews/releases share current validation. Successful edits
commit once and Undo/Redo retain mode; blocked/no-op edits add no history. Save
with `captureConnectionDocument(editor)`; no mode-changing event or portable
adapter support is implied. See [ADR 0093](adr/0093-adopt-connection-mode-in-headless-editor.md)
and [qualification](../packages/foldkit-zloz/evidence/connection-editor.md).
This advances C1's package editor contract; native/custom interactions and the
workbench are recorded in the follow-up below. Portable adoption and broader
C/Q/R gates remain open. No npm publication.

**C1 native/custom interactions — implemented locally (2026-11-14), unreleased:**
Native mouse/touch starts, nearby candidates and tap release follow the fixed editor
mode. Native labels and custom `connectionEnd` feedback distinguish source/target
activation while retaining authored kinds. Retained-node dependencies include mode;
view IDs scope input binding lifetimes. Wire release consumes the ensuing pointer
click once without swallowing keyboard activation. `/connections/` demonstrates
independent strict/loose histories, native/custom ports, protection, read-only and
light/dark themes in the shared left-sidebar shell. Package tests and local Chromium
keyboard/mouse/emulated-touch evidence are linked in [ADR 0094](adr/0094-adopt-loose-mode-in-native-port-interactions.md)
and [qualification](../packages/foldkit-zloz/evidence/connection-interactions.md).
This advances C1 interactions; real-device/AT/cross-browser, portable adoption and
broader C/Q/R gates remain open. No npm publication or deployment.

**C1 canonical v2 model/edition contract — implemented locally (2026-11-14), unreleased:**
Explicit v2 model and edition envelopes retain mode in every snapshot, including
historical and pinned-origin checkpoints. Strict/loose checkpoints can coexist
without inheriting current mode. Capture/parse/serialize validate and detach/freeze;
explicit v1 upgrades mark all legacy snapshots strict and refuse already-v2 data.
Whole-document/archive downgrade plans block any unrepresentable checkpoint or
report every loose-mode removal before exposing prospective v1 data. Current v1
snapshot writers reject explicit v2/loose snapshots, preserving ordinary strict
editor saves and existing v1 wire output. Actual pinned pre-canonical Node/Bun
readers reject v2 envelopes and retain v1 model/edit/Undo behavior. See
[ADR 0095](adr/0095-stage-canonical-v2-model-and-edition-documents.md) and
[qualification](../packages/foldkit-zloz/evidence/model-v2.md).
Canonical editor/history workflows, other portable adapters and broader C/Q/R
qualification remain open; C1 is partial. No npm publication or deployment.

**C1 v2 model initialization/read-only review — implemented locally (2026-11-14), unreleased:**
`createModelEditorV2` validates the whole canonical model and opens a detached current
snapshot session with its own mode and fresh Undo/Redo. `createHistoryReviewV2` pins
a detached edition and initializes a separate literal read-only editor in checkpoint
mode; authored camera wins, otherwise working camera is copied. Only zoom limits,
fit padding and copied surface size are inherited; review Undo capacity is zero.
`updateHistoryReviewV2` composes the fail-closed navigation whitelist and live
selection policies, rejecting authored edits, node measurement and Undo/Redo.
Strict/loose working/checkpoint combinations and installed Node/Bun/TypeScript
consumers qualify the boundary. See [ADR 0096](adr/0096-initialize-v2-models-and-review-editions.md)
and [qualification](../packages/foldkit-zloz/evidence/model-workflow-v2.md).
Forking is recorded below; append, comparison/ghosts, restore/playback, CLI/workbench
and broader C/Q/R gates remain open. C1 is partial. No npm publication or deployment.

**C1 v2 edition forking — implemented locally (2026-11-14), unreleased:**
`forkEditionV2` validates the whole source, selects an owned edition and freshly
checks policy against detached frozen source/edition/target identity. Invalid
identity, missing edition or veto returns no target. Allowed results retain the
checkpoint's exact mode/camera/data, start with no editions and pin their immediate
parent without mutating source or working history. `createModelEditorV2` composes
that data into a fresh target session with independent Undo; absent checkpoint
camera uses the target initializer's default, not review/working navigation.
Strict/loose mode pairs, policy failures, fork-of-fork and installed consumers
qualify the boundary. See [ADR 0097](adr/0097-fork-v2-editions-with-pinned-provenance.md)
and [qualification](../packages/foldkit-zloz/evidence/edition-fork-v2.md).
V2 append, comparison/ghosts, restore/playback, CLI/workbench and wider C/Q/R gates
remain open; C1 remains partial. No npm publication or deployment.

**C1 v2 edition comparison — implemented locally (2026-11-15), unreleased:**
`compareEditionsV2` validates checkpoints in their own modes and returns immutable
detached pins, stable-ID graph deltas and explicit unchanged/strict→loose/loose→strict
mode records. Mode-only changes set semantic change without inventing node/edge
changes; graph layout is independent. Camera/edition metadata are retained but
excluded from graph/mode flags. V1 comparison rejects explicit v2/loose inputs.
See [ADR 0098](adr/0098-compare-v2-editions-with-explicit-mode-changes.md) and
[qualification](../packages/foldkit-zloz/evidence/history-comparison-v2.md).
Presentation/ghosts, append, restore/playback and CLI/workbench adoption remain
open; C1 and wider C/Q/R gates stay partial. No npm publication or deployment.

**C1 v2 comparison presentation — implemented locally (2026-11-15), unreleased:**
`resolveHistoryComparisonPresentationV2` validates chosen checkpoints and returns
immutable comparison/text/visibility context. Optional FoldKit status parts expose
mode changes even without graph deltas; the v2 ghost wrapper reuses existing inert
geometry under the world transform. Saved per-layer choices survive minimal mode;
text, layout and marks are composable. Public tests, packed consumers and a static
light/dark Chromium fixture qualify this package boundary. See
[ADR 0099](adr/0099-present-v2-comparisons-with-mode-feedback-and-ghosts.md) and
[qualification](../packages/foldkit-zloz/evidence/history-presentation-v2.md).
This is not mounted workbench/CLI adoption or restore/playback. Those boundaries,
v2 change navigation/append and wider C/Q/R gates stay open; C1 remains partial.
No npm publication or deployment.

**C1 v2 change navigation — implemented locally (2026-11-15), unreleased:**
Package resolvers and optional native/custom FoldKit controls include an explicit
mode-change entity without a fake graph ID or reveal event. Direct focus and
Previous/Next preserve the host's chosen side, freshly check scope/filters/reasons
and block absent-side items without fallback or skipping. Independent read-only
reviews retain checkpoint modes and working history. Tests, installed consumers,
a side-target mutation and static light/dark evidence qualify the boundary. See
[ADR 0100](adr/0100-navigate-v2-changes-with-explicit-mode-inspection.md) and
[qualification](../packages/foldkit-zloz/evidence/history-navigation-v2.md).
V2 append/merge, restore/playback, CLI/workbench adoption and wider C/Q/R gates
remain open; C1 stays partial. No npm publishing or deployment.

**C1 v2 edition append — implemented locally (2026-11-15), unreleased:**
`appendEditionV2` validates/detaches the whole archive and candidate, preserves
checkpoint modes/cameras/data and returns a frozen ordered appended archive only
for a fresh ID. Reused IDs block with explicit duplicate/conflict codes and frozen
existing/proposed pins for comparison, never a replacement archive. Current model,
origin and working/review histories remain independent. See
[ADR 0101](adr/0101-append-v2-editions-with-explicit-identity-conflicts.md) and
[qualification](../packages/foldkit-zloz/evidence/edition-append-v2.md).
This headless slice adds no UI or persistence authority. V2 merge, restore/playback,
CLI/workbench and wider C/Q/R gates remain open; C1 stays partial. No npm publishing
or deployment.

**C1 v2 history/workflow completion batch — implemented locally (2026-11-15), unreleased:**
Atomic v2 merge validates both collections, skips identical imports and blocks all
conflicting additions. V2 model sessions own graph+mode Undo frames with compatible
graph projections; guarded restore rechecks revision, lifecycle and live policies,
including mode-only transactions. Mixed-mode playback pins independent read-only
reviews, with opt-in timing, pause/rewind and reduced-motion handling. Side-aware
ghosts retain chronological meaning; incompatible clipboard paste after cross-mode
Undo reports a reason without losing data or Redo.

The mounted `/history/` workspace composes capture, bounded v2 model/archive I/O,
comparison/ghosts/change navigation, playback and protected preview/restore in four
sidebar sections. Epoch/run/import tokens reject stale work; previous working
sessions retain their own history. Light/dark/minimal and real mounted file/playback
flows are qualified. See [ADR 0102](adr/0102-complete-v2-history-workflows.md),
[package qualification](../packages/foldkit-zloz/evidence/history-workflow-v2.md) and
[mounted evidence](../apps/zloz-demo/evidence/history-workflow-v2.md).

This closes the approved **v2 history/workflow batch**, not all C1 compatibility.
Existing architecture/connection workspaces remain independent. V1 formats reject
v2 input; broader patch/receipt/review-packet/Mermaid/CLI and layout adoption remains
separate. C2–C4/Q/R are unchanged. No npm publishing or deployment.

**C1 v2 portable capability/decision batch — implemented locally (2026-11-15), unreleased:**
`assessPortableCompatibilityV2` validates current, archived and origin checkpoints,
reports native/projected/version-required adapter capabilities and whole-model
strict downgrade findings without prospective downgraded data or Apply authority.
Mode-aware layout requests retain ordered endpoints and graph/mode Undo; real ELK
and force engines are covered. Explicit Mermaid v2 bundles retain mode and identity,
with source-only loose semantics/camera losses requiring report consent. Legacy
graph-only Mermaid remains strict. Effect CLI supports bounded v2 validation,
`compatibility inspect` and explicit v2 Mermaid projection; v1-only operations
report valid-but-incompatible input with exit 1, distinct from invalid data (exit 2).

See [ADR 0103](adr/0103-qualify-v2-portable-adapter-boundaries.md) and
[batch qualification](../packages/foldkit-zloz/evidence/portable-compatibility-v2.md).
This closes the capability decisions and safe adoption, not all C1 portability.
V1 patches, conversion receipts, review packets and relationship audits remain
version-required boundaries. Their native v2 formats are not shipped. C2–C4/Q/R
stay open; no npm publishing or deployment.

**C1 native v2 authoring/review batch — implemented locally (2026-11-15), unreleased:**
Mode-aware connection audits and model comparisons reuse domain rules and include
checkpoint modes. V2 patches pin source mode/session/revision, preserve ordered
ports and use live policy/consent checks for atomic Apply with one Undo. Strict
v2 patch receipts recompute the result. C4/DDD native previews, plans, consent,
Apply and v2 receipts retain complete source/target models, camera and all archive/
origin modes, with bounded consistency validation before read-only reopening.
V1 readers and default wrapper contracts remain fixed at v1.

V2 review packets retain selected snapshots/modes, audit deltas and v2 Mermaid
projections; strict reopening recomputes them and can create an independent
read-only review. Generated evidence checks reopening budgets. Effect CLI selects
native v2 audit/compare, patch dry-run and packet paths; C4/DDD v1/v2 and patch v2
receipt inspectors return explicit read-only evidence and validation/incompatibility
exits. Native packet creation respects the CLI's stricter byte limit.

See [ADR 0104](adr/0104-adopt-native-v2-authoring-and-review.md) and
[qualification](../packages/foldkit-zloz/evidence/native-authoring-review-v2.md).
This closes the approved **native package/CLI authoring and review batch**. It does
not migrate existing mounted workbench file/control flows or close all C1/C2–C4/Q/R.
No npm publishing, deployment or PR.

**Recommended next:** one mounted native v2 authoring/review workbench slice:
visible audit/patch/loss review, guarded Apply/Undo, receipt and packet download,
and read-only reopening using these package APIs. Capture mounted light/dark
and file-flow evidence.
