# Controlled Signal Exploration — M1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for the user's selected native execution method. Implement tasks in order; checkbox steps track progress. One independent whole-change reviewer follows native implementation.

**Goal:** Ship reusable pure interaction helpers and a native Signal desk demonstrating controlled brush, pan, zoom and linked exact-record inspection.

**Architecture:** Pure modules convert numeric coordinates, constrain domain navigation and choose an observation. A parent Foldkit Model owns selection, viewport, inspection and gestures; scoped Mount Effects acquire browser input and measurement. Existing Cartesian adapters render the overview, two unit-labelled detail charts and a full raw table.

**Tech Stack:** Bun workspace, TypeScript 6, Foldkit 0.166.0, Effect 4.0.0, Astro 7.1.1, oxlint/oxfmt. No new product dependency.

**Spec:** `docs/superpowers/specs/2026-10-05-controlled-signal-exploration-design.md` (approved). Source baseline: `bf72da4`, managed promo worktree. Preserve native execution and commit each qualified deliverable.

## Global Constraints

- Pure geometry has no DOM, Foldkit or Effect imports; new optional peers remain absent from the pure consumer.
- Data, IDs, domains, units and paint remain caller-owned; no application fixture constants enter package algorithms.
- Model → view → Message → update → Model; side effects only at Commands/Mount/Subscription runtime boundaries. No element/ref/event object in Model.
- Messages are past-tense facts, defined with defineMessageUnion; tagged Model unions use their own exhaustive `.match`.
- Use render-scoped HtmlBuilder; reuse existing Cartesian geometry/adapters and named Foldkit imports.
- Reference vendored D3 scale source and upstream d3-zoom transform source named in the spec; document numeric limitations rather than claim blanket parity.
- Fixture: 120 one-second observations; minimum viewport span 1,000ms; overview drag threshold 4 local SVG units.
- UTC time, latency in ms, errors in percent, independent stable Y domains and one shared X viewport.
- Preserve six homepage cards, eighteen gallery tiles and existing live examples.
- Exclude rectangle/resize handles, pinch/wheel zoom, async loads, replay, uncertainty, downsampling and HTML portals.
- No release bump, push, publication or critical-system suitability claim. Leave dev review on port 4321.

## Review Focus

1. A finite affine matrix whose determinant/inversion overflows: return null when inversion is unrepresentable; invalid input arguments still throw. Task 1 pins this.
2. Adjacent representable epoch endpoints: reject a navigation result that loses increasing order, even when every number is finite. Task 1 pins this.
3. A pinned observation leaves the viewport and keyboard then moves inspection: retain the notice/key until an explicit keyboard choice selects a visible record, still Pinned. Task 2 pins this.
4. A second touch and lost capture arrive after an ended/cancelled gesture: no stale event commits a selection or changes the next gesture. Tasks 2–3 pin this.
5. Font/viewport changes and hidden SVG re-entry: dimensions/readiness recover, active gestures cancel, and committed domain state/focus do not silently reset. Tasks 3–4 pin this.

## File boundaries

| Area                | Files                                                                                                             | Responsibility                                                             |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Pure API            | `packages/foldkit-viz/src/interaction/{coordinates,viewport,inspection}.ts`                                       | Numeric, immutable framework-independent contracts                         |
| API tests/packaging | `packages/foldkit-viz/test/{coordinates,viewport,inspection}.test.ts`, existing package-import smoke and metadata | Regression/reference fixtures and external public contract                 |
| Example domain      | `apps/promo/src/examples/signals/{data,model,message,derive,update}.ts`                                           | Fixture, schema/unions, geometry derivation and pure transitions           |
| Browser input       | `apps/promo/src/examples/signals/input.ts`                                                                        | Scoped DOM acquisition, capture/listeners/observer cleanup and plain facts |
| Native view         | `apps/promo/src/examples/signals/{view,main,app}.ts`, route and scoped CSS                                        | Composed native chart, controls, readout, table and source                 |
| Qualification       | Promo tests, qualification document and parity-map update                                                         | Verified boundaries; publication separate                                  |

### Task 1: Pure public interaction helpers

**Files:** Create three pure modules above and their package tests. Modify `packages/foldkit-viz/{package.json,tsdown.config.ts,README.md}`, `src/index.ts` and `test/package-import-smoke.test.ts`.

