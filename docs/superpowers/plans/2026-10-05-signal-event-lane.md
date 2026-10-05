# Signal Event Lane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add caller-owned instant events, a shared time lane and exact selected-event guides to the Signal desk without changing measurement or comparison semantics.

**Architecture:** Decode the optional event feed independently, then hold accepted data and selection in native Foldkit unions. Derive screen groups and guide positions from existing Cartesian layouts; compose decorative SVG with ordinary HTML selection controls. No public Viz API or dependency changes.

**Tech Stack:** Foldkit 0.166.0, Effect 4.0.0, Astro 7.1, TypeScript, Bun, oxlint and oxfmt.

**Spec:** [Approved event-lane design](../specs/2026-10-05-signal-event-lane-design.md).

**Status:** Awaiting plan review. Native execution is already selected. No product implementation in this planning commit.

## Global Constraints

- Existing observation callers may omit events; invalid optional events must not conceal valid observations.
- Preserve all 115 illustrative observations, quality semantics, raw table, captured baseline, chart heights/margins and measured Y domains.
- UTC event times are safe integer milliseconds within ±8.64e15, no later than their own snapshot asOf. Coincident event times are allowed; IDs are unique only within the event feed.
- Model → view → Message → update owns state; use union `.match`, fact messages and existing gesture cancellation. No new Command, timer, Subscription, Mount stream or external state.
- Lane height 52 SVG units; grouping cells 12 SVG units relative to plot-left; default selected guide dash `6 2 1 2`. No edge clamping or averaged event times.
- Selection occurs through HTML buttons. SVG marks are decorative, aria-hidden and outside the tab sequence. Source refs remain escaped plain text.
- Temporal proximity is context, not causation. No nearest measurement, inferred severity, gap repair, replay, future scheduling or critical-system suitability claim.
- Preserve 10 Pages routes and base-aware links; disclose 17 actual source files. No release, push, package export or new gallery card in this slice.

## Review Focus

1. Malformed optional payloads and caller mutation must not corrupt accepted observations/events: Task 1 isolation and boundary tests.
2. Event actions during a provisional gesture must use committed state; unknown IDs must not cancel it: Task 2 rollback and late-fact tests.
3. Coincident times, delimiter-bearing IDs and resize must retain every event and its actual time: Task 3 grouping tests.
4. Events inside Missing/absent intervals or outside bounds must not invent readings or clamp guides: Tasks3–4 geometry and composition tests.
5. Pan, hover and regrouping must not change event announcements or overwrite independent provenance: Task 4 live-region and source tests.

---

## File map and qualification convention

All paths below are relative to the existing managed worktree on `codex/foldkit-0-166-0`. Continue there; preserve unrelated work. Read current AGENTS.md and the approved spec before execution.

| File                                                                                              | Responsibility                                                             |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `apps/promo/src/examples/signals/events.ts` (new)                                                 | Event input schemas, typed contract, normalisation, feed/inspection unions |
| `apps/promo/src/examples/signals/events-data.ts` (new)                                            | Eight caller-authored illustrative events with independent provenance      |
| `apps/promo/src/examples/signals/event-derive.ts` (new)                                           | Selected record/status, visible groups, exact guide geometry               |
| `apps/promo/src/examples/signals/event-view.ts` (new)                                             | Shared lane, list/details, HTML announcement and clipped guide nodes       |
| `apps/promo/src/examples/signals/quality.ts`, `quality-data.ts`, `model.ts`                       | Optional decode boundary, fixture composition, model-owned feed            |
| `apps/promo/src/examples/signals/message.ts`, `update.ts`                                         | Event interaction facts and lifecycle                                      |
| `apps/promo/src/examples/signals/derive.ts`, `view.ts`                                            | Controlled source evidence and chart/page composition                      |
| `apps/promo/src/pages/examples/signals.astro`, `apps/promo/src/styles/site.css`                   | Actual-source disclosure, recipe copy, responsive themed styling           |
| `apps/promo/test/signal-event-{input,state,geometry,view}.test.ts` (new)                          | Input, transition, geometry and rendered regression evidence               |
| `README.md`, `docs/roadmap.md`, `docs/assessments/2026-10-05-visx-parity-and-chart-excellence.md` | Delivered scope and next bounded work                                      |
| `docs/superpowers/specs/2026-10-05-signal-event-lane-qualification.md` (new)                      | Automated and direct browser evidence, separate open acceptance gates      |

