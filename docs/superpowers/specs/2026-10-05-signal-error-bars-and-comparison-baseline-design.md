# Signal error bars and comparison baseline — approved design

Date: 2026-10-05. Source baseline: `3dec58a`, branch `codex/foldkit-0-166-0`, managed promo worktree. Status: written design approved by the user on 2026-10-05; implementation completed locally with [qualification evidence](2026-10-05-signal-comparison-qualification.md). Native acceptance remains partial; one independent review identified a composition defect, reproduced and fixed with regressions.

## Intent and success

Extend the Signal desk so a developer can inspect a supplied interval at a particular record, capture that record as a comparison baseline, then inspect another record without losing the baseline's exact values, quality or provenance. The result should support precision through clear units, restrained marks and exact disclosures, while retaining the existing sharp light/dark instrument aesthetic.

Carry forward the user's constraints: native Foldkit Model → view → Message → update; pure TypeScript geometry; composable SVG; caller-owned data, colours and themes; no D3 runtime dependency. Bounds are supplied metadata, not confidence levels inferred by the renderer. This slice advances the remaining error-bar portion of P2 and comparison portion of P3; it does not establish critical-system suitability.

## Approaches and decision

1. **Recommended: pure segment geometry plus application-owned captured baseline.** A reusable geometry helper projects bounds; the Signal desk owns capture, identity, comparison and disclosures. This fits the current package boundaries and lets inspection continue independently. Cost: the app must implement an explicit comparison policy.
2. **Extend the existing pinned inspection key into a baseline.** Smaller initial change, but the pinned cursor would need conflicting meanings: keeping one record fixed while following another. Reject this coupling; retain the existing cursor contract.
3. **Generic comparison engine and configurable statistical layer.** Could support several datasets and units, but introduces conversion, revision and inference policy without a second consumer. Defer until a concrete application establishes that requirement.

## Pure error-bar contract

Add `packages/foldkit-viz/src/chart/errorBars.ts`, root exports, exact `chart/errorBars` package export/typesVersions entry and tsdown entry, following `chart/intervalBand` conventions. Proposed signature:

```typescript
errorBarGeometry<T>(
  data: ReadonlyArray<T>,
  accessors: ErrorBarAccessors<T>,
  layout: CartesianLayout,
  options: Readonly<{ axis: 'x' | 'y'; capSize: number }>,
): ReadonlyArray<ErrorBarMark<T>>
```

`ErrorBarAccessors<T>` provides `position`, `lower`, `upper` and `datumKey`, each `(datum, index) => value` (string for key). `position` is the orthogonal domain coordinate: X for a Y interval, Y for an X interval. `capSize` is the full cap length in SVG user units, explicit and finite/non-negative. It is not a data-domain interval or a statistical parameter.

Each mark retains the original `datum` reference and `key`, plus `stem`, `lowerCap` and `upperCap`. Each segment has `start` and `end` as readonly `[x, y]` coordinates. For axis Y, project `position` through layout.x and endpoints through layout.y; caps extend by capSize/2 along X. Axis X exchanges those roles. Numeric lower/upper identity is retained even when projection reverses screen order. No path serialization, sorting, clipping, theme resolution or event handling belongs in this helper.

Reject the entire call with RangeError for non-finite position/bounds, lower > upper, empty/duplicate keys, an axis other than x/y, invalid capSize or any non-finite projected/offset endpoint. Preserve input order; repeated positions with distinct keys are valid because marks are independent. Empty data returns an empty array. Equal bounds and capSize zero are valid: retain degenerate geometry, allowing a renderer to draw coincident caps once. Signed bounds and reversed/equal layout domains use the existing layout contract. Accessor exceptions propagate; input is never repaired or discarded.

Reference vendored `d3-main/d3-shape/src/line.js`, `curve/linear.js` and `path.js` for independent straight-segment behaviour. There is no dedicated error-bar generator in that vendored shape module. Compose projected endpoints using the existing CartesianLayout and finiteCoordinate; do not invent a new scale or statistics algorithm. Returning coordinates also avoids the existing rounded path serializer's overflow boundary.

## Baseline model and state transitions

Keep `Inspection.Following | Pinned` unchanged. Add a separate Foldkit tagged union to Ready Model:

- `Baseline.None`.
- `Baseline.Captured { record: SignalRecord, snapshot: SourceSnapshot }`.

Capture copies the record, reading/bounds records and snapshot into Model-owned values; subsequent mutation of caller props must not alter that captured evidence. The model already validates the dataset at entry; capture only an actual record resolved by the current inspection key. A Missing/Invalid reading does not block capture of the record: each metric's comparison availability is explicit.

Messages are facts: `ClickedCaptureBaseline` and `ClickedClearBaseline`. Capture is disabled with no inspected record; replacement is an explicit click on the same labelled control. Both actions cancel an active gesture through the existing rollback policy, then change only baseline state. They preserve inspection, committed viewport and committed selection; any provisional pan/brush is rolled back first. Capture does not automatically pin or resume inspection; the existing Resume inspection button remains available.

