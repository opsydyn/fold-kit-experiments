# Composable FoldKit charts implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for inline execution, or superpowers:subagent-driven-development if the user selects delegation. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let developers compose line, histogram and scatter charts with custom data, themes, tooltips and annotations while preserving FoldKit's Elm architecture.

**Architecture:** Pure Cartesian geometry and themes live in Viz; an optional FoldKit subpath renders independent layers with the parent's builder. Promo Models own settings, selection and measured width. Existing child charts demonstrate semantic out messages and `foldChild` composition.

**Tech Stack:** TypeScript, FoldKit 0.165.0, Effect 4.0.0, Astro 7.1.1, Bun, tsdown, oxlint and oxfmt.

**Spec:** [Approved design](../specs/2026-10-04-composable-foldkit-charts-design.md).

## Global constraints

- Use FoldKit 0.165.0, Effect 4.0.0, Astro 7.1.1 and the current Bun workspace tools.
- Work in the attached `codex/foldkit-viz-promo` worktree; preserve unrelated work.
- Keep mathematical and root imports free of runtime FoldKit, Effect and browser dependencies. Never re-export the optional adapter from the root barrel.
- Model → view → Message → update → Model remains the only state flow. Accessors, builders, callbacks and DOM elements stay outside serialised Models.
- Use past-tense Messages, union `.match`, `foldChild` and `foldChildInits`; preserve child Commands and out messages.
- Resolve the missing `d3-main/` reference before changing maths: use the official upstream source pinned to a commit, record provenance, and add no D3 runtime dependency.
- Preserve editor sessions, controls and export feedback. Exported projects vendor this checkout's compiled Viz modules, not an unpublished npm version.
- Commit verified work. Do not push, publish or deploy. Restore healthy dev mode on port 4321 after checks.
- Full catalogue migration, a React adapter, remote-data changes and comprehensive colour-interpolation parity repair are excluded.

## Review focus

- Filtered/reordered series retain colours and datum identities; empty palettes and duplicate datum keys fail clearly.
- Empty, singleton, constant, negative, reversed-domain and non-finite data never emit invalid accepted geometry; line gaps remain gaps.
- A resize during inspection or editor use updates plot coordinates without losing settings, selection or the editor session; observer cleanup runs on unmount.
- CSS variables, named colours, RGB strings and `currentColor` remain valid paint; opacity is independent and the configured area colour is honoured.
- Exported projects include emitted module dependencies and declarations and compile outside the workspace; the root import also works without FoldKit installed.

## Task 1: Pure Cartesian geometry

**Files:** Create `packages/foldkit-viz/src/chart/{layout,geometry,cartesian}.ts` and `test/cartesian.test.ts`. Modify `src/math/scale.ts`, `src/index.ts`, `package.json`, `tsdown.config.ts` and `test/package-import-smoke.test.ts` in the same package.

**Interfaces produced:** All records are readonly. `Domain = readonly [number, number]`; `ChartMargins = { top; right; bottom; left: number }`; `ChartFrame = { width; height: number; margins: ChartMargins }`. `CartesianConfig` contains `frame`, optional `xDomain`/`yDomain`, `xTickCount`/`yTickCount` and `includeZero: { x: boolean; y: boolean }`.

`CartesianLayout` exposes `frame`, plot bounds `{ left, right, top, bottom, width, height }`, resolved domains and `x(value)`/`y(value)` projection functions. `AxisTick = { value: number; position: number }`. `DatumAccessors<T>` contains `x`, `y`, `datumKey` and `seriesKey`, each accepting `(datum: T, index: number)` and returning a number or string as appropriate.

`ProjectedDatum<T> = { datum: T; key: string; seriesKey: string; x: number; y: number }`. `ScatterGeometry<T>` exposes `layout`, `points`, `xTicks`, `yTicks`. `LineGeometry<T>` also exposes `series: ReadonlyArray<{ key: string; path: string; points: ReadonlyArray<ProjectedDatum<T>> }>`.

