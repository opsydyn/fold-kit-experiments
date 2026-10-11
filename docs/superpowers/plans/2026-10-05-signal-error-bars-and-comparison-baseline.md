# Signal Error Bars and Comparison Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compose reusable error bars with a captured comparison baseline that remains independent of Signal desk inspection.

**Architecture:** Viz returns validated readonly straight-segment coordinates. Native Foldkit owns a separate captured Baseline union, exact per-metric comparison and provenance. Existing bands, full-data domains, inspection, gestures and dataset validation remain intact.

**Tech Stack:** Bun workspace, TypeScript, Foldkit0.166.0, Effect4.0.0, Astro, SVG, oxlint/oxfmt; no added dependency.

**Spec:** [Approved design](../specs/2026-10-05-signal-error-bars-and-comparison-baseline-design.md). Implementation baseline: `e0d8573`, branch `codex/foldkit-0-166-0`, existing managed promo worktree. Native execution is already selected; retain it after plan review.

## Global Constraints

- Pure TypeScript geometry; composable SVG; caller-owned data, colours and themes; no D3 runtime dependency.
- Native Foldkit Model → view → Message → update. Messages are facts; own union `.match`; no external state, timers, DOM refs or new runtime effects.
- Bounds are supplied metadata, not confidence levels inferred by the renderer. No statistics, interval subtraction, relative change or unit conversion.
- `axis: 'x' | 'y'`; `capSize` is full length in SVG user units, explicit and finite/non-negative. Example capSize8.
- `Baseline.None | Captured { record: SignalRecord, snapshot: SourceSnapshot }` is independent of unchanged `Inspection.Following | Pinned`.
- Latency delta in ms; errors delta in percentage points. Preserve unrounded caller values and distinguish support0 from unspecified.
- Captured freshness is labelled at capture. Dataset replacement always resets baseline, including a same-revision replacement.
- Preserve existing bands/Y domains, quality lane,115 actual fixture records,10 Pages routes, gallery and homepage scope. Check390/1280 light/dark.
- Reuse the managed worktree; preserve unrelated work. Before product edits run baseline typecheck then check. Never run builds/typechecks/consumer tests concurrently: they clean shared dist.
- Commit each qualified task. Keep review port4321. No push, publication, version bump or deployment.
- Native held-pointer, hardware touch, assistive technology and comprehension remain separately open until directly observed; host regressions cannot close them.

## Review Focus

1. Finite projected coordinates plus cap offset overflow, including tiny-domain scales: reject non-finite endpoints, retain finite unrounded geometry. Task1.
2. Equal bounds and baseline/current sharing a record: draw coincident caps once and avoid duplicate bars while retaining baseline meaning and estimated cues. Tasks3–4.
3. Caller mutates nested bounds after capture, or replacement reuses revision/ID: captured evidence remains isolated; replacement clears it rather than rebinding. Task2.
4. Capture/clear occurs during a provisional pan or brush, followed by late pointer facts: rollback first, preserve committed viewport/selection, and ignore the late commit. Task2; native Task4.
5. No inspected record or non-numeric readings on one/both sides: explicit unavailability, complete diagnostics and valid baseline references; no nearest usable substitute or zero. Tasks3–4.

## File responsibilities

| Unit            | Files                                                                 | Responsibility                                                                |
| --------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Pure marks      | `packages/foldkit-viz/src/chart/errorBars.ts`                         | Project independent intervals to finite stems/caps, no rendering/state.       |
| Package surface | Viz index/package.json/tsdown.config.ts/README and packed smoke tests | Root/subpath exports and peer-free consumer contract.                         |
| Capture         | `apps/promo/src/examples/signals/baseline.ts`, model/message/update   | Baseline schema, nested copying, reset/cancel policy.                         |
| Comparison      | signals `comparison.ts`, derive.ts                                    | Exact arithmetic, availability, selected mark geometry and source disclosure. |
| Composition     | signals `comparison-view.ts`, view.ts, route, site.css                | Accessible controls/panel, reference/mark styling,13 source disclosures.      |
| Evidence        | New tests and qualification document, roadmap/assessment/readmes      | Regression contracts, observed native limits and partial parity status.       |

### Task 1: Pure error-bar geometry and consumer surface

