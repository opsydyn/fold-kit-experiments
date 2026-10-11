# Trustworthy Signal Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for the user's preserved native execution method. Implement task-by-task; checkbox steps track progress. One independent whole-change reviewer follows native implementation.

**Goal:** Extend the controlled Signal desk with truthful quality, supplied interval bands, source freshness and caller reference thresholds.

**Architecture:** Pure contiguous-run and interval-band helpers carry geometry and original records only. The example owns per-metric quality, freshness policy, thresholds and all interaction state; its view composes existing Foldkit primitives with explicit non-colour encodings. Preserve M1 input/lifecycle and exact-record inspection.

**Tech Stack:** Bun workspace, TypeScript, Foldkit 0.166.0 named exports, Effect 4.0.0, Astro 7.1.1, oxlint/oxfmt. No D3 runtime dependency.

**Spec:** [approved M2 design](../specs/2026-10-05-trustworthy-signal-quality-design.md), approved after `a4197fd`; implementation baseline is the plan commit.

## Global Constraints

- Use the existing managed promo worktree, branch `codex/foldkit-0-166-0`; preserve the primary checkout and unrelated work.
- Run baseline `bun typecheck` then `bun run check` before product edits. Never run build/typecheck/test consumers concurrently: they clean shared dist.
- Pure exports require no DOM, Foldkit or Effect runtime; readonly data, original references, explicit validation and caller styles/policy.
- Reference `d3-main/d3-shape/src/line.js` and `area.js`; use linear boundaries, no inferred statistics or invented interpolation.
- Parent Foldkit Model owns quality snapshot, selection, viewport, inspection and gestures. Use Schema/tagged unions/exhaustive `.match`; side effects remain scoped Commands/Mount.
- Source freshness is independent of measurement quality. Fixed asOf values; no wall clock/timer in derivation.
- Exact values, interval labels/endpoints/support and provenance agree across inspector/table/source. Missing/Invalid never become zero.
- Extend `/examples/signals/`; preserve six homepage cards, eighteen gallery tiles and ten Pages routes. Light/dark and 390/1280 CSS pixel checks.
- Commit each qualified task. Keep review port4321. No push, publication, version bump or deployment.
- Native touch, comprehension and critical-system suitability remain separate acceptance gates; do not replace native evidence with host tests.
- M2 is partial P1/P2/P3/F5 progress. Error bars, comparison baselines, unit conversion, independent sampling, crossing areas, replay/downsampling/export/live alarms are excluded.

## Review Focus

1. A viewport boundary cuts a supplied band/gap: geometry must preserve the real segment boundary, without joining disjoint runs or losing a visible crossing segment. Task3 boundary tests and Task4 clipping QA.
2. An inspected record has Missing latency but valid errors, or both values are non-drawable: retain record/key/cursor, draw valid metric points only, show reasons. Tasks2–4.
3. Freshness changes during a pan or with an outside-view pin: metadata changes must not erase semantic state or introduce a timer; fixture replacement must cancel/reset atomically. Task2.
4. All data is Missing/Invalid or all values/intervals equal zero: valid axes and meaningful text, no fabricated observations; thresholds still visible. Tasks3–4.
5. Two thresholds share one Y location or carry long labels on narrow screens: every ID/value/unit remains readable without overlap or overflow. Task4 keyed adjacent list.

## File ownership and task interfaces