```ts
lineGeometry<T>(data: ReadonlyArray<T>, accessors: DatumAccessors<T>,
  config: CartesianConfig & { curve?: CurveType; defined?: (datum: T, index: number) => boolean }): LineGeometry<T>
scatterGeometry<T>(data: ReadonlyArray<T>, accessors: DatumAccessors<T>,
  config: CartesianConfig): ScatterGeometry<T>
histogramGeometry<T>(data: ReadonlyArray<T>, value: (datum: T) => number,
  config: HistogramConfig): HistogramGeometry<T>
```

`HistogramConfig` contains `frame`, optional `domain`, `gap`, `xTickCount`, `yTickCount` and a mutually exclusive bin policy: `{ binCount: number } | { thresholds: ReadonlyArray<number> }`. Histogram output exposes layout/ticks and bins `{ key, x0, x1, count, x, y, width, height }`. Bin keys derive from interval bounds, never the filtered position. Counts use a zero baseline. For Cartesian calls, tick counts default to five and zero inclusion defaults to false on both axes; histogram defaults to five ticks and zero gap. Validate integer tick counts of at least two.

- [x] **Step 1: Write failing geometry tests.** Use a 200×100 frame with zero margins and explicit domains `[0,10]`/`[-10,10]`. Project `(0,-10)`, `(5,0)`, `(10,10)` to `[0,100]`, `[100,50]`, `[200,0]`. A linear path is `M0,100L100,50L200,0`. For domain `[5,5]`, range `[0,100]`, assert `linear(...)(5) === 50`. For histogram values `[0,2,5,10]`, domain `[0,10]`, two bins, assert counts `[2,2]` and bounds `[[0,5],[5,10]]`.
- [x] **Step 2: Add boundary cases and observe RED.** Empty marks are empty; singleton explicit-equal-domain X is 100; auto constant zero expands to `[-1,1]` unless zero inclusion requires it already; all accepted positions are finite. Auto constant `v` expands by `max(abs(v)*0.1,1)` on each side. Negative extrema remain represented. Reversed domains reverse positions. A non-finite middle line value produces two subpaths rather than one connecting segment. Duplicate keys, invalid frame dimensions/margins, non-positive or non-integer bin counts, negative gaps and non-finite domain endpoints throw descriptive errors. Exclude non-finite histogram values. Run `bun test packages/foldkit-viz/test/cartesian.test.ts`; failures must identify absent API or current equal-domain behaviour.
- [x] **Step 3: Implement the contracts against the pinned upstream reference.** Keep layout/domain policy in `layout.ts`, mark calculations in `geometry.ts`, exports in `cartesian.ts`. Derive domains from finite samples, apply explicit zero inclusion, then expand constants for automatic ticks. Preserve explicit equal domains and use the corrected midpoint scale. Group line records by stable series key while retaining undefined samples as gaps; use existing `line` and `bin` primitives. Clamp histogram gap to available bin width so accepted narrow frames never yield negative mark width. Reject non-finite derived coordinates rather than emit invalid SVG values.
- [x] **Step 4: Export and verify.** Add `chart/cartesian` to exports, typesVersions and build entries; root exports are pure. Extend the existing packed consumer test to execute the three public geometry functions under Bun and Node with no FoldKit installation. Run the focused test, Viz typecheck, Viz build, then Viz tests sequentially; require exit 0.
- [x] **Step 5: Commit** as `feat(viz): add composable Cartesian geometry` after root lint/format and typechecks pass.

## Task 2: Semantic themes and stable series styling

**Files:** Create `packages/foldkit-viz/src/chart/theme.ts` and `test/chart-theme.test.ts`. Modify its root barrel, package exports and build entries. Modify `apps/web/src/ui/{line-chart,area-chart}/index.ts`; add `apps/web/src/ui/shared/render-chart.test-helper.ts`, `apps/web/src/ui/line-chart/paint.test.ts` and `apps/web/src/ui/area-chart/paint.test.ts`.