Before code, run `bun typecheck`, then `bun run check` to establish the baseline. Each task uses RED → minimal implementation → GREEN. Its qualification gate is sequential `bun run check`, `bun typecheck`, `bun run test`; expect exit 0, with no new skipped tests. Do not run root `bun test` against vendored D3. Shared-dist builds cannot overlap. Restart the promo dev server on 127.0.0.1:4321 after the final build/test cycle before browser qualification. Stage only task files and commit each qualified task.

### Task 1: Independent accepted event data

**Files:** Create `events.ts`, `events-data.ts`, `signal-event-input.test.ts`; modify `quality.ts`, `quality-data.ts`, `model.ts` at their input schemas/init.

**Interfaces:**

- Consume existing `SourceSnapshot`, `sourceFreshness(snapshot: SourceSnapshot): 'Fresh' | 'Stale'` and Viz `SeriesStyle`/symbol vocabulary.
- Produce `SignalEvent` and `EventDataset` with exactly the approved spec fields. Export matching schemas; event style permits only optional string stroke/fill/dashPattern and existing symbol values.
- Export `EventInspection = None | Selected { key: string }` and `EventFeed = NotSupplied | Invalid { error: string } | Ready { records: ReadonlyArray<SignalEvent>; snapshot: SourceSnapshot; inspection: EventInspection }` as Foldkit tagged unions and their types.
- Export `normaliseEventFeed(input: unknown): EventFeed`: undefined→NotSupplied, malformed→Invalid, valid→Ready with copied/sorted data and None. Never throw on supplied invalid data.
- Rename/export quality's existing semantic helper to `validSourceSnapshot(snapshot: SourceSnapshot): boolean`, preserving its body/callers. `events.ts` imports that helper and SourceSnapshot; `quality.ts` imports EventDataset **type only**.
- Runtime Props schema adds `events: Schema.optional(Schema.Unknown)`. Typed `Props = Omit<typeof Props.Type, 'events'> & { readonly events?: EventDataset }`. Export `ObservationProps = Omit<typeof Props.Type, 'events'>`; `validSignalProps(props: ObservationProps): boolean` continues checking observations only, accepting decoded unknown event payloads structurally.
- ReadyModel gains `events: EventFeed`; `init` normalises decoded events only after valid non-empty observations and bounds. Existing Empty/Invalid models remain unchanged.
- Export `eventDataset: EventDataset` from `events-data.ts`; `qualityProps.events = eventDataset`.

- [ ] **Write input tests** named `optional feed isolation`, `event boundary validation`, `coincident namespace and sort`, `caller mutation isolation`, `illustrative source independence`. Assert omitted→NotSupplied; supplied empty→Ready/None with its snapshot; malformed payload/duplicate IDs/empty text/invalid style→events.Invalid while observation model remains Ready with 115 records. Accept an event ID equal to an observation ID and distinct IDs at the same time. Accept times ±8.64e15 when snapshot permits; reject fractional/unsafe/nonfinite/out-of-range/future times. Reject invalid snapshot revision/order/cutoff; accept cutoff 0 and time=asOf. Non-null description/sourceRef must be non-empty. Sort tied IDs by code-unit order, retain supplied strings, and prove mutating caller array/record/style/snapshot after init does not change accepted values.
- [ ] **Run RED:** `bun test apps/promo/test/signal-event-input.test.ts`. Expected missing event module/schema/model field failures, not unrelated baseline failures.
- [ ] **Implement interfaces** above using schema decode plus semantic validation; copy each record, nested style and snapshot before sorting. Add the exact eight keys/offsets from the spec with t0=1700000000000, revision `signal-events-v1`, updatedAt=t0+129000, asOf=t0+130000, staleAfterMs=10000. Choose descriptive caller labels/kinds/refs without causal wording; tests assert all eight offsets and unchanged 115 observations. Cover omitted input in legacy fixture helpers rather than forcing events on every caller.
- [ ] **Run GREEN:** focused input tests, then the qualification gate. Confirm there is no quality→events runtime import cycle and no public package change.
- [ ] **Commit:** `feat(promo): accept independent signal event feeds`.

### Task 2: Native event selection and committed viewport centring

**Files:** Modify `message.ts`, `update.ts`; create `signal-event-state.test.ts`.

**Interfaces:** Consume Task 1 feed/inspection unions and existing ReadyModel, `panDomain`, `cancel` and `settleInspection` update helpers. Add Message constructors `ClickedEvent({ key: string })`, `ClickedClearEvent()` and `ClickedCentreEvent()`. Existing `update(model: Model, message: Message)` retains its return type. Do not export a parallel event reducer or effects.

