# Trustworthy signal quality — M2 design

Date: 2026-10-05. Source baseline: `5ab821a`, managed promo worktree.
Status: written design for review; no implementation or release evidence.
Predecessor: [M1 design](2026-10-05-controlled-signal-exploration-design.md) and [qualification](2026-10-05-controlled-signal-exploration-qualification.md).

## Intent and success

A developer or analyst can distinguish a measured zero from missing/invalid data, identify an estimate and its supplied bounds, and recognise a stale source while exploring the same exact records across linked charts and table. Quality must remain legible when zoomed, resized, pinned, or rendered without colour.

The user approved specifying M2 after M1. Preserve pure TypeScript geometry, native Foldkit Model → Message → update flow, caller data/themes/policy, exact inspection and the crisp instrument aesthetic. The design assumes a static, explicitly illustrative telemetry fixture; it does not introduce live transport or infer statistical meaning.

## Approaches and decision

1. **Small pure segmentation/band contracts plus Signal desk composition — selected.** Reuses existing scales, line/area generators and annotations. Public helpers return structural geometry/record membership; the app supplies measurement quality, freshness and threshold meaning. Costs two focused public contracts and their packed-consumer checks.
2. **Demo-only quality recipe.** Smaller package change, but consumers would repeat gap and interval validation. Useful as a probe, insufficient as the reusable M2 deliverable.
3. **Telemetry runtime and alarm engine.** Would own clock, transport, inference and alert lifecycle. Those policies vary by application and exceed the approved chart scope.

## Scope

Extend `/examples/signals/` with independent per-metric quality, supplied intervals, fixed source freshness, caller threshold annotations, a visible legend and complete exact-value data alternative. Preserve all M1 controls and ownership. Add pure contiguous-run and interval-band helpers with optional Foldkit rendering composition; no required framework peers in pure exports.

M2 addresses P1, the interval-band portion of P2, and unit/domain visibility within P3/F5. It does not complete these roadmap goals. Error bars, pinned comparison baselines, general unit conversion, independently sampled series, crossing-aware difference areas, event lanes, replay, downsampling, data export and live alarms remain later work. Existing M1 native-touch acceptance remains open.

## Data and meaning

Application records retain unique stable ID and usable finite UTC time. Each record contains latency and error readings independently; missing latency does not remove a valid error reading.

```typescript
type Bounds = Readonly<{
  lower: number;
  upper: number;
  label: string;
  support: number | null;
}>;
type Reading =
  | Readonly<{ _tag: 'Observed'; value: number; bounds: Bounds | null }>
  | Readonly<{ _tag: 'Estimated'; value: number; bounds: Bounds | null; method: string }>
  | Readonly<{ _tag: 'Missing'; reason: string }>
  | Readonly<{ _tag: 'Invalid'; raw: string; reason: string }>;
type SourceSnapshot = Readonly<{
  revision: string;
  asOf: number;
  updatedAt: number;
  staleAfterMs: number;
}>;
```

Implement application unions with `defineTaggedUnion`, exhaustive `.match` and Schema validation. These domain schemas belong to the example, not the geometry package. An ingestion boundary can classify non-finite numeric input as Invalid with its exact diagnostic representation (`NaN`, `Infinity`, etc.); it never coerces it to zero. Malformed record identity/time or invalid declared bounds fails the input contract visibly rather than dropping records.

Valid readings are finite, latency non-negative and error percent in [0,100]. Bounds are finite and `lower <= value <= upper`, in the metric's valid range; equal bounds are legal. `label` is non-empty, support is null or a non-negative safe integer. A zero support remains visible; it does not imply certainty or manufacture validity. Estimated method and Missing/Invalid reasons are non-empty. Supplied bounds are labelled “caller-supplied interval”; use “confidence” only if the caller explicitly supplies that meaning in the label. No calculation of confidence, standard deviation or sample adequacy.

Snapshot times are usable finite UTC milliseconds with `updatedAt <= asOf`; staleAfterMs is finite and non-negative. Fresh when `asOf - updatedAt <= staleAfterMs`, stale otherwise. This is source freshness, independent of a reading's Observed/Estimated/Missing/Invalid status. The fixture uses fixed asOf values and explicit Fresh/Stale scenario buttons; there is no wall-clock read or timer in derivation. Snapshot metadata and freshness policy appear in source and readout.

## Pure contracts