| Unit                  | Files                                                                                                                       | Responsibility                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Pure runs/bands       | `packages/foldkit-viz/src/chart/{segments,intervalBand}.ts`                                                                 | Strict input/run contracts and projected linear band geometry                          |
| Exports/consumers     | package index, package.json, tsdown.config.ts, README, test/package-import-smoke.test.ts and its existing consumer fixtures | Actual packed root/subpath runtime and strict type compatibility                       |
| Quality domain        | `apps/promo/src/examples/signals/quality.ts`                                                                                | Schemas, props validation, exact diagnostic classification, measurement access         |
| Fixture               | `signals/quality-data.ts`; keep `signals/data.ts`                                                                           | Declared115-record quality fixture and unchanged120-record M1 numerical reference      |
| Model/messages/update | existing `signals/{model,message,update}.ts`                                                                                | Parent-owned metadata/scenarios/replacement; retain M1 controls                        |
| Derivation            | existing `signals/derive.ts`                                                                                                | Runs, bands, stable domains, quality/gap lane and exact source                         |
| View                  | existing `signals/view.ts`, new `signals/quality-view.ts`                                                                   | Small quality/interval/lane/legend rendering helpers; existing frame/input composition |
| Promo/evidence        | route `signals.astro`, site.css, docs recipe, assessment/roadmap and new qualification doc                                  | Actual source list, contextual copy, scoped styles and evidence                        |

### Task 1: Public pure run and band helpers

**Create:** `packages/foldkit-viz/src/chart/segments.ts`, `src/chart/intervalBand.ts`, `test/segments.test.ts`, `test/interval-band.test.ts`.
**Modify:** `src/index.ts`, `package.json` (exports/typesVersions), `tsdown.config.ts`, README and existing packed consumer test/fixtures.

**Produces:**

```typescript
type SegmentAccessors<T> = Readonly<{
  x: (datum: T, index: number) => number;
  defined: (datum: T, index: number) => boolean;
  connect: (previous: T, next: T) => boolean;
}>;
function contiguousRuns<T>(
  data: ReadonlyArray<T>,
  accessors: SegmentAccessors<T>,
): ReadonlyArray<ReadonlyArray<T>>;
type IntervalBandAccessors<T> = Readonly<{
  x: (datum: T, index: number) => number;
  lower: (datum: T, index: number) => number;
  upper: (datum: T, index: number) => number;
  datumKey: (datum: T, index: number) => string;
}>;
type IntervalBandPoint<T> = Readonly<{
  datum: T;
  key: string;
  x: number;
  lowerY: number;
  upperY: number;
}>;
type IntervalBandGeometry<T> = Readonly<{
  points: ReadonlyArray<IntervalBandPoint<T>>;
  path: string | null;
}>;
function intervalBandGeometry<T>(
  data: ReadonlyArray<T>,
  accessors: IntervalBandAccessors<T>,
  layout: CartesianLayout,
): IntervalBandGeometry<T>;
```

- [x] Write failing named tests `excluded records and explicit connection breaks preserve references`, `all X inputs are strictly ordered even when excluded`, `band endpoints share caller scales and singleton has no area`, `invalid interval/key/projection fails visibly`. Assert empty runs, no connect call over an excluded point, singleton retention, equal/signed bounds, non-finite/repeated/decreasing X, duplicate/empty band keys and no caller mutation. With frame100×100, zero margins, X[0,10], Y[-10,10], datum{x:2,lower:-2,upper:4} must project x20/lowerY60/upperY30 with the original datum reference. Two such increasing points give one closed linear path; one gives null.

```typescript
const a = { x: 0 },
  missing = { x: 1 },
  b = { x: 2 };
const runs = contiguousRuns([a, missing, b], {
  x: (d) => d.x,
  defined: (d) => d !== missing,
  connect: () => true,
});
expect(runs).toEqual([[a], [b]]);
expect(runs[0]?.[0]).toBe(a);
```

- [x] Run `bun test packages/foldkit-viz/test/segments.test.ts packages/foldkit-viz/test/interval-band.test.ts`; observe real RED before implementation.
- [x] Implement both signatures. Validate input before evaluating connection policy, including excluded X values. Reject duplicate/empty keys and non-finite projected coordinates. Delegate finite linear path construction to existing area/line math for one run; minimum2 points for area. Do not add quality/time defaults or repair bounds.
- [x] Add root and exact `chart/segments`, `chart/intervalBand` subpath exports/build entries/README. Extend existing packed Bun/Node/strict TS consumers to import both functions/types, compute the independently expected coordinates, and verify no optional peers are installed in the pure fixture.
- [x] Run focused tests plus `bun test packages/foldkit-viz/test/package-import-smoke.test.ts`; then sequential root check/typecheck/workspace tests. Require zero failures and explicit packed-consumer success before commit.
- [x] Commit `feat(viz): add contiguous signal runs and interval bands` with tests/metadata/docs.