Pan, zoom, range selection, resize, reset view, clear selection and inspection pin/resume retain the baseline. Fresh/Stale controls retain its captured snapshot. Dataset replacement, including a same-revision replacement, resets it through init alongside the existing inspection/gesture state. Never rebind a baseline silently by record ID after replacement. Empty/Invalid models have no capture control. No timer, DOM ref, external store or Command is required for this state.

## Comparison meaning

Compare the current inspected record with the captured baseline, independently for latency and errors. When both readings are Observed or Estimated, show current minus baseline using unrounded values: latency delta in ms, errors delta in percentage points. A 0.2% baseline and 0.5% current reading produce a +0.3 percentage-point mathematical difference, subject to ordinary IEEE representation; never label it +0.3% relative change.

Retain each side's Observed/Estimated status and method, supplied bounds label/endpoints and support (including zero and unspecified). If either side is Missing/Invalid, show Comparison unavailable with both reasons/diagnostics; do not substitute zero or search for a nearby usable sample. No current record shows No current inspection. Comparing a record with itself yields an exact zero delta. Do not colour a positive/negative delta as good/bad: the caller has not supplied an operational judgement policy.

Show both exact UTC timestamps, record IDs and baseline/current revision, asOf, updatedAt and freshness cutoff. Baseline freshness is labelled **at capture**, computed from its captured snapshot; current freshness follows the current snapshot. This distinction prevents a later Stale toggle from rewriting the baseline's provenance. No cross-revision comparisons or unit conversions are introduced. Existing latency ms and errors % contracts remain fixed. Do not calculate relative change, interval subtraction, overlap significance or uncertainty propagation.

## Rendering and composition

Retain existing interval bands and full-data Y domains, which already include all validated records, bounds and references. Add capped error bars only for the inspected record and captured baseline where supplied bounds exist; deduplicate when they are the same record. Do not cover every dense sample with caps. The reusable primitive remains capable of sparse multi-record compositions outside this app.

Marks use caller/theme series colours and explicit dash/shape cues. Caps have a documented example size (8 SVG units), independent of domain span; render with SVG line attributes rather than rounded path strings. Estimated readings retain their existing hollow/dashed cues. Baseline marks use a separate documented dash pattern and accessible label; colour alone never identifies them. Keep the existing quality lane outside measured Y space.

Draw a baseline value reference across each detail plot only when that metric has a numeric captured reading. Label it in the adjacent reference list as Comparison baseline with record/time/value/unit/quality; distinguish it from the supplied threshold. Clip all data marks to the existing plot. A baseline time outside the viewport retains its horizontal value reference and textual Outside current view status; do not clamp its point/error bar onto the plot edge or expand the viewport. The overview can show its time marker only within the full time extent.

Expose an HTML comparison panel beside the inspector with accessible labelled controls, keyboard operation and a restrained polite live region. Raw table remains the authoritative current dataset; captured values/provenance appear in the comparison panel and current-state disclosure. Include new application source files in actual source disclosure. At narrow widths stack the two record summaries and delta; no horizontal page overflow or SVG text collisions. Preserve light/dark readability and reduced-motion behaviour without adding animation.

## Verification and delivery gates

Pure tests cover both axes, signed/equal/reversed domains, independent repeated positions, original record identity/order, zero caps, singleton/empty input, duplicate keys, inverted/non-finite bounds and projection/cap-offset overflow. Include tiny domains accepted by M2. Packed Bun/Node/strict-TypeScript consumers exercise root and exact subpath without optional framework peers.

State tests cover no-record capture, replacement/clear, nested-copy isolation, inspection moving independently, pinned inspection, every viewport/selection action, source scenario changes, dataset replacement and cancellation during a gesture. Derivation/render tests cover Observed/Estimated combinations, support0/null, Missing/Invalid on either side, exact zero, percentage-point units, separate captured/current freshness and clipped off-viewport baseline marks. Prove bands and Y domains are unchanged by capture.

Native acceptance must exercise capture → resume → keyboard inspect another record → compare exact values; baseline outside viewport; replacement/clear; 390/1280 light/dark; touch and keyboard operability. Screen-reader announcements require direct assistive-technology evidence, not only live-region markup. Retain all outstanding M2 held-pointer/touch/assistive-technology gates as separately open until observed.

Before committing implementation: root check, typecheck and sequential workspace tests; package consumers; Pages-base production build and route tests. Record counts and independent review findings contemporaneously. Do not publish or claim full parity from those checks.

## Scope and review boundary

Deliver one pure geometry API and one native Signal desk composition. Defer interval-display modes, dense cap sampling, arbitrary unit adapters, multiple baselines, persisted baselines, comparison across dataset replacement, statistical inference, live transport and alarms. The fixture-only decimal-authoring improvement from M2 is a separate bounded change, not permission to round caller values.

Self-review: package and app ownership are separate; all state transitions and unavailability cases are explicit; there are no inferred confidence claims, placeholders or hidden dataset continuity assumptions. The written spec is approved. The approved implementation plan has been executed natively. See the qualification document for observed checks and open native acceptance gates.