**Create:** `packages/foldkit-viz/src/chart/errorBars.ts`, `packages/foldkit-viz/test/error-bars.test.ts`.
**Modify:** `packages/foldkit-viz/src/index.ts`, `packages/foldkit-viz/package.json`, `packages/foldkit-viz/tsdown.config.ts`, `packages/foldkit-viz/README.md`, `packages/foldkit-viz/test/package-import-smoke.test.ts`.

**Interfaces:** Consume existing `CartesianLayout` and `finiteCoordinate` from chart/layout. Export `ErrorBarAccessors<T>` with numeric position/lower/upper and string datumKey accessors `(datum:T,index:number)`. Export `ErrorBarSegment` as readonly `{start:readonly[number,number],end:readonly[number,number]}` and `ErrorBarMark<T>` as readonly `{datum:T,key:string,stem:ErrorBarSegment,lowerCap:ErrorBarSegment,upperCap:ErrorBarSegment}`. Export `errorBarGeometry<T>(data:ReadonlyArray<T>, accessors:ErrorBarAccessors<T>, layout:CartesianLayout, options:Readonly<{axis:'x'|'y',capSize:number}>):ReadonlyArray<ErrorBarMark<T>>`.

- [x] Read vendored `d3-main/d3-shape/src/line.js`, `curve/linear.js`, `path.js` and existing intervalBand/layout exemplars. There is no dedicated error-bar generator there; use existing scale projection and independent straight segments, without inventing statistical math.
- [x] Write failing tests with100×100 zero-margin layout, X[0,10],Y[-10,10], datum `{id:'a',position:2,lower:-2,upper:4}`. AxisY/cap8 must yield stem[20,60]→[20,30], lowerCap[16,60]→[24,60], upperCap[16,30]→[24,30]; datum reference identical. AxisX on X[-10,10],Y[0,10] yields stem[40,80]→[70,80], caps atY76→84. Assert exact endpoints, not implementation-generated expectations.
      Example assertion in `projects Y interval through shared scales` (use the layout/accessors/datum specified above):

```typescript
const marks = errorBarGeometry([datum], accessors, layout, { axis: 'y', capSize: 8 });
expect(marks[0]?.stem).toEqual({ start: [20, 60], end: [20, 30] });
expect(marks[0]?.lowerCap).toEqual({ start: [16, 60], end: [24, 60] });
expect(marks[0]?.upperCap).toEqual({ start: [16, 30], end: [24, 30] });
expect(marks[0]?.datum).toBe(datum);
```

- [x] Add rejection/edge tests: signed/equal/reversed domains, cap0, empty/singleton, repeated positions/distinct keys, retained caller order/reference, duplicate/empty keys, inverted/non-finite position/bounds, bad runtime axis and capSize even with empty data, accessor error propagation. Finite custom projection near Number.MAX_VALUE plus finite cap offset must throw if an endpoint overflows. Tiny1e-306 domain must project finitely through existing layout. Freeze input to catch mutation.
- [x] Run `bun test packages/foldkit-viz/test/error-bars.test.ts`; require observed RED before implementation.
- [x] Implement exact interfaces with whole-call validation and finite coordinate checks after cap offsets. Return numeric coordinates; no serializer, clipping, sorting or default style. For equal bounds retain geometry; deduplication is a rendering decision.
- [x] Add root/type exports and exact `chart/errorBars` exports/typesVersions/build entry. Extend existing packed Bun/Node/strict-TypeScript fixture to import function/types through root and subpath, compare independently expected endpoints and prove optional Foldkit/Effect peers absent. Document caller-supplied interval semantics and both axes.
- [x] Run focused geometry tests and `bun test packages/foldkit-viz/test/package-import-smoke.test.ts`; then sequential root check/typecheck/test. Require zero failures before commit `feat(viz): add pure error-bar segment geometry`.

### Task 2: Independent captured baseline state

**Create:** `apps/promo/src/examples/signals/baseline.ts`, `apps/promo/test/signal-baseline-state.test.ts`.
**Modify:** signals model.ts/message.ts/update.ts; existing tests only where manually constructed Ready fixtures need the new field; oxlint.config.ts only if baseline.ts needs the existing named pure-schema/helper exception.