- [ ] **Write transition tests** named `select and clear preserve independent state`, `unknown event is a true no-op`, `centre committed viewport`, `boundary and invalid centre`, `event retention matrix`, `same revision replacement resets selection`, `abandoned gesture cannot commit`. Use the eight-event fixture; select exact IDs, never substitutes. With committed viewport [t0+20000,t0+60000], centring event-deploy yields [t0+28000,t0+68000]; centring event-boundary yields [t0+79000,t0+119000]. Preserve interval selection and captured baseline; Following signal-010 clears outside the new view, Pinned signal-010 stays. Outside-bound events cannot centre or expand bounds. During a provisional pan, centre from startViewport, not preview; select/clear roll back before applying. Unknown keys and no-selection clear/centre preserve the entire active gesture. Late Ended/Cancelled facts after cancellation leave committed state unchanged.
- [ ] **Run RED:** `bun test apps/promo/test/signal-event-state.test.ts`; expect missing message constructors/transition failures.
- [ ] **Implement three handlers** via feed/inspection `.match`: resolve valid action before cancellation; cancel once, then apply selection or translate committed viewport by event.time minus its midpoint using existing panDomain and minimumSpan 1000. Use settleInspection after centring only. Leave ordinary hover policy unchanged. Dataset replacement goes through init, resetting event selection even with reused revision/IDs.
- [ ] **Run GREEN:** focused state tests and qualification gate. Retention matrix covers pan, brush, zoom, range controls, resize, reset, clear interval, capture/replace/clear baseline and both observation freshness scenarios; event snapshot/selected identity remain unchanged.
- [ ] **Commit:** `feat(promo): select and centre signal events natively`.

### Task 3: Exact-time projection and truthful visual density

**Files:** Create `event-derive.ts`, `signal-event-geometry.test.ts`; modify `derive.ts` controlled-source disclosure.

**Interfaces:** Consume Task 1 types, ReadyModel, ChartRole and existing CartesianLayout/finiteCoordinate. Export:

```typescript
export const EVENT_CELL_SIZE = 12;
export type EventGroup = Readonly<{
  key: string;
  x: number;
  members: ReadonlyArray<SignalEvent>;
}>;
export type EventPosition = 'InView' | 'OutsideView' | 'OutsideBounds';
export type EventGuide = Readonly<{ x: number; top: number; bottom: number }>;
export function selectedEvent(model: ReadyModel): SignalEvent | null;
export function eventPosition(model: ReadyModel, event: SignalEvent): EventPosition;
export function visibleEventGroups(
  model: ReadyModel,
  layout: CartesianLayout,
): ReadonlyArray<EventGroup>;
export function selectedEventGuide(
  model: ReadyModel,
  role: ChartRole,
  layout: CartesianLayout,
): EventGuide | null;
```

Groups expose count as members.length and first/last exact times through members; no duplicate count/time store. `currentSignalSource` retains its signature and adds accepted `events`, `selectedEventKey`, `eventLaneWidth` (latency frame width) and `eventCellSize = 12`.

- [ ] **Write geometry tests** named `inclusive visibility and actual anchors`, `cell boundary and identifier identity`, `resize preserves membership and selection`, `offscreen guide is not clamped`, `independent event source evidence`. For an identity X layout over[0,100], events at0,11,12,12,23,24,100 form group sizes[2,3,1,1] anchored at[0,12,24,100]; assert member object identity, deterministic tied ID order and JSON.stringify(ordered IDs) group keys, including delimiter-bearing IDs. Width100 groups times0,5,10 together; width 240 splits them into three groups at0,12,24 with no data/selection mutation. Inclusive endpoints appear; out-of-view records do not. Empty/not-supplied/invalid feeds produce no groups. Nonfinite projected positions fail explicitly through finiteCoordinate rather than emitting invalid SVG. Cover negative UTC times.
- [ ] **Run RED:** `bun test apps/promo/test/signal-event-geometry.test.ts`; expect missing derivation exports/source fields.
- [ ] **Implement functions** above: filter inclusive viewport, project finite actual X, group floor((x−plot.left)/12), retain model references and first actual X. OutsideBounds takes status precedence over OutsideView. Detail guides project selected exact time even when clipped offscreen; overview returns null outside observation bounds. With a zero-margin width 100 layout and viewport[t0+50000,t0+60000], event-gap guide X=220; never clamp it to100. Feed omission/invalid/no selection returns null.
- [ ] **Run GREEN:** geometry tests and qualification gate. Source tests assert event revision `signal-events-v1`, selected ID, width and12-unit policy; changing observation Fresh/Stale leaves event snapshot unchanged.
- [ ] **Commit:** `feat(promo): derive exact signal event lanes and guides`.

