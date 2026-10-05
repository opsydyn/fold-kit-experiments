# Controlled signal exploration — M1 design

Date: 2026-10-05. Source baseline: `32b9836`, managed promo worktree.
Direction approved: [parity and chart excellence](../../assessments/2026-10-05-visx-parity-and-chart-excellence.md), M1 controlled exploration. Execution preference retained: native implementation, one independent final review. This document specifies the first slice; it is not implementation or release evidence.

## Intended result

A developer can select a time interval, zoom into it and inspect the same observation across two independent signal charts and a table. Selection, viewport and inspection remain parent-owned and serialisable. Actual SVG coordinates, cancellation and keyboard alternatives make the example dependable under resize and touch input.

The native promo route `/examples/signals/` demonstrates the composition with explicitly illustrative, static system telemetry. Copy: “Find the moment. Follow the signal.” Use crisp rules, direct labels and the existing saturated/light-dark visual system. Avoid pretending the fixture is a live monitoring system.

## Bounded scope

- Export pure client-to-chart coordinate conversion, bounded domain navigation and nearest-X inspection helpers.
- Reuse the current interval Selection contract, Cartesian geometry, line/point adapters, axes, grid and themes.
- Mount-scoped input and measurement effects in the example; no browser event runtime in pure modules.
- One latency overview and two aligned detail charts: latency in milliseconds, errors as percent. Separate Y axes and explicit units; common time viewport/cursor.
- Mouse/touch interval brush on overview; single-pointer pan on detail; explicit zoom buttons and keyboard navigation.
- A complete raw-record table, current controlled-state source and actual Model/Message/update/view source.
- Document and externally typecheck/import each new subpath. No version bump, deployment or broad chart migration.

Not included: rectangle brush, draggable resize handles, two-finger pinch, wheel zoom, async telemetry loads, event lanes, incident replay, uncertainty, downsampling, HTML portals or a general multi-series registry. These remain explicit parity gaps. Preserve ordinary page scrolling outside interactive plot regions; zoom buttons avoid trapping wheel scrolling in this slice.

## Public pure contracts

Suggested modules are fixed for this slice. Types are readonly and contain no DOM, Foldkit or Effect types.

### `interaction/coordinates.ts`

```typescript
type ChartPoint = Readonly<{ x: number; y: number }>;
type AffineMatrix = Readonly<{ a: number; b: number; c: number; d: number; e: number; f: number }>;
function clientToLocal(point: ChartPoint, localToClient: AffineMatrix): ChartPoint | null;
```

The matrix describes SVG-local → client space, matching the six numeric fields of `getScreenCTM()`. Invert it as a general affine transform, including skew and rotation. Non-finite arguments are rejected with RangeError; singular or non-finite/unrepresentable inversion returns null. Do not approximate with a bounding rectangle or assume the SVG viewBox equals its CSS size. Browser acquisition of this matrix belongs to the scoped runtime, not this function.

Reference existing `math/zoom.ts` matrix conventions before adding conversion; avoid conflicting skew ordering. Tests use independently calculated affine round trips, not only the inverse implementation itself.

### `interaction/viewport.ts`

```typescript
type ContinuousDomain = readonly [number, number];
function constrainDomain(
  domain: ContinuousDomain,
  bounds: ContinuousDomain,
  minSpan: number,
): ContinuousDomain;
function zoomDomain(
  domain: ContinuousDomain,
  factor: number,
  anchor: number,
  bounds: ContinuousDomain,
  minSpan: number,
): ContinuousDomain;
function panDomain(
  domain: ContinuousDomain,
  delta: number,
  bounds: ContinuousDomain,
  minSpan: number,
): ContinuousDomain;
```

Domains/bounds must be finite, strictly increasing with representable positive spans. `minSpan` must be finite, positive and no greater than the bounds span. The zoom factor is finite and positive; 0.5 halves span and 2 doubles it. Anchor is a finite domain value clamped to the current domain; preserve its fractional position before boundary constraint. Pan delta is a finite value in domain units. Translate to fit at boundaries, preserving requested span when it fits; oversize domains become full bounds. Expand undersize domains about their centre then constrain. Reject non-finite computed endpoints instead of publishing invalid geometry.