### Task 2: Validated quality records and controlled snapshot state

**Create:** `apps/promo/src/examples/signals/{quality,quality-data}.ts`, `apps/promo/test/signal-quality-state.test.ts`.
**Modify:** existing signals model/message/update; minimal record-shape adaptations in derive/view and route props; M1 state/input/view test fixtures where Props changes. Keep original `data.ts` and its numerical fixture unchanged.

**Consumes:** Task1 helpers; existing M1 viewport/inspection contracts.
**Produces:** exported Bounds/Reading/SignalRecord/SourceSnapshot schemas and types in quality.ts; SignalRecord `{id,time,latency:Reading,errors:Reading}`; `observedRecords(samples: ReadonlyArray<Sample>): ReadonlyArray<SignalRecord>`; `readingValue(reading: Reading): number | null`; `classifyReading(value: number | null, metric: 'latency' | 'errors'): Reading`; `sourceFreshness(snapshot: SourceSnapshot): 'Fresh' | 'Stale'`.

Props has `{data: ReadonlyArray<SignalRecord>, snapshot: SourceSnapshot, maxGapMs: number, thresholds: ReadonlyArray<SignalThreshold>, scenarioAsOf: {Fresh:number, Stale:number}}`. SignalThreshold is `{id,metric:'latency'|'errors',value,label,style:Partial<SeriesStyle>}`. Export `qualityProps`, `qualityData`, `freshSnapshot` and `staleSnapshot` from quality-data.ts. Parent Ready stores these validated props plus existing M1 state. `scenarioAsOf` values must produce their named freshness statuses using the snapshot updatedAt/staleAfterMs. New facts: `ClickedFreshnessScenario{scenario:'Fresh'|'Stale'}` and `ChangedSignalDataset{props:Schema.Unknown}` (typed Props override with handler-local validation). `init(props: Props): Return<Model,Message>` keeps Empty/Invalid/Ready.

- [x] Write failing `quality fixture carries exact independent readings` assertions:115 records; signal010 latency Missing/errors Observed; signal022 error Invalid/rawNaN; signal035 Estimated/latency support0; signal040 both observed0; no IDs070–074. Preserve original M1 120 samples and formulas. Test non-finite ingestion returns Invalid/raw exact String(value), null returns Missing, finite zero returns Observed.
- [x] Write failing `declared metadata cannot be silently repaired` tests: invalid/inverted/non-finite bounds, value outside interval, out-of-range metric, blank labels/reasons/method/revision, duplicate IDs/times, negative/non-safe support, malformed time and non-positive maxGapMs. Descending input sorts a copy; duplicate time invalid. Include empty input and singleton display padding as M1. Stale cutoff is strict: updatedAt+10000 Fresh, +10001 Stale. Reject updatedAt>asOf, non-finite/unrepresentable age and invalid scenarios. Validate optional SeriesStyle fields explicitly: stroke/fill/dashPattern strings, finite opacity[0,1], non-negative finite widths/radius and supported symbol literals; never pass Schema.Unknown style values directly into SVG.
- [x] Write failing `freshness preserves a gesture and pinned key; replacement resets atomically`: scenario switch retains exact viewport/selection/pin/active gesture while changing asOf only. Valid replacement ends the gesture and reinitialises bounds/view/None/Following-null; late old pointer facts cannot commit. Invalid replacement becomes visible Invalid. Missing/Invalid IDs participate in nearest/keyboard inspection.