### Task 4: Compose the event instrument and qualify the route

**Files:** Create `event-view.ts`, `signal-event-view.test.ts`, qualification document; modify `view.ts`, `signals.astro`, `site.css`, README, roadmap and parity assessment.

**Interfaces:** Consume Tasks1–3 and existing `HtmlBuilder<Message>`, Html, theme/style/symbol helpers. Export `eventPanel(model: ReadyModel, layout: CartesianLayout, h: HtmlBuilder<Message>): Html` and `eventGuideLayers(model: ReadyModel, role: ChartRole, layout: CartesianLayout, h: HtmlBuilder<Message>): ReadonlyArray<Html>`. Parent view supplies the existing latency layout to the panel; each chart supplies its own layout to guides inside its existing clip group. No extra measurement mount.

- [ ] **Write rendered tests** named `event feed states and provenance`, `exact event evidence in gaps`, `decorative grouping and selected guide`, `selection announcement remains stable`, `escaped responsive metadata`, `existing signal composition remains intact`. Assert distinct NotSupplied/Invalid/empty/no-visible copy; all accepted events in an initially closed Browse events (N) details element; selected aria-pressed plus visible non-colour cue. Assert event-note/event-gap say `No observation at this exact timestamp`; event-boundary associates signal-119 exactly. Missing readings retain Missing state. OutsideBounds uses `Outside available time range` and disabled Centre; other offscreen uses `Outside current view`. Null metadata has explicit unspecified text, supplied HTML-like labels/source refs are escaped plain text. Selected detail exists outside closed disclosure. One polite live region contains only selected ID/time/label or `No event selected`; its content stays identical across pan, hover, resize and freshness changes. Guide is exact-time, clipped, dash `6 2 1 2`; no SVG labels/count digits/tab targets. Bundle HTML reports count/first/last exact times. Existing quality bands, comparison bars/baseline provenance, fixed chart geometry and115-row raw table remain intact.
- [ ] **Run RED:** `bun test apps/promo/test/signal-event-view.test.ts`; expect missing event panel/guide markup.
- [ ] **Implement view interfaces** above. Insert panel after comparison and before latency. Use a 52-unit lane aligned to latency frame/plot; singleton caller glyph/style, neutral multi-event bundle with HTML legend. Buttons dispatch the three facts outside plot capture. Keep exact source metadata/freshness and counts outside live region. Resolve caller paints against existing theme defaults, with visible focus and wrapping at 390px; no fixed severity palette.
- [ ] **Update route/source/docs:** import/disclose four new raw files for 17 total; preserve 10 routes and base-aware links. Explain recorded context without causal claims. Qualification document separates automated, direct browser and unperformed device/AT evidence; mark only event-lane portion of P4 delivered after qualification, retain replay and other gaps.
- [ ] **Run GREEN:** view tests, complete qualification gate and `PROMO_BASE_PATH=/fold-kit-experiments/viz/ bun run --filter @opsydyn/promo build`, then `PROMO_BASE_PATH=/fold-kit-experiments/viz/ bun test apps/promo/test/pages-build.test.ts`. Inspect built route/source links:10 Pages routes,17 actual sources, no base-path regression. Record exact commands/results. Restart port 4321 after checks; confirm native hydration.
- [ ] **Direct browser qualification:** mouse and keyboard select ties, Missing/gap, nearby fractional-sample event, boundaries and outside bounds; Centre/Clear; baseline+current+event together; pan/zoom/resize retention. Exercise event actions while holding pan and brush, then release: abandoned gesture cannot commit. Verify 390/1280 light/dark layout, no horizontal overflow, source/table and full event evidence. Restore default viewport, Fresh, no selection/baseline and closed disclosures for review. If physical touch, independent capture loss or actual screen-reader testing is unavailable, record those gates open; do not infer them from markup or synthetic events.
- [ ] **Commit:** `feat(promo): compose and qualify the signal event instrument`. Link local review route and qualification evidence. Recommend the next bounded work with its evidence basis; do not start it without approval.

## Inline plan review

Coverage: feed contract/compatibility→Task 1; lifecycle/rollback→Task 2; visibility/density/exact guides/source→Task 3; accessible composition/provenance/style/route/native evidence→Task 4. Each Review Focus item has owning assertions. Interface names and fields above are shared verbatim between tasks; source input runtime/type separation prevents a dependency cycle. Existing rendering, replay and hardware/AT gates remain explicit. This plan changes no public package surface and requires no release or additional packed-consumer work beyond existing workspace checks.