Reference vendored `d3-main/d3-scale/src/linear.js` and the existing invertible linear scales. The zoom package is not vendored: consult upstream [d3-zoom transform rescaling](https://github.com/d3/d3-zoom/blob/main/src/transform.js) alongside `math/zoom.ts`. Keep these helpers independent of pixel sizes. Pixel deltas are converted through the current recorded chart frame, with the gesture's starting domain retained explicitly.

### `interaction/inspection.ts`

```typescript
type XInspectionAccessors<T> = Readonly<{
  key: (datum: T, index: number) => string;
  x: (datum: T, index: number) => number;
}>;
function nearestByX<T>(
  data: ReadonlyArray<T>,
  accessors: XInspectionAccessors<T>,
  x: number,
): T | null;
```

Empty input returns null. Finite X coordinates and unique non-empty keys are required. Reject invalid inputs and a non-finite query. Ties resolve by lexicographically smaller key, independently of array ordering; retain the original datum reference and do not mutate caller data. Linear search is adequate for this slice; no binary-search sorted-data contract is implied. Comparisons must remain meaningful for large finite coordinates without distance subtraction overflowing.

All three modules gain root exports, `exports`/`typesVersions` subpaths, build entrypoints, README snippets and independent packed Bun/Node plus TypeScript consumer coverage. Optional peers must remain absent in the pure consumer.

## Signal desk model and data

A caller-supplied record is `{ id: string, time: number, latencyMs: number, errorPercent: number }`. The fixture has 120 distinct observations at one-second intervals with deterministic excursions. Every chart and table uses these same records. Display time in UTC, latency in ms and errors in percent. IDs, source data and units do not come from package math.

The app validates unique non-empty IDs, finite values and usable time extent at initialization. Negative latency and percent outside 0–100 are invalid for this example's declared fixture contract; the generic geometry helpers retain caller-controlled signed domains. Empty, one-record and invalid-data props produce a visible fallback/table rather than fabricated zero data. A one-record extent gets explicit ±500ms display padding. Multi-record extents shorter than 1,000ms receive symmetric display padding to that minimum span, retaining exact record timestamps; initial two-minute fixture bounds follow the actual first/last sample.

Parent Model fields:

- Immutable validated records and full time bounds.
- `viewport: ContinuousDomain`, initially full bounds.
- `selection: Selection`, initially None; use Interval on X only.
- `inspection`: discriminated Following with optional active key, or Pinned with a stable key. Pinning is inspection policy for static data, not a live-data freeze promise.
- `gesture`: Idle, Brushing or Panning. Active variants retain pointer ID, source chart, anchor domain value, starting viewport and starting selection. No `isDragging` boolean or DOM element/ref in Model.
- Measured width for overview/detail charts and input readiness/status.

Chart roles are `overview`, `latency` and `errors`. Pure derivation creates per-role geometry; detail charts share time viewport and keep independent Y domains derived from the complete fixture, so horizontal zoom does not silently exaggerate Y changes. Selection/viewport changes are separate, visible state.

## Input runtime boundary

The example input module uses Mount.defineStream on each actual SVG. Add a typed optional `onMount` argument to the existing chartFrame adapter so this acquisition does not require duplicating its SVG renderer. Its scope owns listeners and ResizeObserver; acquisition/release must remove every listener and disconnect the observer on unmount. It reads a fresh screen matrix for each input and sends only plain local coordinates, numeric width and past-tense Messages. No SVG element, DOMMatrix or PointerEvent enters the application Model.

Use scoped pointer capture for an active pointer through runtime Effects; lost capture/pointer cancellation emits a cancellation fact. If native capture cannot be expressed cleanly through the current Mount API, a scoped window listener is acceptable, with active pointer identity entirely in the Model and matching cleanup tests. Do not introduce an external interaction state store. Suppress native plot-touch scrolling only for the owned gesture surface with declared touch-action; scrolling elsewhere remains available.

Read missing/singular matrices as input-unavailable and expose a concise status. Keyboard controls still operate from domain values. Events from another pointer or an inactive chart do not change a gesture. A second touch cancels the current single-pointer gesture; pinch support is not claimed.

Messages describe facts: RecordedChartWidth, RecordedPointerPosition, StartedChartPointer, MovedChartPointer, EndedChartPointer, CancelledChartPointer, ChangedRangeStart, ChangedRangeEnd, ClickedZoomIn, ClickedZoomOut, ClickedResetView, ClickedClearSelection, ClickedPinInspection, ClickedResumeInspection and PressedInspectionKey. Prefer existing Clicked/Recorded naming where the final schema needs a clearer fact; no imperative Messages.

## Interaction semantics

| Action                    | Explicit behaviour                                                                                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview drag             | Show a preview interval; on release of a drag at least 4 local SVG units wide, commit an X Interval and fit viewport to it, constrained to a minimum 1,000ms span    |
| Overview tap / short drag | Inspect nearest record; preserve existing selection and viewport                                                                                                     |
| Detail drag               | Pan from the gesture's starting viewport; clamp to full bounds; selection remains unchanged                                                                          |
| Cancellation / Escape     | Restore the starting viewport/selection and return to Idle; never publish the transient drag as a committed selection                                                |
| Resize during gesture     | Cancel and restore committed domain state; later inputs use the new frame/matrix                                                                                     |
| Zoom buttons              | Scale viewport by 0.5 or 2 around the inspected sample when visible, otherwise viewport midpoint; keep selection                                                     |
| Reset view                | Restore full bounds and cancel gesture; keep selection and pinned inspection                                                                                         |
| Clear selection           | Set None and cancel gesture; keep viewport and inspection                                                                                                            |
| Range start/end           | Native labelled range inputs select fixture sample indices; constrain crossing ends to a non-empty interval; update selection and fit viewport                       |
| Pointer inspection        | Following mode chooses nearest record within visible viewport; both charts and table show that record; pointer exit does not erase a pinned key                      |
| Pin / resume              | Pin current inspected key; disable pin when none exists; resume allows pointer/keyboard following                                                                    |
| Keyboard                  | Focused detail plot Left/Right steps visible records, Home/End chooses first/last, Escape cancels gesture; zoom/reset/clear/pin and range inputs are native controls |

Keyboard inspection can explicitly move a pinned key; unrelated pointer motion cannot. Stable IDs survive a fixture reorder. No inspection chooses a record outside the viewport; a pinned record outside the new viewport remains in the inspector/table with an “outside current view” notice rather than being silently replaced. Resize does not alter committed domain selection or pinned key.

Chart surfaces use accessible names/descriptions. The inspector is the authoritative exact-value readout; SVG cursor/point emphasis matches it. Table rows highlight the inspected ID and interval membership with text/structure as well as colour. Source reflects actual viewport, selection and inspection, not merely defaults. All data remains available even when outside the viewport.

## Composition and files

Pure package files: `src/interaction/{coordinates,viewport,inspection}.ts`, matching tests, public metadata, README and consumer fixture.

Example files: `apps/promo/src/examples/signals/{data,model,message,update,derive,input,view,main,app}.ts`. Keep pure view derivation separate from scoped browser input. Model/update own semantic state; rendering is composed from existing package adapters. Do not introduce arbitrary child models solely to increase file count; if separate reusable children are necessary, use foldChild/foldChildInits and typed out messages.

Route: `apps/promo/src/pages/examples/signals.astro`, examples callout link, docs recipe link, scoped site CSS and source component. Existing six homepage cards and eighteen gallery tiles remain curated; do not add fake parity progress merely by linking this route. Map F1–F3 acceptance evidence and remaining interaction limits in the assessment after implementation.

## Acceptance and qualification

1. Coordinate fixtures cover CSS scaling, translation, skew, rotation, nested SVG and singular/unavailable transforms. Pure round trips agree within a documented scale-aware tolerance; browser inputs hit the intended actual mark at 390 and 1280 CSS pixels.
2. Domain tests cover bounds, min/max spans, negative and epoch domains, anchors at edges, large values, invalid spans and overflow. Zoom then inverse zoom restores the original interior domain within declared tolerance; pan to bounds preserves span.
3. Inspection tests cover empty input, duplicate IDs, repeated X, tie order, reorder invariance, non-finite inputs and extreme coordinates; original references are retained.
4. Model tests prove brush/tap distinction, commit/cancel rollback, foreign pointer rejection, second touch cancellation, resize cancellation, selection/viewport independence, pin persistence, outside-view notices and keyboard stepping.
5. Native mouse/touch/keyboard checks exercise real coordinate acquisition, capture/lost capture, page scrolling outside the plot, cancellation and light/dark/narrow layouts. Focus and exact record/table agreement are observed separately from rendered ARIA markup.
6. Mount lifecycle tests verify listener/observer teardown and no post-unmount Messages. A hidden-to-visible SVG recovers readiness without stored DOM refs.
7. Packed consumers import/typecheck the three subpaths without optional peers. No DOM/Foldkit/Effect runtime imports occur in pure entrypoints.
8. Run `bun run check`, `bun typecheck`, `bun run test` sequentially where package builds share dist; build promo with Pages base path and run its artifact test. Preserve other examples. One independent final native-mode review, followed by regression fixes and fresh verification.
9. Update parity status with actual evidence; commit the slice, leave port 4321 available, recommend M2 quality/uncertainty as the next bounded spec. Do not push, publish or claim critical-system qualification from these tests.

## Review and next step

The design is scoped to reusable domain interactions and one reference composition. It intentionally does not close every F1–F3 gap: rectangle handles, shared-X interpolation across independently sampled series, general HTML overlays and advanced gestures remain future work. The fixed synchronous fixture prevents async/replay uncertainty from obscuring interaction correctness.

Next step: review this written design, then produce a test-first implementation plan with exact fixtures and task interfaces. Execution remains native. Each completed slice is committed and followed by a concrete recommendation.