**Interfaces produced:** `ChartTheme` contains `background`, `text`, `mutedText`, `grid`, `axis`, `focus`, `selection`, `tooltipBackground`, `tooltipText`, `fontFamily`, `labelSize`, and `series: SeriesStyle`. `SeriesStyle` contains `stroke`, `fill`, `opacity`, `strokeWidth`, `pointRadius`, `symbol: SymbolType`, and `dashPattern: string`. Export `lightTheme`, `darkTheme`, `themeProperties(theme): Readonly<Record<ChartThemeProperty,string>>`, where `ChartThemeProperty` is the finite union of documented `--chart-*` property names, and:

```ts
resolveSeriesStyle(theme: ChartTheme, chart: Partial<SeriesStyle>,
  series: Partial<SeriesStyle>, datum: Partial<SeriesStyle>): SeriesStyle
createSeriesStyles(domain: ReadonlyArray<string>, palette: ReadonlyArray<string>,
  overrides?: ReadonlyMap<string, Partial<SeriesStyle>>): ReadonlyMap<string, SeriesStyle>
```

- [x] **Step 1: Write tests and observe RED.** Resolve `stroke: 'var(--brand)'`, `fill: 'currentColor'` and `opacity: 0.25` unchanged. Give the theme radius 3, chart radius 4, keyed-series radius 5 and datum radius 6; assert radius 6 with untouched theme stroke. Create a map for `['alpha','beta']`, then look up beta after filtering/reversing the data; its colour stays the palette's second colour. Reject an empty palette; cycling `['a','b','c']` over two colours assigns c the first colour. Duplicate series-domain entries must not consume extra palette slots. Reject opacity outside `[0,1]` and invalid mark sizes. Run `bun test packages/foldkit-viz/test/chart-theme.test.ts`.
- [x] **Step 2: Implement the pure theme API.** Use immutable override resolution and stable domain order. Paint strings are opaque to geometry/rendering. Semantic properties cover both modes, including focus and tooltip contrast. No DOM access, colour-string parsing or global mutable theme store.
- [x] **Step 3: Pin the demo paint regression.** Create the app-local test helper using the real `foldkit/experimental/server` rendering boundary with a minimal schema-valid application; run its Effect only in the test helper. Render the actual demo line view with `color: 'var(--brand)'` and `areaColor: 'rgb(10,20,30)'`; assert the area's fill is exactly the configured area colour. Render the area view with `color: 'currentColor'`; assert paint stays `currentColor` and fill opacity is independently `2/15`, matching the previous `22` alpha. Observe failing assertions before replacing suffix concatenation. Task 3 uses the same rendering technique in its separate package-local helper, so this task has no dependency on later files.
- [x] **Step 4: Verify** theme tests, the two demo regression tests, package build/typecheck and root checks. These are paint tests, not a claim that CSS variables can be numerically interpolated.
- [x] **Step 5: Commit** as `feat(viz): add semantic chart themes and keyed styles`.

## Task 3: FoldKit layers and child composition

**Files:** Create `packages/foldkit-viz/src/foldkit/{frame,axes,series,annotations,accessibility,cartesian}.ts`, `test/foldkit-cartesian.test.ts`, and `test/render-chart.ts`. Update package exports/build entries, keeping the root barrel unchanged. Modify `apps/web/src/ui/{scatter-chart,histogram-chart}/index.ts` and `apps/web/src/apps/linked-charts/update.ts`; create `apps/web/src/apps/linked-charts/fold.ts` and extend its `update.test.ts`.

**Interfaces consumed:** Task 1 geometry and Task 2 theme/style records. Each public rendering function accepts `h: HtmlBuilder<M>` first and returns `Html`. All callbacks stay render-scoped.

**Interfaces produced:** Export the following options and functions from `foldkit/cartesian`:

- `chartFrame(h, options: { layout; title; description; theme; interactive?: boolean; onKeyDown?: (key: string) => Option.Option<M> }, children: ReadonlyArray<Html>)`.
- `axis(h, options: { layout; orientation: 'bottom'|'left'; ticks; label; format: (value: number) => string; theme })` and `grid(h, options: { layout; xTicks; yTicks; theme })`.
- `lineSeries(h, options: { path: string; style: SeriesStyle })`.
- `pointSeries<T,M>(h, options: { points; styleFor: (point: ProjectedDatum<T>) => SeriesStyle; labelFor: (datum: T) => string; activeKey: string|null; onInspect?: (key: string) => M })`. Points do not individually enter the tab order; the chart keyboard handler owns navigation.
- `barSeries(h, options: { bins; styleFor: (bin) => SeriesStyle; labelFor: (bin) => string })`.
- `legend(h, options: { entries: ReadonlyArray<{key;label;style}>; theme })` and `dataTable(h, options: { caption; headers: ReadonlyArray<string>; rows: ReadonlyArray<ReadonlyArray<string>> })`.
- `annotation(h, options: { layout; axis: 'x'|'y'; value: number; label: string; style: SeriesStyle })`.
- `tooltip<T,M>(h, options: { point: ProjectedDatum<T>; style: SeriesStyle; theme: ChartTheme; render?: (context: { datum: T; x: number; y: number; style: SeriesStyle }, h: HtmlBuilder<M>) => Html })`.

All option fields refer to the produced types above: `layout: CartesianLayout`, `theme: ChartTheme`, ticks are `ReadonlyArray<AxisTick>`, marks use the corresponding geometry records and styles are `SeriesStyle`. Titles, descriptions, labels and keys are strings; coordinates are numbers. The app-local `makeLinkedChartFolds(updaters: {scatter: typeof Scatter.update; histogram: typeof Histogram.update})` returns `scatter(model: Model, message: Scatter.Message)` and `histogram(model: Model, message: Histogram.Message)` steps returning `Return<Model, Message>` for the linked-chart parent. Its production caller supplies the actual chart updaters.

- [ ] **Step 1: Create real render tests and observe RED.** `render-chart.ts` supplies a minimal schema-valid application to `foldkit/experimental/server`'s `renderToString`; run that Effect only at the test boundary and consume its returned HTML. Render a 200×100 plot with an annotation at Y=0 on domain `[-10,10]`; assert its line is at Y=50. Compose grid, series and annotation in that order; assert emitted element order. Assert `var(--brand)`, independent opacity and a custom tooltip's original datum text survive rendering. Assert a captioned data table contains all raw values and long labels. No mocked HtmlBuilder, internal singleton calls or fake vnodes.
- [ ] **Step 2: Implement the small rendering modules.** Theme tokens style frame/axes/text; series paint comes from resolved styles. Symbols use the existing symbol primitive. Tooltips are positioned from projected points. The layer functions own neither Model nor effect runtime. Add only the optional subpath export and build entry.
- [ ] **Step 3: Establish the existing linked-chart application contract.** Scatter adds `OutMessage.InspectedPoint({key: label,x,y})` and `ClearedInspection()`; histogram adds `OutMessage.InspectedRange({domain:[x0,x1]})` and `ClearedInspection()`. Hover/keyboard transitions emit semantic out messages through `ReturnWithOutMessage`; other handlers preserve normal return records. The parent uses `foldChild` and folds these events into sibling updates instead of inspecting child Message tags. Include the final histogram endpoint in the final bin. Preserve the existing `foldChildInits` initialisation.
- [ ] **Step 4: Observe a child-composition regression fail, then verify the fix.** Exercise the real linked-chart parent updater with hover and clear messages. Assert sibling inspection follows the data-domain event and clearing removes it. Test `makeLinkedChartFolds` with a decorator around the real scatter updater that adds one declared chart-local Command to its inspection result. Assert the returned Command's completion folds to the parent scatter Message and the histogram Model is updated. The factory is the production composition boundary, not a test-only hook. Run the renderer tests, linked-chart tests, Viz typecheck and root tests; require exit 0.
- [ ] **Step 5: Commit** as `feat(viz): add FoldKit chart layers and semantic composition` after checks pass.

## Task 4: Three responsive reference charts