```typescript
expect(qualityProps.data).toHaveLength(115);
expect(qualityProps.data.find((d) => d.id === 'signal-010')?.latency._tag).toBe('Missing');
expect(qualityProps.data.find((d) => d.id === 'signal-040')?.latency).toEqual({
  _tag: 'Observed',
  value: 0,
  bounds: null,
});
expect(sourceFreshness({ ...freshSnapshot, asOf: freshSnapshot.updatedAt + 10000 })).toBe('Fresh');
expect(sourceFreshness({ ...freshSnapshot, asOf: freshSnapshot.updatedAt + 10001 })).toBe('Stale');
```

- [x] Run `bun test apps/promo/test/signal-quality-state.test.ts` to observe RED.
- [x] Implement schemas with tagged unions/exhaustive match and visible validation. Fixture exact changes from spec: 10–14 Missing latency;22 Invalid errors;30–39 Estimated ±8ms and clipped ±0.1% bounds/support3/method“illustrative interpolation”;35 latency support0;40 both0;remove70–74;maxGap1500. References180ms/2%; revision signal-quality-v1; updatedAt=t0+119000, Fresh=t0+124000, Stale=t0+134001, staleAfter10000.
- [x] Keep this intermediate task independently type-clean: replace direct latencyMs/errorPercent access in derive/view with readingValue/exhaustive Reading formatting, use defined predicates for non-drawable values, and keep the current route on observedRecords(signalData) with explicit qualityProps metadata until Task4 switches to the quality fixture. Derive/view run/band/lane composition remains Tasks3–4. Preserve exports of Props through model.ts for current app/main imports.
- [x] Adapt existing M1 test setup with `observedRecords` and explicit fixture props; retain its original expected pan/tap/cancel/pin behaviour, including corrected overview42/post-pan40 regressions. Input stream stays six emitted facts; new control facts must not enter Mount schemas.
- [x] Run quality-state plus all four existing signal tests, then root check/typecheck/workspace tests sequentially. Commit `feat(promo): model signal quality and source freshness`.

### Task 3: Gap-aware chart derivation and exact inspection

**Modify:** `apps/promo/src/examples/signals/derive.ts`, `apps/promo/test/signal-geometry.test.ts`.
**Create:** `apps/promo/test/signal-quality-geometry.test.ts`.

**Consumes:** Task1 function signatures, Task2 readingValue/records/snapshot/thresholds, existing Cartesian geometry and M1 Model.
**Produces:** preserve `deriveSignalChart(model: ReadyModel, role: ChartRole)` and its `{frame,geometry,visible,inspected}` fields for input/update. Add `runs: ReadonlyArray<{quality:'Observed'|'Estimated',records:ReadonlyArray<SignalRecord>,path:string|null}>`, `bands:ReadonlyArray<IntervalBandGeometry<SignalRecord>>`, `qualitySpans:ReadonlyArray<{status:'Missing'|'Invalid',start:number,end:number,keys:ReadonlyArray<string>}>`, `gaps:ReadonlyArray<{start:number,end:number}>`, `thresholds:ReadonlyArray<SignalThreshold>`, `noDrawable:boolean`, `freshness:'Fresh'|'Stale'`. All metrics map roleoverview→latency. Keep `visibleRecords`, `nearestVisible`, `inspectionNotice`, `utc`, `currentSignalSource` signatures.

- [x] Write failing `quality transitions and absent timestamps never bridge`: full-data runs split at Missing/Invalid, Observed↔Estimated, delta>1500. Errors remain continuous across latency10–14. Band runs split independently when bounds absent. No row/ID generated for gap69–75.
- [x] Write failing `viewport cuts preserve crossing segments and stable bounds`: derive full ordered runs before projection; use the detail viewport scales and later plot clipping. Viewport inside30–39 preserves interval edge continuity; viewport inside69–75 shows no centre/band bridge. Selection/resize never changes full-data Y bounds. All valid values, bounds and reference values contribute; equal0/no-values fallback[0,1]; positive maximum has10% headroom, overflow invalid at validation boundary. Threshold-only all-missing latency180 gives[0,198].
- [x] Write failing `non-drawable records retain exact inspection without metric points`: Missing10, Invalid22 and all-missing records remain in visibleRecords/nearestVisible; geometry.points contains only valid readings. Exact source includes snapshot, freshness policy/maxGapMs/thresholds, intervals/support and actual state. Singleton interval points retained with null path. Reorder tests preserve stable IDs.