**Interfaces:** Produce exactly the spec's exported `ChartPoint`, `AffineMatrix`, `clientToLocal`, `ContinuousDomain`, `constrainDomain`, `zoomDomain`, `panDomain`, `XInspectionAccessors<T>` and `nearestByX<T>` signatures. No DOM types. Root exports and `/interaction/{coordinates,viewport,inspection}` subpaths must agree.

- [x] Write failing coordinate tests, with these fixed reference assertions:

```typescript
expect(clientToLocal({ x: 30, y: 60 }, { a: 2, b: 0, c: 0, d: 3, e: 10, f: 30 })).toEqual({
  x: 10,
  y: 10,
});
expect(clientToLocal({ x: 7, y: 24 }, { a: 0, b: 2, c: -3, d: 0, e: 10, f: 20 })).toEqual({
  x: 2,
  y: 1,
});
const skewed = clientToLocal({ x: 10, y: 17 }, { a: 2, b: 1, c: 1, d: 3, e: 4, f: 7 });
expect(skewed?.x).toBeCloseTo(1.6, 10);
expect(skewed?.y).toBeCloseTo(2.8, 10);
expect(clientToLocal({ x: 1, y: 1 }, { a: 1, b: 2, c: 2, d: 4, e: 0, f: 0 })).toBeNull();
```

Also assert NaN/Infinity arguments throw RangeError; a matrix with `a=d=1e308`, `b=c=0` returns null for unrepresentable inversion. Seeded non-singular round trips use tolerance `1e-10 * max(1, abs(expected))`, and a separately computed nested matrix fixture follows the same convention. Do not multiply an incorrect inverse back through itself as the only oracle.

- [x] Write failing viewport tests with these assertions and input-validation cases:

```typescript
expect(constrainDomain([-2, 3], [0, 10], 1)).toEqual([0, 5]);
expect(constrainDomain([8, 13], [0, 10], 1)).toEqual([5, 10]);
expect(constrainDomain([4, 5], [0, 10], 4)).toEqual([2.5, 6.5]);
expect(constrainDomain([-5, 20], [0, 10], 1)).toEqual([0, 10]);
expect(zoomDomain([2, 8], 0.5, 4, [0, 10], 1)).toEqual([3, 6]);
expect(panDomain([2, 5], 9, [0, 10], 1)).toEqual([7, 10]);
```

Epoch fixture `[1_700_000_000_000, 1_700_000_010_000]` survives interior zoom then inverse zoom within `1e-3`ms; ordinary-domain tolerance is `1e-10 * max(1, abs(endpoint))`. Reject reversed/equal/non-finite or overflowing spans, invalid factor/minSpan/delta and computed non-increasing endpoints. Pin representability loss with `[1e16, 1e16 + 4]`, factor `Number.MIN_VALUE`, anchor `1e16 + 2`, bounds same, minSpan `1`: reject with RangeError rather than return equal endpoints.

- [x] Write failing inspection tests using `{id,x}` accessors. For `[{id:'b',x:0},{id:'a',x:2}]` queried at 1, expect the original `a` object regardless of input order. Repeated X chooses smallest key. Empty input returns null; empty/duplicate keys and non-finite query/data throw RangeError. With `[{id:'a',x:1.2e308},{id:'b',x:1e308}]` queried at `-1e308`, choose the original `b`, avoiding overflow-induced false ties. Caller arrays/records remain unchanged.

- [x] Run `bun test packages/foldkit-viz/test/coordinates.test.ts packages/foldkit-viz/test/viewport.test.ts packages/foldkit-viz/test/inspection.test.ts`; record missing-module/API RED before implementation.
- [x] Implement the three modules with the spec policies. Use the source references and existing scale/matrix conventions; final increasing-order validation follows every constrained result.
- [x] Add manifest/build/root exports and README examples that use only the new public signatures. Extend the existing external pure TypeScript/Bun/Node scripts to call all five functions; assert expected values and absence of Foldkit/Effect in the pure consumer.
- [x] Run focused tests to GREEN, then root `bun run check`, `bun typecheck`, `bun run test` sequentially. Resolve warnings as well as errors.
- [x] Commit the qualified helper/API deliverable: `feat(viz): add controlled coordinate viewport and inspection helpers`.

### Task 2: Controlled Signal desk domain and transitions

**Files:** Create `apps/promo/src/examples/signals/{data,model,message,derive,update}.ts`, `apps/promo/test/signal-state.test.ts` and `apps/promo/test/signal-geometry.test.ts`.