**Interfaces:** baseline.ts exports the Foldkit `Baseline` schema/value/type with None/Captured described in Global Constraints, plus `captureBaseline(record:SignalRecord,snapshot:SourceSnapshot):Extract<Baseline,{_tag:'Captured'}>`. Ready Model adds `baseline:Baseline`; init uses None. Message adds `ClickedCaptureBaseline{}` and `ClickedClearBaseline{}`. Existing update signature is unchanged. No schema or record import cycle: baseline.ts consumes quality.ts; model.ts consumes baseline.ts.

- [x] Write failing tests using local `ready()` from `init(qualityProps)` with an explicit Ready assertion. Capture signal035: snapshot equal to current snapshot, latency value100/bounds92–108/support0 preserved. Assert captured record, each valued reading/bounds and snapshot are different object references. Mutate a local cloned props fixture after capture; captured values/metadata must remain unchanged. Capture with null inspection leaves model unchanged; Missing010/Invalid022 still allow record capture.
      Example assertion in `captures nested evidence without pinning inspection`:

```typescript
const model = { ...ready(), inspection: { _tag: 'Following' as const, key: 'signal-035' } };
const captured = update(model, Message.ClickedCaptureBaseline()).model;
if (captured._tag !== 'Ready' || captured.baseline._tag !== 'Captured')
  throw new Error('Expected captured baseline');
expect(captured.inspection).toEqual(model.inspection);
expect(captured.baseline.record.id).toBe('signal-035');
expect(captured.baseline.record).not.toBe(model.records.find((d) => d.id === 'signal-035'));
expect(captured.baseline.snapshot).not.toBe(model.snapshot);
```

- [x] Test independent inspection and all retention/reset transitions: keyboard Home/Right, pin/resume, ranges, zoom, pan, resize, reset view and clear selection retain baseline. Fresh→Stale changes current snapshot only, captured asOf stays1700000124000. Capture again replaces explicitly; clear produces None without changing inspection/committed view/selection. `ChangedSignalDataset` with same revision and reused IDs resets to None; invalid/empty replacements keep existing visible model semantics.
- [x] Test capture/clear during both active gesture tags: use existing Started/Moved pointer facts, assert rollback to exact startViewport/startSelection, gestureIdle, and late Ended/Cancelled facts cannot commit obsolete work. Capture resolves the actual inspected key; it never picks a nearest usable record.
- [x] Run `bun test apps/promo/test/signal-baseline-state.test.ts`; require RED for absent baseline/capture facts.
- [x] Implement union/copy helper, init field and exhaustive update branches. Reuse existing cancel(m) before baseline updates; preserve inspection and committed state. Ensure new facts remain outside the Mount pointer message schema. Do not create a Command or change caller quality validation.
- [x] Run baseline state plus existing signal-state/quality-state/input tests, then sequential root checks. Commit `feat(promo): capture independent signal comparison baselines`.

### Task 3: Exact comparison and selected error-bar derivation

**Create:** `apps/promo/src/examples/signals/comparison.ts`, `apps/promo/test/signal-comparison.test.ts`.
**Modify:** signals derive.ts, `apps/promo/test/signal-quality-geometry.test.ts`, oxlint.config.ts only to extend the existing named pure-helper scope to comparison if required.

**Interfaces:** Export `Metric = 'latency'|'errors'`. Export `MetricComparison` as readonly tagged union: Available `{metric, current:Reading, baseline:Reading, delta:number, unit:'ms'|'percentage points'}`; Unavailable `{metric,current:Reading|null,baseline:Reading|null,reason:'NoBaseline'|'NoCurrent'|'NonNumeric'}`. Export `compareReading(metric:Metric,current:Reading|null,baseline:Reading|null):MetricComparison`; no formatting/statistical inference here.

Export `deriveSignalComparison(model:ReadyModel)` returning `{current:SignalRecord|null,baseline:Baseline,baselineOutsideView:boolean,latency:MetricComparison,errors:MetricComparison}`. Export `deriveComparisonChart(model:ReadyModel,role:ChartRole,layout:CartesianLayout)` returning `{errorBars:ReadonlyArray<{purpose:'inspection'|'baseline'|'both',mark:ErrorBarMark<SignalRecord>}>,baselineReference:{record:SignalRecord,reading:Reading,value:number}|null}`. Use type-only Model imports to avoid a runtime cycle. Roleoverview maps to latency; view limits horizontal references to detail plots.