**Files:** Modify `apps/promo/src/examples/{line,histogram,scatter}/{chart,model,message,update,view,source}.ts` and their `chart.css` files. Create a `measurement.ts` in each example, plus shared `apps/promo/src/examples/shared/{measurement,frame}.ts`. Modify the three `apps/promo/src/lib/*-sources.ts` loaders and `apps/promo/package.json`. Add `apps/promo/test/chart-composition.test.ts` and extend `live-{line,histogram,scatter}.test.ts` and `live-editor.test.ts`. Modify `apps/promo/src/styles/site.css` only for chart semantic tokens.

**Interfaces consumed:** Tasks 1–3 public APIs. **Interfaces produced:** Each existing geometry wrapper delegates to the public geometry API while retaining its current return fields. Line `chartGeometry(settings, options?: {frame?: ChartFrame; xDomain?: Domain; yDomain?: Domain})`, scatter `scatterGeometry(data, settings, options?: {frame?: ChartFrame; xDomain?: Domain; yDomain?: Domain})` and histogram `histogramGeometry(values, binCount, options?: {frame?: ChartFrame; domain?: Domain})` retain existing arguments; optional domains override demo settings. Shared `frameForWidth(width: number, height: number): ChartFrame` uses margins `{top:30,right:24,bottom:60,left:48}` and requires usable plot space. Shared `widthChanges(element: Element): Stream.Stream<number>` publishes finite positive CSS widths, suppresses equal measurements and owns a scoped ResizeObserver.

- [ ] **Step 1: Write tests and observe RED.** Pass unrelated custom datasets through the wrappers rather than importing fixtures. A singleton line is finite; a negative scatter datum with an explicit negative domain is represented; histogram custom bins preserve counts. For `RecordedChartWidth({width:324})`, assert the Model changes only measured width, retaining chart settings, selected point and editor session. Invalid width messages preserve the Model. Existing pixel-coordinate tests pass an explicit old 560px frame where that geometry is their actual subject.
- [ ] **Step 2: Add measurement as FoldKit facts.** Each Model stores `chartWidth: number`, initially 560; each Message union gains `RecordedChartWidth({width:Schema.Number})`. Each local `measurement.ts` defines a top-level `Mount.defineStream` mapping the shared `widthChanges` stream to its own Message. Attach it to the stable chart container. Implement the shared stream with `Stream.callback` and `Effect.acquireRelease`: acquire/observe the ResizeObserver in the Effect and disconnect it in release. Emit an initial measured width. No direct dispatch, element references in Model or observer created during rendering.
- [ ] **Step 3: Compose the public layers.** Replace duplicated SVG grids/axes/marks. Geometry frame width matches measured CSS width; use three ticks below 420px, five otherwise, with 12px labels. Keep height 290 for line/histogram and 320 for scatter. Use keyed scatter styles with circle/square symbols and matching legend symbols. Supply descriptions, axis labels, raw data tables and visible empty states. Navigation uses one chart focus stop plus the existing point selector; keyboard and pointer inspection produce the same selected key.
- [ ] **Step 4: Demonstrate extension points.** Add a labelled threshold overlay in the line example, a custom scatter tooltip receiving the original datum, and a replaceable brand theme/style mapping in maintained `chart.ts`/`view.ts`. Set both scatter paints through semantic series tokens. Demonstrate a second overlaid line through ordinary layer composition. Do not introduce special library branches or independent hidden data state.
- [ ] **Step 5: Keep shared source files exportable.** Use package `imports` aliases `#example/measurement` and `#example/frame` mapping to shared files. Source loaders append those files as `shared/measurement.ts` and `shared/frame.ts`; add those names and local `measurement.ts` to each SourceName union. Task 5 maps the same aliases to the standalone source paths. Keep the code shown in the source selector identical to the maintained files.
- [ ] **Step 6: Verify** promo state/geometry/editor tests and full checks. Browser verification waits until Task 5 makes new exports runnable; editor sessions must retain their revision and state on theme or width changes.
- [ ] **Step 7: Commit** as `feat(promo): compose responsive themed chart examples`.

## Task 5: Standalone packaging, documentation and qualification