**Interfaces:** Consume Task 1 APIs and existing Selection, lineGeometry and theme contracts. Produce:

- `Sample` schema/type `{id,time,latencyMs,errorPercent}`, `Props` schema/type `{data: ReadonlyArray<Sample>}` and `signalData` fixture.
- `ChartRole` literals overview/latency/errors; `Inspection` Following `{key: string|null}` or Pinned `{key:string}`; `Gesture` Idle, Brushing or Panning with `{pointerId,role,anchorX,anchorTime,startViewport,startSelection,currentTime}` on active variants.
- `Model` tagged Empty `{records:[]}`, Invalid `{error:string}`, Ready `{records,bounds,viewport,selection,inspection,gesture,widths,inputStatus}`. Widths are per-role numbers initially 700; inputStatus is per-role Ready/Unavailable, initially Unavailable. Use discriminated unions, not parallel booleans.
- `init(props: Props): Return<Model, Message>` and `update(model: Model,message: Message): Return<Model,Message>`; no statically empty commands property.
- `deriveSignalChart(model: ReadyModel, role: ChartRole)` returns existing LineGeometry for latency or error values, frame, visible records and inspected record/null. `currentSignalSource(model:ReadyModel):string` serialises current controlled state into a readable public-API example; `inspectionNotice(model:ReadyModel):string` includes outside-view status.

Message payloads are fixed: width `{role,width}`; availability `{role,status:'Ready'|'Unavailable'}`; pointer `{role,pointerId,x,y}` for Started/Moved/Ended/Recorded position; cancellation `{role,pointerId}`; range start/end `{index:number}`; PressedInspectionKey `{role,key:'ArrowLeft'|'ArrowRight'|'Home'|'End'|'Escape'}`; all Clicked actions have no fields. Names follow the spec; add `RecordedInputAvailability` for runtime readiness. Use Message's exhaustive `.match`.

- [x] Write state RED tests using five records at `t0 + i*1000`, `t0=1_700_000_000_000`, IDs `sample-0..4`, latency `80+i*10`, errors `i`. Geometry converts specified domain positions to input coordinates; assertions compare resulting domain values within `1e-3`ms.
- [x] Assert initial Ready/full bounds/None/Following-null/Idle. Duplicate/empty IDs, negative latency, error percent outside 0–100 and non-finite data yield Invalid; empty data yields Empty; singleton time has ±500ms bounds and a visible record/table projection. A multi-record extent shorter than 1,000ms gets explicit symmetric display padding to 1,000ms, retaining exact timestamps and records; assert this with two records 200ms apart.
- [x] Assert overview brush from record 1 to 3 commits Interval `[t0+1000,t0+3000]` and matching viewport; move previews do not commit selection. A 3-unit move only inspects and preserves prior selection/viewport. A cancelled gesture restores start state. Exact 4-unit displacement uses the brush path.
- [x] Assert detail pan and zoom buttons preserve selection; ResetView preserves pinned key/selection; ClearSelection preserves viewport/pin. Pan uses the starting viewport rather than incrementally compounding changed frames. Foreign pointer moves do nothing; second Started touch and matching cancel clear the gesture without a selection commit; late Ended/Cancelled events leave a later gesture untouched.
- [x] Assert resize during either gesture rolls back committed domains; invalid/nonpositive recorded widths do not publish invalid frames and mark input unavailable. Width changes with Idle preserve domains and inspection.
- [x] Assert Following pointer/keyboard chooses only visible records; pinned out-of-view key remains with notice, and an explicit Home key selects first visible while staying Pinned. Pin with no inspected key is unchanged; resume restores Following policy. Arrow boundaries clamp; irregular records leaving no visible observation produce an empty-view notice and usable zoom-out controls.
- [x] Assert range indices are integer/finite/in bounds; crossing start/end clamp to adjacent sample indices. Initialize range controls from full record indices or nearest selected endpoints; do not mutate data. Reorder fixture retains stable inspected ID and deterministic time ordering.
- [x] Run `bun test apps/promo/test/signal-state.test.ts apps/promo/test/signal-geometry.test.ts`; observe RED.
- [x] Implement fixture: 120 records, IDs `signal-000..119`, `time=t0+i*1000`, `latencyMs=80+(i*17)%23+(48<=i && i<=54 ? 200 : 0)`, `errorPercent=0.2+(i%5)*0.1+(50<=i && i<=57 ? 4 : 0)`. Constants stay in app data. Sort a validated copy by time then ID; never reorder caller arrays in place.
- [x] Implement pure Model/update/derivation. Frame margins `{top:24,right:20,bottom:36,left:56}`; heights overview 140, details 260; full-dataset Y domains include zero and explicit 10% upper headroom. UTC formatting and units belong to the app. Gesture cancellation precedes control changes; keyboard and source/table reflect the same Model.
- [x] Run focused tests GREEN and required root checks/tests sequentially; add a narrowly scoped existing pure-render lint override only if matching neighbouring derive/view files requires it. Commit: `feat(promo): model controlled signal exploration`.