- [x] Write failing exact comparisons: same record delta0; Observed80ms→Estimated100ms delta20 with both statuses retained; errors0.2→0.5 delta equal to raw `0.5 - 0.2`, unit percentage points. No good/bad judgement. Both sides preserve method/bounds/support0/null. Missing/Invalid on either side returns NonNumeric with original diagnostic readings; null baseline takes NoBaseline precedence, otherwise null current gives NoCurrent.
      Example assertion in `error delta is percentage points from exact input`:

```typescript
const current = Reading.Observed({ value: 0.5, bounds: null });
const baseline = Reading.Observed({ value: 0.2, bounds: null });
expect(compareReading('errors', current, baseline)).toEqual({
  _tag: 'Available',
  metric: 'errors',
  current,
  baseline,
  delta: 0.5 - 0.2,
  unit: 'percentage points',
});
```

- [x] Test captured/current provenance independently after Fresh/Stale; baselineOutsideView against the detail viewport; no current inspection after following moves out of view. Existing pinned current remains inspectable off-screen. Captured record is not looked up/rebound by ID.
- [x] Test selected marks using capSize8, axisY: only current and baseline with supplied bounds; same ID deduped to purposeboth. Equal bounds retained, absent bounds omitted. Off-viewport coordinates remain their actual projections for later clipping; no edge clamp. Baseline reference requires a numeric captured metric even when current is Missing/Invalid. No baseline means no baseline reference. Capture must not change deriveSignalChart bands, domains, runs, points, quality spans or gaps.
- [x] Run `bun test apps/promo/test/signal-comparison.test.ts apps/promo/test/signal-quality-geometry.test.ts`; require RED.
- [x] Implement the exact interfaces using readingValue/readingBounds and Task1 projection. Select at most two actual records per metric; no synthetic records or dense cap sampling. Extend currentSignalSource with serialised baseline and captured freshness at capture, leaving current snapshot/freshness independent. Explicitly retain source values rather than rounding fixture arithmetic.
- [x] Run comparison, geometry and state/input tests, then sequential root checks. Commit `feat(promo): derive exact signal comparisons and selected intervals`.

### Task 4: Accessible instrument composition and qualification

**Create:** `apps/promo/src/examples/signals/comparison-view.ts`, `apps/promo/test/signal-comparison-view.test.ts`, `docs/superpowers/specs/2026-10-05-signal-comparison-qualification.md`.
**Modify:** signals view.ts, route `apps/promo/src/pages/examples/signals.astro`, site.css, apps/promo/README.md, docs/roadmap.md, parity assessment and existing Pages/view tests. Add comparison-view to the existing named pure-render lint scope when required; no blanket lint exception.

**Interfaces:** `comparisonPanel(model:ReadyModel,h:HtmlBuilder<Message>):Html` and `comparisonLayers(model:ReadyModel,role:ChartRole,layout:CartesianLayout,h:HtmlBuilder<Message>):ReadonlyArray<Html>` consume Task3 derivations. `baselineReferenceList(model:ReadyModel,role:ChartRole,h:HtmlBuilder<Message>):ReadonlyArray<Html>` supplies an adjacent complete HTML item for each numeric detail baseline. Existing view Document and qualityLayers signatures remain unchanged. Place layers inside each existing role's plot clip; do not nest a new input surface.

- [x] Write real Foldkit server-render tests, following signal-quality-view.test.ts: Capture baseline disabled with no inspection; enabled otherwise; Clear baseline disabled for None. Captured panel includes both record IDs/UTC times, exact values/bounds/method/support, current source metadata and captured source metadata labelled at capture. Snapshot toggle changes current text only. Unavailable states expose diagnostics and No current inspection; errors unit is percentage points, never relative %. Assert authoritative table still has115 records.
      Use a local `render(model:Model):Promise<string>` helper matching the existing real server renderer. In `no inspection disables capture without inventing a comparison`, isolate the Capture baseline button from the returned markup and assert disabled; also assert:

```typescript
const markup = await render(ready());
expect(markup).toContain('Capture baseline');
expect(markup.match(/data-record-id=/g)).toHaveLength(115);
expect(markup).not.toContain('class="signal-comparison-error-bar"');
```

The renderer uses `signal-comparison-error-bar` on each keyed selected bar group; tests count those groups rather than decorative line elements.