```typescript
const model = init(qualityProps).model;
if (model._tag !== 'Ready') throw new Error('Expected Ready fixture');
const chart = deriveSignalChart(model, 'latency');
expect(chart.gaps).toContainEqual({ start: 1700000069000, end: 1700000075000 });
expect(chart.geometry.points.some((p) => p.key === 'signal-010')).toBe(false);
expect(chart.geometry.points.some((p) => p.key === 'signal-040')).toBe(true);
```

- [x] Run `bun test apps/promo/test/signal-quality-geometry.test.ts apps/promo/test/signal-geometry.test.ts` to observe RED.
- [x] Implement using contiguousRuns for centre and separate supplied-bound runs; connect requires same quality and delta<=maxGapMs. Project full runs with shared layout; do not filter away boundary neighbours then invent closure. Existing lineGeometry/scatterGeometry supplies axes/valid points; explicit invalid readings may use NaN only as a non-drawable accessor sentinel, never a rendered value. Keep raw records unchanged. Merge lane spans only for adjacent equal statuses within maxGapMs; retain keys/reasons through inspector/table. Source includes serialisable exact data/policy, without implying a download/export capability.
- [x] Run geometry/state/input regressions and sequential root checks. Commit `feat(promo): derive truthful signal gaps and supplied intervals`.

### Task 4: Composed quality view and native qualification

**Create:** `apps/promo/src/examples/signals/quality-view.ts`, `apps/promo/test/signal-quality-view.test.ts`, `docs/superpowers/specs/2026-10-05-trustworthy-signal-quality-qualification.md`.
**Modify:** signals view, app/main type wiring if required, route `apps/promo/src/pages/examples/signals.astro`, `apps/promo/src/styles/site.css`, docs recipe, roadmap/assessment and existing signal-view/Pages tests. Include quality.ts/quality-data.ts/quality-view.ts in actual source disclosures.

**Consumes:** Task3 complete chart derivation and Task2 explicit props/facts.
**Produces:** `qualityLayers(model:ReadyModel, role:ChartRole, chart:ReturnType<typeof deriveSignalChart>, h:HtmlBuilder<Message>): ReadonlyArray<Html>`; `qualityLegend(h:HtmlBuilder<Message>): Html`. Existing `view` Document signature remains. No public Foldkit band adapter in this slice: view helpers compose existing HtmlBuilder; pure package exports carry reusable geometry.

- [x] Write failing render tests for exact Missing/Invalid/Estimated/zero values/reasons, supplied label/endpoints/support0/null, Fresh/Stale source revision/asOf/updatedAt/cutoff, all115 raw rows, valid per-metric points only, visible Missing cursor, no outside-view pinned cursor. Legend and status lane have text/shape distinctions. All-zero/all-invalid cases show declared domains/no drawable text without invented points.
- [x] Write failing `threshold identity survives shared locations and long labels`: always place complete keyed threshold text in an adjacent HTML list, avoiding SVG text collision entirely; lines carry matching IDs/accessible labels. Text exact “Illustrative reference: <label> · <value> <unit>”. Reject out-of-range values at Task2 boundary; endpoints0/100% are allowed (metric limits inclusive). Narrow text wraps.
      Use the existing signal-view `render(model)` helper with real Foldkit server rendering:

```typescript
const markup = await render(init(qualityProps).model);
expect(markup.match(/data-record-id=/g)).toHaveLength(115);
expect(markup).toContain('collector unavailable');
expect(markup).toContain('Illustrative reference: Latency reference · 180 ms');
expect(markup).toContain('caller-supplied interval');
```