### Task 3: Scoped browser input and lifecycle evidence

**Files:** Create `apps/promo/src/examples/signals/input.ts`, `apps/promo/test/signal-input.test.ts` and `packages/foldkit-viz/test/frame-mount.test.ts`; modify `packages/foldkit-viz/src/foldkit/frame.ts`, the README and existing optional-adapter consumer fixture.

**Interfaces:** Consume Task 1 clientToLocal and Task 2 Message/ChartRole. Export `signalInputFacts(element: SVGSVGElement, role: ChartRole): Stream.Stream<Message>` and `ObserveSignalInput = Mount.defineStream(...)` with schema args `{role}` and the declared Message schemas. Extend `ChartFrameOptions<M>` with optional `onMount?: MountAction<M>` (type import from `foldkit/mount`), applying `h.OnMount` on the actual SVG. View passes `onMount: ObserveSignalInput({role})`; other frame defaults remain unchanged. No input registry/ref in Model.

- [x] Write an additive frame RED test using a real Foldkit Mount definition: the render-frame SVG carries its Mount marker when supplied, the legacy no-Mount SVG is unchanged, and `ChartFrameOptions<Message>` accepts the typed action without any casts. Extend the external optional-consumer TypeScript snippet with the typed option.
- [x] Write RED lifecycle tests with an instrumented SVG event target, fake ResizeObserver and documented six-field screen matrices. Observe Stream through a scoped Effect/Queue test boundary, never from the product update/view.
- [x] Assert client `(30,60)` under the Task 1 scale/translate matrix produces local `(10,10)` and the correct role/pointer ID. Change the matrix before another event and expect fresh conversion. Null/singular CTM marks Unavailable without corrupting coordinates; a later valid matrix recovers Ready. Width 0 is unavailable; a later positive resize is reported.
- [x] Assert listeners are acquired once per scoped stream, removed with matching callbacks/options, observer disconnects, and no event after scope closure emits a Message. Unmount during drag releases native capture; capture failure/cancel/lost capture produces cancellation, never success. Pointerup release followed by lost capture leaves pure Idle state unchanged.
- [x] Assert primary pointerdown/move/up facts carry only plain numeric fields, no Event/element/DOMMatrix reference. A second pointer fact reaches Model cancellation policy; input module owns no semantic active-pointer variable. Call native capture/release only within Mount runtime Effects. Cancelled capture release errors cannot prevent cleanup.
- [x] Run `bun test apps/promo/test/signal-input.test.ts`; observe RED.
- [x] Implement scoped acquisition with Stream.callback plus Effect.acquireRelease, native SVG pointer capture and ResizeObserver. Fresh getScreenCTM conversion occurs at the effectful event boundary. Avoid sliding/drop buffering for Started/Ended/Cancelled facts; gesture ordering must survive pointer movement. Emit Idle hover through Moved/Recorded facts without a separate stateful input store.
- [x] Render a transparent gesture surface with `data-signal-gesture` and `touch-action: none` inside each plot, while Mount remains on the actual SVG. Runtime pointerdown capture/default prevention requires that surface as target; axis/margin gestures remain ordinary page input. Prevent default only for owned plot gesture input; no wheel handler. Surface touch-action on owned SVG plot regions in the view; leave page scrolling outside them intact. If native capture proves unsuitable in the current Mount runtime, document the spec-permitted scoped-window alternative and run the same lifecycle/state assertions.
- [x] Run lifecycle/state tests GREEN and required root checks/tests sequentially. Commit: `feat(promo): scope signal pointer and resize input`.

### Task 4: Native explorer, public evidence and completion

**Files:** Create `apps/promo/src/examples/signals/{view,main,app}.ts`, `apps/promo/src/pages/examples/signals.astro`, `apps/promo/test/signal-view.test.ts` and `docs/superpowers/specs/2026-10-05-controlled-signal-exploration-qualification.md`. Modify `apps/promo/src/{pages/examples.astro,pages/docs.astro,styles/site.css}`, parity assessment and canonical `docs/roadmap.md`. Use existing ExampleSource, Layout/sitePath and lazyApp exemplars.