- [x] Test composition: same-record one error-bar group per metric; equal endpoints one coincident cap; distinct Estimated/Observed cues; baseline-specific dash/label; no bars for Missing/Invalid/absent bounds. Full baseline reference label in adjacent HTML list, distinct from thresholds; off-screen point/bar clipped to actual coordinates, horizontal reference retained with Outside current view. Long labels/shared Y values remain outside SVG text. Existing bands/quality lanes and time-title separation remain intact.
- [x] Run `bun test apps/promo/test/signal-comparison-view.test.ts`; require RED before composition.
- [x] Implement accessible HTML panel and buttons using the two facts; capture control reads Capture baseline when None and Replace baseline when Captured. Explain that Resume inspection follows another record independently. Use one restrained polite comparison live region and exact delta/value text; prepend + for positive delta, show zero as0, preserve negative sign. No success/danger colour policy. Stack summaries at narrow widths using existing styles.
- [x] Compose numeric line attributes with capSize8; deduplicate coincident caps. Use theme series colours with documented baseline dash3 3, estimated cues retained and aria labels identifying record/purpose/quality. Add detail baseline references/adjacent list; overview time marker only within full extent. Reuse clip paths; retain noDrawable explanation even if a baseline reference exists. Keep sidebar/control interactions outside plot capture.
- [x] Add baseline.ts/comparison.ts/comparison-view.ts to actual route source disclosures (13 files), update intro/recipe copy for compare workflow, preserve10 routes and base-aware paths. No new gallery/homepage cards or interval mode control.
- [x] Run all Signal tests; sequential `bun run check`, `bun typecheck`, `bun run test`. Build `PROMO_BASE_PATH=/fold-kit-experiments/ bun run --filter @opsydyn/promo build`, then `PROMO_BASE_PATH=/fold-kit-experiments/ bun test apps/promo/test/pages-build.test.ts`; require10 routes and valid base-prefixed hydration/source/links. Record actual counts, not anticipated totals.
- [ ] Restart review server from apps/promo using installed Astro background CLI at127.0.0.1:4321 after builds. With CUA native inputs capture035, resume inspection, inspect040: baseline100ms/current0ms/delta-100ms; bounds92–108/support0 remain captured. Compare to010 Missing latency and022 Invalid errors; inspect115-row table/source. Capture a second record then clear. Select20–60 then pan beyond35; reference/text survive while bar is clipped. Resize390/1280, both themes and keyboard controls; restore user's browser preferences. Capture contextual screenshot.
- [ ] Exercise capture/clear during held pan/brush, native Escape/lost capture, touch operability/outside-plot scrolling and screen-reader announcements only where the actual native surface supports them. Recheck locked-Mac/IAB capabilities before asserting availability. If blocked, record exact unperformed gates in qualification; retain prior M2 gates without converting host tests to native evidence. Do not mark native checklist complete until directly observed.
- [x] Record qualification, source/spec links and partial P2/P3 status in docs; sequential root gates must pass before commit `feat(promo): compose signal error bars and baseline comparison`.
- [x] Native execution ends with one fresh independent whole-change reviewer under executing-plans, assessing package numerics, capture isolation, cancellation, source/units and rendering. Reproduce/fix material findings RED→GREEN in one pass; rerun affected/full gates and observed native paths, commit fixes. Record declined boundaries/deferred minors; do not run a second reviewer or claim release/native completeness from review alone.

## Self-review and handoff

Spec coverage: Task1 covers public generic geometry and package consumers; Task2 covers every baseline transition/isolation/reset; Task3 covers exact arithmetic, provenance, selected marks and unchanged domains; Task4 covers all controls, rendering, sources, themes, native checks and documentation. Review Focus items are explicitly assigned tests. Optional bounds never become generated intervals; the current table remains the current dataset, while captured evidence stays in comparison/source.

Task interfaces use the same names and types throughout. Named lint scope additions apply only to pure synchronous schema/derivation/render files, not update/effect handling. This plan does not add fixture rounding, unit conversion, multiple baselines or dataset continuity. Existing desktop responsive observations do not establish hardware touch or screen-reader acceptance.

Implementation executed locally. Automated gates and partial native observations are recorded in the qualification document. The two native checklists remain open for their unobserved paths; the server restart itself is complete. One fresh review is complete; recommend bounded native qualification without starting new feature scope. Commit completion; preserve worktree and dev server; no release action.