- [x] Run `bun test apps/promo/test/signal-quality-view.test.ts apps/promo/test/signal-view.test.ts` to observe RED.
- [x] Implement layers: separately closed translucent bands/stroked boundaries; equal/singleton interval as capped vertical marks; solid observed and dashed estimated with hollow diamond endpoints; labelled Missing/Invalid lane below data plot, distinct from measured Y coordinates; labelled gaps. Use frame heights174/294 (overview/details) and bottom margin70, preserving the M1 data-plot heights80/200; reserve a16px quality lane starting42px below plot.bottom, clear of time ticks. Apply a unique per-role SVG plot clip path to data runs/bands/cursor/highlight; axes/lane/text stay outside it. Keep actual Mount on SVG and its gesture surface scoped to data plot. Estimated endpoints and singleton values must remain visible when uninspected; avoid per-record decorative barcodes. Resolve semantic CSS style/theme variables, caller threshold style overrides and no business colours in pure geometry.
- [x] Switch the route from the preserved120-record observed baseline to qualityProps. Extend inspector/table with metric-specific quality/method/reason/raw/bounds/support and source metadata. Add native Fresh/Stale buttons emitting configured scenario facts; no timers. Preserve pin/ranges/zoom/reset keyboard and exact UTC. Adapt displayed record count115; retain the original 120-record regression fixture tests.
- [x] Run all Signal tests then root `bun run check`, `bun typecheck`, `bun run test` sequentially. Build `PROMO_BASE_PATH=/fold-kit-experiments/ bun run --filter @opsydyn/promo build` then `PROMO_BASE_PATH=/fold-kit-experiments/ bun test apps/promo/test/pages-build.test.ts`; require10 routes and all base-aware links/islands valid.
- [ ] Restart port4321 after builds. Through CUA native browser inputs inspect IDs010/022/035/040, interval20–60 and gap69–75; check table/source/cursor/bounds/support equality. Repeat390/1280 light/dark; pan/zoom across boundary cuts, pin outside, keyboard through Missing, Fresh/Stale during held pan, Escape/lost capture and resize retention. Check lane does not steal plot capture/page scroll. Reset temporary viewport/fixtures; capture contextual screenshot. If touch unsupported, report precisely unperformed.
- [x] Document counts, named commands, native observations/limits and partial P1/P2/P3/F5 evidence. Keep comprehension and publication unperformed. Root checks must pass before commit `feat(promo): expose trustworthy signal quality and uncertainty`.
- [x] Run one fresh independent whole-change reviewer for native execution, focused on the five cases above and numeric/packed contracts. Regrade by user effect; reproduce/fix material findings RED→GREEN in one pass, rerun whole qualification and affected native paths, commit fixes/evidence. No second reviewer; explicitly record every declined-to-judge boundary and deferred minor.

## Self-review and handoff

Task2 includes the minimal derive/view/route record-shape bridge so its commit typechecks before richer derivation/rendering. Task1 defines exactly the two public signatures consumed in Task3; Task2 owns metric constraints separately from generic signed band geometry. Task3 preserves geometry.layout needed by M1 input and uses all records for nearest/key stepping, while Task4 clips full runs without joining them. Freshness remains an independent source dimension; caller styles/thresholds and raw values stay explicit. No untouched fixture or source/Pages acceptance is silently removed.

Spec clarifications fixed for execution: the example uses inclusive metric limits (latency>=0, errors[0,100]); threshold labels always use a complete adjacent keyed list rather than automatic collision measurement. Props include explicit Fresh/Stale asOf scenarios so the view has no hardcoded business clock. These resolve ambiguous wording without adding package policy.

Next: user reviews this plan. Native execution is already selected and retained; do not ask for it again. After qualification, recommend a bounded review of remaining P2/P3 gaps (error bars and pinned baseline) before broadening to expressive M3 work. Commit completion, preserve worktree/server, no release action.

Native checklist ruling: supported Firefox mouse/keyboard/range/resize/theme paths were assessed and captured; held-pointer/capture/multi-touch gates remain unchecked because the IAB/CDP surface is unavailable. See qualification record; host state tests do not close native gates. Native lane start is26px (not42px) after a demonstrated UTC-title collision, with a real-render separation regression.