Suggested public modules: `chart/segments.ts` and `chart/intervalBand.ts`. Names and signatures are fixed by the subsequent implementation plan before coding; semantic requirements here are binding.

**Contiguous runs:** accept readonly data, finite X accessor, drawable predicate and a caller `connect(previous, next)` predicate. Return readonly runs of original datum references in input order. An excluded datum flushes the current run. The caller predicate is invoked only for adjacent drawable input records, never across an excluded datum. False starts a new run. Empty input returns no runs; singleton runs remain available for point/interval marks. No implicit sorting, mutation, interpolation or default temporal gap policy. Validate all X values and require strictly increasing input X; reject non-finite or repeated/decreasing X with RangeError. The example sorts a copy by time and treats duplicate timestamps as a visible invalid fixture, while M1's existing duplicate-time capability remains unchanged for its original pure APIs.

The app's connection rule is: connect only if the time delta is at most its declared maxGapMs and quality tag is equal. maxGapMs is finite and positive. A change Observed ↔ Estimated breaks the edge without deleting either endpoint. Render isolated endpoints as marks; never join separate quality runs with an invented bridge.

**Interval bands:** accept one drawable ordered run, X/lower/upper accessors and the existing Cartesian layout. Validate finite values and `lower <= upper`; enforce strictly increasing X. Return projected lower/upper boundaries retaining stable record identity, plus a linear closed path for runs of at least two records. Singleton returns no area path but retains its interval endpoints for a capped vertical interval mark. Empty input returns empty boundaries/null path. Projection overflow fails with RangeError. Signed intervals are valid in the generic helper; metric limits are app policy.

Use the same X/Y scales as the centre line. Never pad, reorder, repair inverted bounds or calculate statistics. A band exists only on contiguous records with supplied valid bounds. Absence of bounds breaks the band independently of the centre line. Render each band run separately; never pass a disconnected topline to the current `area()` implementation with one reversed baseline, which would close across gaps. Equal bounds produce zero-area geometry with visible boundary stroke/label policy owned by the renderer.

Reference `d3-main/d3-shape/src/line.js` and `area.js` plus the current line/area generators. M2 uses linear segments on both boundaries; smooth curves that imply unmeasured extrema are excluded. Do not rewrite the existing area generator for unrelated curved-baseline parity.

## Composition and visual language

Keep the overview and latency/errors details aligned to one X viewport. Include all valid centre values and supplied bounds in stable full-data Y domains. Include caller reference thresholds in the domain for this recipe, so the annotation remains visible; a threshold-only/all-missing series still gets a usable zero-inclusive axis. With no valid values/bounds/threshold, use a declared fallback extent and display “No drawable measurements”; no synthetic observations are plotted.

Observed centre lines are solid. Estimated runs use dashed lines and hollow diamond endpoints. Missing/Invalid observations break paths and receive distinct labelled status marks in a separate narrow quality lane aligned to X, never at an invented Y value. Temporal gaps with no explicit record appear as labelled gap spans; do not invent rows or IDs for them. Bands use a restrained translucent fill and stroked boundaries. Source staleness uses a prominent text/status treatment alongside the chart and inspector; do not overload the estimated dash encoding. All styles resolve through caller theme/style inputs with useful light/dark defaults, without fixed business colours in geometry.

The legend explains measurement/estimate marks, Missing/Invalid lane marks, interval meaning and freshness. No status relies solely on colour or opacity. At 390px, wrap legend and domain/source metadata and keep complete UTC/unit context. Do not pack one decorative mark per raw record into an unreadable barcode; lane spans may merge adjacent equal statuses for presentation while exact records remain in the table.

Caller thresholds have stable ID, metric, finite value, non-empty label and caller style. They are reference lines, not generated alarm verdicts. Their text says “Illustrative reference: <label> · <value> <unit>”. Values at/outside metric limits are rejected according to the app's declared metric contract. Labels must remain within the chart frame or move into an adjacent keyed text list when they collide; line/list identity must agree. No crossing-area shading or clinical/operational recommendation.

## Controlled state and inspection

Retain M1 selection, viewport, Following/Pinned inspection, cancellation and scoped input. Nearest-X inspection chooses an actual record in the viewport even if either/both readings are non-drawable. The inspector shows exact observed/estimated value or Missing/Invalid reason/raw text, UTC, quality, supplied interval label/endpoints/support, source revision and Fresh/Stale status. Zero is printed as zero; absence is explicitly labelled. There is a cursor at the selected record time; only valid per-metric centre values receive a plotted point. Outside-view pin retains the record/readout and draws no fabricated point or clamped cursor.