**Interfaces:** Produce `view(model:Model,h:HtmlBuilder<Message>):Document`, main exports `{Model,Message,init,update,view}`, and default lazyApp with typed Props/noMeta. Route passes `signalData`; no second data/state source. Render Empty/Invalid visibly; Ready consumes Task 2 derivation and Task 3 Mount.

- [x] Write RED render assertions through the real Foldkit server renderer: three explicitly labelled SVGs, UTC/ms/% labels, pinned/outside-view notices, all 120 raw table rows, active/selected text indicators, current viewport/selection/pin source, native range/button controls and input-unavailable feedback. Mark selected/inspected rows by stable ID, not row order.
- [x] Run `bun test apps/promo/test/signal-view.test.ts`; observe RED.
- [x] Compose overview plus two detail charts using shared frame/axes/grid/line/point adapters. Retain independent Y domains. Render brush preview and committed interval distinctly; shared cursor only where the inspected record is visible. Authoritative readout includes exact ID, UTC timestamp, latency ms and error %. Outside-view pin has no fabricated/clamped point marker.
- [x] Render labelled Range start/end controls; Zoom in/out, Reset view, Clear selection, Pin inspection and Resume inspection. Zoom buttons disable at limits; pin disables with no record. Focused detail SVGs handle the five specified keys and accessible native controls provide alternatives. Keep active focus through width updates.
- [x] Add the route, source files through ExampleSource, live callout/docs links and scoped crisp CSS. Light/dark colours reuse caller-configurable theme tokens; no rounded enterprise panel restyling. Noscript explains that inspection needs JavaScript and preserves illustrative context.
- [x] Run view/geometry/input/state tests GREEN. Extend the Pages artifact check's expected minimum to ten routes and assert `examples/signals/index.html` exists after the Pages build; other route references remain within base.
- [x] Run sequentially: `bun run check`; `bun typecheck`; `bun run test`; Pages-base promo build; environment-gated Pages artifact test. Confirm exit codes and test counts rather than copying the 443 baseline count. Restart dev on 4321 only after dist-changing checks finish.
- [x] Native QA at 390 and 1280 CSS pixels in light/dark: brush records 20–60 then pan a detail; inspect record 42, pin it, move viewport away and verify notice; zoom/reset/clear distinctions; native keyboard Home/End/arrows/Escape; SVG CSS transform fixture hits the intended exact record; selection and focus survive resize. Save a contextual screenshot.
- [ ] Native touch QA through the supported CUA input capability: single-touch brush and pan, second-touch cancellation, lost capture and scrolling outside the plot. Exercise hidden-to-visible SVG recovery and unmount/remount. If capability cannot deliver touch, report the exact unperformed acceptance rather than substitute model tests or claim touch qualification.
- [x] Run the one independent whole-change review required for native execution. Address material findings with reproduced RED/GREEN regressions; rerun required checks and affected native paths. No second reviewer unless a new user instruction or review outcome requires one.
- [x] Record actual source/numeric/native/lifecycle/consumer evidence and remaining limits in qualification; update F1–F3 status without claiming complete visx parity or publication. Mark plan checkboxes only for observed work.
- [x] Commit: `feat(promo): deliver qualified controlled signal explorer`. Confirm clean owned worktree; leave dev 4321 available. Final response links the explorer and evidence, gives commit/test status, and recommends an M2 quality/uncertainty spec next. Do not start M2 without approval.

## Self-review and execution handoff

The four deliverables consume named contracts from the preceding task. Self-review found the existing frame adapter had no SVG Mount hook; Task 3 adds a typed optional hook rather than duplicating the renderer. Short caller time extents receive declared display padding so the fixed minimum span never creates invalid navigation. Numeric tests cover each new API; state/lifecycle/native checks cover every spec interaction. Five review-focus cases are pinned in their owning steps. Source/metadata/export evidence travels with the pure API; route/readout/source/table/Pages evidence travels with the explorer. No independently sampled shared-X interpolation or advanced gesture promise is implied.

This plan keeps the approved native method. The user approved written-plan review; native execution retains the specified whole-change reviewer. Native touch acceptance remains explicitly unperformed. Each qualified task is committed, with the next bounded recommendation at slice completion.