**Files:** Modify `apps/promo/src/lib/example-project.ts`, `apps/promo/test/example-template.test.ts`, `packages/foldkit-viz/test/package-import-smoke.test.ts`, `packages/foldkit-viz/{README,CHANGELOG}.md`, `apps/promo/README.md`, and `apps/promo/src/pages/docs.astro`. Create `apps/promo/test/standalone-chart-project.test.ts`. Add scoped lint exceptions only for proven test I/O or lifecycle boundaries, with reasons, if existing overrides do not cover the new files.

**Interfaces consumed:** New subpath build outputs and Task 4 shared source files. **Interface produced:** Existing `buildExampleTemplate(sources, example)` still returns `Record<string,string>`; generated projects remain independently installable Vite applications.

- [ ] **Step 1: Pin packaging failures before implementation.** Materialise each generated template in its own temporary directory. Assert npm installation, `npm run typecheck`, and `npm run build` exit 0; execute a consumer that imports all three new public subpaths. Initially these fail on missing vendored modules/shared aliases. Clean temporary projects through existing test I/O conventions. Do not run packaging tests alongside package rebuilds.
- [ ] **Step 2: Vendor the complete build closure.** Include the new chart and adapter entries, declarations and emitted runtime/declaration dependencies, including generated shared chunks. Determine closure from tsdown output; do not guess a fixed chunk name. Preserve relative emitted paths. Add package exports and generated project `imports` mappings to `./src/shared/measurement.ts` and `./src/shared/frame.ts`. No workspace imports, published-version assumptions or symlinks to the checkout.
- [ ] **Step 3: Verify optionality independently.** Extend the packed consumer smoke test: execute the root/geometry/theme imports under Bun and Node without FoldKit installed. In a separate fixture with FoldKit/Effect installed, import and render through the optional adapter. Do not add a runtime FoldKit dependency to the pure entry points to make the test pass.
- [ ] **Step 4: Document the actual API.** Add examples for arbitrary data/accessors, light/dark themes, stable keyed styles, a replacement tooltip, ordered layers and an annotation. Document `foldChild`/typed out-message ownership, palette cycling, invalid input errors, zero-domain behaviour, source/export capture, and hex-only numerical interpolation plus the outstanding basis-parity gap. Mark capability as implemented only after qualification; do not bump a release version or claim publication.
- [ ] **Step 5: Run final verification sequentially.** `bun run check`, `bun typecheck`, `bun run test`, `bun run --filter @opsydyn/promo build`, standalone qualification and `git diff --check` must all exit 0. Read every output, including integration and packed import tests. Rebuilds can invalidate the running promo server, so restore `astro dev --host 127.0.0.1 --port 4321` in `apps/promo` after checks and verify HTTP 200.
- [ ] **Step 6: Perform browser acceptance.** Inspect line/histogram/scatter in both themes at 390px and desktop. Confirm at least 12px rendered chart labels and no page overflow, resize while inspecting, keyboard/pointer parity, filter/reset, brand colour, tooltip and overlay behaviour, raw data alternatives, ZIP export and source agreement. On line, edit code in Edit live, switch tabs, resize/change theme and verify the same session and preview survive; restart must capture current controls. Record observed limitations separately from automated checks.
- [ ] **Step 7: Obtain a fresh whole-branch code review** under the chosen execution skill. Review public API optionality, Model ownership, command/out-message preservation, observer lifecycle, standalone dependency closure and domain/paint boundaries. Fix material findings with a failing regression first and repeat affected verification. Commit as `docs(viz): document and qualify chart composition` after final checks pass.

## Plan self-review and handoff

Shared interfaces were checked: Task 3 consumes Task 1 projected records and Task 2 styles; Task 4 consumes those public signatures; Task 5 preserves Task 4 shared aliases and sources. Every spec acceptance item is owned by Tasks 1–5. Review-focus cases are assigned to geometry, theme, composition, Model/resize or standalone tests. No React adapter, new runtime or catalogue-wide migration is planned.

Recommended execution: inline in this attached worktree, with one fresh whole-branch review. The tasks share interfaces and this keeps their implementation in one context. Delegated task-by-task implementation remains available if selected by the user.

Status: inline implementation approved; task checkboxes track verified progress.