Keyboard stepping includes every actual record, including Missing/Invalid. The complete table does likewise; chart, table and current-source state agree. Scenario changes are past-tense messages and are explicit in parent Model. The freshness scenario changes snapshot metadata only, preserving selection/view/pin. A fixture replacement cancels active gestures and resets bounds/viewport/selection/inspection atomically to avoid dangling IDs. No external state, refs, DOM mutation or untracked runtime clock. Commands are used only when needed for runtime effects.

## Exact illustrative fixtures

Start from the existing 120 one-second records with their existing IDs/times and numerical formula. Apply declared changes in a new quality fixture, preserving the untouched M1 fixture as a regression reference:

- Records 10–14: latency Missing (“collector unavailable”), errors remain observed.
- Record 22: errors Invalid, raw `NaN`, reason “collector emitted non-finite value”; latency remains observed.
- Records 30–39: both metrics Estimated with method “illustrative interpolation”; latency interval value ±8ms, errors interval max(0,value−0.1) to min(100,value+0.1), label “Illustrative supplied range”, support 3.
- Record 35 latency interval support 0; show it without a renderer adequacy verdict.
- Record 40: observed latency zero; error zero. It must differ visibly and textually from Missing.
- Remove records 70–74 entirely; maxGapMs 1500 produces a temporal gap between 69 and 75 with no manufactured records.
- References: latency 180ms (“Latency reference”), errors 2% (“Error reference”). These values belong to fixture props, not package defaults.
- Snapshot revision `signal-quality-v1`, updatedAt t0+119000, Fresh asOf t0+124000, Stale asOf t0+134001, staleAfterMs 10000. Both scenarios share the same measurement records.

Also qualify adversarial input: all Missing/Invalid, singleton observed/estimated, absent and equal bounds, inverted/non-finite bounds, support 0/null/negative, irregular/duplicate/decreasing times, extreme representable values, no thresholds and thresholds with conflicting label positions. Do not simulate malformed declared bounds by quietly suppressing a band.

## Files and compatibility

Add the two pure modules, export metadata/build entries, README documentation and packed Bun/Node/TypeScript tests without optional peers. Reuse optional Foldkit frame/line/point/annotation adapters; add a small band adapter only if it improves caller composition, with caller fill/stroke/options and no embedded quality policy.

Extend the existing signals data/model/derive/view/message/update, route copy/source list and scoped site CSS. Retain its Mount/input modules unless a demonstrated quality requirement needs a narrow change. Preserve other gallery examples and the site's curated counts. Update parity/roadmap only with implemented evidence after qualification, not with this document alone.

## Acceptance and evidence boundaries

1. Pure tests prove runs do not cross excluded records, quality transitions or declared gaps; original references/order are retained and rejected inputs are deterministic.
2. Band tests independently calculate projected endpoints, verify signed/equal/singleton/empty cases, reject bad bounds and ensure separated runs produce separated closed paths. Packed consumers verify real exports/types.
3. State/render tests prove Missing ≠ zero, independent metric quality, exact interval/support/source values, stale/estimate distinction and valid markers only. Pin/brush/pan/keyboard/resize contracts retain their M1 coverage.
4. Browser checks at 390/1280px light/dark: find Missing10, Invalid22, Estimated35 with support0, Zero40 and the 69–75 gap; inspect/brush/pin them and confirm table/source agreement. Threshold and interval labels remain readable; no overflowing or bridged gap geometry.
5. Run required root check/typecheck/workspace tests sequentially, then the ten-route Pages-base build/artifact check. One independent whole-change native review and test-first fixes; commit qualified slices. Preserve port4321 for review. No publish/push/release in this slice.
6. Native touch, representative-user comprehension and critical-system suitability remain separate gates. Engineering tests establish neither safe operational decisions nor statistical validity of caller intervals. Human learning task: distinguish missing from zero, explain a supplied interval, and identify source staleness; recruitment is not authorised by this spec.

## Next decision

Review this written spec, then create an implementation plan with exact helper signatures, adversarial tests and bounded native tasks. Implementation is not authorised by this document's existence. Recommended next: approve the spec and write the test-first M2 plan; retain native execution and one final independent review.
