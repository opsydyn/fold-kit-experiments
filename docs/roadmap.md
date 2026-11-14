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
[0.169 notes](releases/foldkit-0.169.md).

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

- [ ] Columnar data input: `data` accepts a column table (names to typed or plain
      arrays, and a length) as well as rows. `read` gets a column path, and dense
      marks read typed columns directly. Transforms that write new rows keep
      writing rows.
- [ ] An Arrow adapter typed structurally (`numRows`, `getChild(name).toArray()`),
      so flechette and apache-arrow tables plot without foldkit-viz depending on
      either.
- [ ] A JSON Schema for `PlotSpec`, generated from the types and published with
      the package, with every example spec in the repo checked against it, so
      Rust (`serde`) and Python programs can emit checked specs.
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

**Status:** user-defined roadmap direction. Brand migration, new sites and hosting
are planned delivery slices; this entry records their intended scope.

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

### Planned delivery

1. **Brand and naming migration.** Inventory public copy, documentation, package
   names, imports, types, routes and examples before applying the Flow → Zloz
   rename. Decide technical names and compatibility/migration handling explicitly;
   external branding does not by itself rename existing APIs or saved formats.
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
6. **Publication last.** Finish feature work and site qualification before the
   npm publication slice. Verify chosen ASCII package names, migration guidance,
   packed-consumer behavior and release automation at that boundary.

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
logo directions and promo/demo information architecture. Their technical names
remain proposals for implementation review. The user selected **B — Nested frame**
after reviewing the three SVG concepts.

**Next bounded promo slice:** export the edited Compose graph as canonical JSON
and Mermaid, with explicit conversion-loss review. The static shell, highlighted
developer guide and native Compose island are implemented locally.
Both board and promo must keep the Viz/Three family styling, including light/dark
themes; a separate dark-green identity is not intended. The separate
feature recommendation for searchable sidebar settings remains on the workbench
track.

**Suggested workbench UX follow-up:** make the mini map discoverable in Navigation
with a **Mini map** toggle, rather than **Overview** under Diagnostics. Reuse the
existing `overview` flag and respect global diagnostics/Minimal mode. This is a
proposed follow-up prompted by the user's difficulty locating the control.

## Zloz core: parity and domain modelling — 2026-11-08

**Status:** review completed; proposed delivery order, not implemented features.
The [current core assessment](assessments/2026-11-08-zloz-core-parity-and-domain-roadmap.md)
records capability gaps, package ownership, compatibility constraints and the
claim-to-evidence map. Full React Flow parity and competitive superiority are
not established.

Maintain two tracks: a reliable, customizable editor floor and a differentiated
architecture modelling lifecycle. Package-owned functionality stays reusable;
Astro is the demonstration shell. Prioritize the following bounded slices:

1. **DDD preset renderers — implemented locally:** all eight existing semantic
   roles have composable node/group presentation and a light/dark Order aggregate
   demo. See the [qualification receipt](../apps/zloz-demo/evidence/ddd-renderers.md).
2. **History and time travel — first slice implemented locally:** a first-class
   product pillar. Core owns named immutable editions, a separate versioned archive,
   read-only review and semantic/layout comparison. The optional Foldkit ghost
   layer composes with the History sidebar and Order editions demo. See the
   [qualification receipt](../apps/zloz-demo/evidence/history.md). The subsequent
   [import/restore slice](../apps/zloz-demo/evidence/edition-restore.md) adds atomic
   archive merge and explicit graph-only restore with one Undo, required freshness
   and live policy checks. The fork slice adds separate model identity, pinned immediate origin, an independent editor/Undo and model JSON; playback and automatic persistence remain open.
   Start with named
   immutable editions, read-only rewind and return to the present; then semantic/
   layout comparison and explicit restore or fork into a new working model.
   Include opt-in ghost nodes/edges, previous positions and movement connectors
   like Tech Radar, with clear change states and independent visibility controls.
   Establish the contract before expanding persisted domain vocabulary.
3. **Atomic pattern insertion:** validated fragments, deterministic ID remapping,
   policy checks, full rollback and one Undo per insertion.
4. **DDD relationships/context maps:** typed tactical and strategic meaning,
   serialization and conversion-loss handling; respect portless group boundaries.
5. **EventStorming discovery:** explicit compatibility decision, configurable
   semantic cards, optional links and valid uncertainty; then workshop patterns
   and deliberate links to DDD/C4 concepts.
6. **Agent modelling operations:** build on the standalone CLI with validated
   patches, dry runs and reviewable changes; no automatic writable-agent rollout.

Alongside these, evaluate authored edge waypoints, palette/drop workflows and
image export against architecture tasks. Coordinate collaboration with its
separate proposal; no collaboration runtime is claimed here. Keep accessible
interaction and unrestricted visual composition in each slice. Retain the later
comprehensive a11y qualification gate and publication-last decision.

**Recommended next:** composable packet export controls in the workbench: use the
chosen audit baseline/target, preview scope and conversion losses, then explicitly
consent to a JSON download through the public builder. Preserve the current graph
and Undo. Keep packet import and executable agent actions outside that UI slice.

Portable review packets are implemented locally in the optional Mermaid package
and Effect CLI. Chosen snapshots, model/source identity, a complete data-only
convention catalogue, audit comparison and both Mermaid projections travel in a
versioned JSON envelope. Conversion losses require report-mode consent; errors
reject atomically. Artifact creation is separate from semantic regression gating.
There is no packet import, workbench export UI or publication in this slice.

A package-level read-only causal audit and Effect CLI command are implemented
locally. Reports classify every edge in deterministic identity order, preserve
typed/inferred/unrelated distinctions and return structured semantic reasons.
The CLI scopes model audits to the current graph and supports bounded data-only
custom rule catalogues, with distinct compatibility and input-error exits.

Edition-aware audit comparison is implemented locally at package and Effect CLI
level. Explicit owned baseline/target editions (or current graph as target) use
one convention and report introduced, resolved and persisting findings with both
full audits. Comparison exit 1 gates new findings; existing incompatibilities stay
visible even when there is no regression. Missing IDs fail closed. No UI,
serialization migration or publication is claimed for this slice.

Composable audit comparison controls are implemented locally in the package and
demonstrated in the workbench sidebar. Baseline/target selection stays independent
of the displayed camera. Category filters, custom finding cards and source-aware
reveal keep resolved edges on the baseline and other findings on the target.
Requests recheck model/comparison/finding identity, filters and host protection;
the host also checks epochs, pauses playback for navigation and preserves working
graph/Undo. Numeric status/counts follow minimal mode and global diagnostics.

Composable causal controls are implemented locally: a pure current-edge context,
identity-safe request resolver, native select/inference/status/reason helpers and
nullable rendering/layout slots. The workbench consumes the public controls with
custom wrappers and rechecks target/model scope, current conventions and policy.
Unknown stored meanings remain visible, and inference is explicitly undoable.

Typed causal relationships are implemented locally with six default conventions,
named custom rules, extensible role interpretation, strict descriptor syntax,
opt-in composed policies and undoable semantic edits. The detailed workbench
process adds an aggregate root and demonstrates unresolved drafts, readable
protection reasons and custom Delegates relationships. Mermaid discloses semantic
loss instead of silently claiming descriptor fidelity.

Package-owned change navigation is implemented locally with composable kind
filters, accessible entries, explicit scoped focus requests and live protection
reasons. The workbench demonstrates custom badges, current/removed geometry
focus and playback pause while preserving the working model and Undo.
Package-owned comparison controls are implemented locally: identity-safe baseline
selection, independently retained ghost preferences, minimal-mode visibility,
visible host restrictions and native composable Foldkit controls. The workbench
uses the public contract for controls and effective canvas visibility.
The edition scrubber is implemented locally with identity-based seeking, custom
labels/value text, native range/Open helpers, renderer slots and host session
guards. An eight-checkpoint workbench sample demonstrates direct navigation. Composable package playback controls, status,
availability reasons, ordered subsets and renderer/layout slots are implemented
locally; the workbench uses the public helpers with a custom visual composition. Opt-in deterministic edition playback, pause,
rewind and reduced-motion handling are implemented locally, using existing
read-only projections and optional ghost comparisons.
Event-storming command, domain-event, policy and actor notes, a composable package
renderer and process starter are now implemented locally with existing geometry,
serialization and atomic insertion APIs. Atomic pattern insertion is
implemented locally with validated self-contained fragments, explicit ID maps,
live policies, C4/DDD starters and one Undo per insertion. Model-document
workbench import and CLI validation are now implemented locally with explicit
identity conflicts and conversion-loss reporting. Forking is implemented locally with package-owned
model identity, pinned source edition, independent editing/Undo, policy checks,
session switching and an explicit model codec. Graph/snapshot/edition v1 remain
unchanged. The existing diagram importer remains graph/snapshot-only; Open model
JSON and CLI readDocument preserve the full envelope. Mermaid projection requires
explicit loss consent. See [the adapter qualification receipt](../apps/zloz-demo/evidence/model-import.md)
and [the fork qualification receipt](../apps/zloz-demo/evidence/model-forks.md).
DDD renderers retain the current
descriptor contract without new persisted fields. Proposed positioning to validate: model a domain
with people, explore how its architecture evolves, and review/communicate the
same portable model with human and agent tooling. Shapes alone, Undo and layout examples do not establish a USP.

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
- [ ] Add API reports or generated type-surface checks for public exports.
- [ ] Add compatibility coverage for the supported Astro range.
- [ ] Publish migration notes for FoldKit minor/breaking changes such as `matchDataSplitEmpty` and route `Transition`.
- [x] Track package changelogs and versioning independently with release-please (`astro-foldkit` versus `foldkit-viz`).
- [ ] Add performance checks for bundle size and large chart datasets.

## Deliberate Non-Goals

- [ ] Do not make `foldkit-viz` depend on `foldkit/http` or `experimental/machine`.
- [ ] Do not build a second router inside either package.
- [ ] Do not turn `foldkit-viz` into a DOM/event runtime; keep rendering and browser wiring at the app boundary.
- [ ] Do not treat broad baseline lint cleanup as a prerequisite for product slices.
