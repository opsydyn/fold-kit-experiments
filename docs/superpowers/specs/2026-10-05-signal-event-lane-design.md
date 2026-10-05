# Signal event annotations and shared lane — approved design

Date: 2026-10-05. Current source baseline: `2357948`, branch `codex/foldkit-0-166-0`, existing managed promo worktree. Status: the user approved this written spec on 2026-10-05. The [implementation plan](../plans/2026-10-05-signal-event-lane.md) is awaiting review; product implementation has not started.

## Intent and success

Help a developer understand what was recorded around a signal change: select a deployment, incident note or other caller-supplied event, locate its exact time across the charts, and inspect the surrounding observations without losing a captured comparison baseline. Temporal proximity is context, not proof of causation.

Carry forward pure TypeScript projection, expressive composable SVG, native Foldkit Model → view → Message → update, caller-owned data/colours/themes and explicit source provenance. Keep the sharp instrument aesthetic and existing measured Y domains, uncertainty bands, quality lanes, inspection, range selection and baseline semantics.

The first slice adds instant events and one shared lane to the existing Signal desk. It advances the event-lane portion of P4, not replay, live transport or critical-system suitability. Physical touch, independent capture loss and actual assistive-technology acceptance remain separately open under the [comparison qualification](2026-10-05-signal-comparison-native-qualification.md).

## Approaches and proposed decision

1. **Separate shared lane plus one selected-event guide — recommended.** Reuse each chart's existing X projection; keep all exact event labels and metadata in HTML. This avoids interpreting events as measurements and gives them independent identity/selection. Cost: an additional compact section and app-owned event validation/derivation.
2. **Overlay every event label directly on each plot.** Less page space, but labels compete with bands, thresholds and quality cues; dense or coincident events obscure observations. Reject for this first slice.
3. **General annotation engine with duration layout, collision solving and replay.** Potentially useful to several consumers, but would require policies and a public API before a second use case exists. Defer.

No new public Viz primitive or runtime dependency is proposed. Existing layout.x, finiteCoordinate, symbol geometry, theme resolution and viewport helpers provide the geometry. The existing `foldkit/annotations` renderer embeds SVG labels and is unsuitable for this lane's HTML-label policy; it remains unchanged.

## Caller data and independent provenance

Proposed typed input:

```typescript
type SignalEvent = Readonly<{
  id: string;
  time: number; // exact integer UTC milliseconds
  label: string;
  kind: string; // caller vocabulary, no built-in severity ranking
  description: string | null;
  sourceRef: string | null; // plain text, not an executable link
  style: Readonly<Partial<Pick<SeriesStyle, 'stroke' | 'fill' | 'symbol' | 'dashPattern'>>>;
}>;
type EventDataset = Readonly<{
  records: ReadonlyArray<SignalEvent>;
  snapshot: SourceSnapshot;
}>;
// Existing observation props gain optional events?: EventDataset.
```

Omission preserves existing callers and yields NotSupplied. A valid supplied dataset may contain zero events while retaining its snapshot. Event IDs are unique within the event dataset; they need not differ from observation IDs because the namespaces are explicit. Different event IDs may share the same instant.

Validate IDs, labels and kind as non-empty strings; retain their supplied text. Times must be safe integers within the JavaScript UTC range ±8.64e15 and no later than the event snapshot's asOf. This slice represents recorded occurrences, not future scheduled work. Null description/sourceRef means unspecified; non-null values must be non-empty. Styles accept the listed opaque CSS paints/dash strings and existing symbol vocabulary; no severity, success/danger palette or unit conversion is inferred.

Validate the event snapshot with the existing SourceSnapshot semantics: non-empty revision, usable asOf/updatedAt, updatedAt≤asOf and finite non-negative freshness cutoff. It is distinct from observation source metadata. Observation Fresh/Stale scenario controls do not rewrite the event feed's snapshot or freshness. The event panel labels its own revision, asOf, updatedAt, cutoff and Fresh/Stale state.

Malformed optional event data must not hide otherwise valid observations. Preserve the existing observation Props decode/semantic checks, but decode the optional event payload independently. At that boundary use the repo's Schema.Unknown plus typed override pattern so the typed caller surface stays EventDataset while untrusted runtime data can produce an event-layer error. Do not import events.ts at runtime into quality.ts: events.ts consumes quality's SourceSnapshot; a type-only caller-input reference prevents a cycle.

Normalisation copies the event records, their style records and snapshot into Model-owned values and sorts a copied array by time then code-unit ID order. Caller arrays are never mutated; subsequent caller mutation cannot change the accepted event feed. No sample is fabricated at an event timestamp and events do not extend observation bounds or Y domains.

## Foldkit ownership and transitions

Add a named event feed to ReadyModel using its own Foldkit tagged unions:

- EventFeed.NotSupplied.
- EventFeed.Invalid { error: string }.
- EventFeed.Ready { records, snapshot, inspection: EventInspection }.
- EventInspection.None | Selected { key: string }.

Only a Ready feed has selection. Zero records uses Ready with None and an explicit empty-feed message; no duplicated boolean loading/empty/selected fields. The existing observation Empty/Invalid models remain unchanged; a standalone event browser without a usable observation time range is out of scope.

Use messages that describe completed interactions: ClickedEvent { key }, ClickedClearEvent {}, ClickedCentreEvent {}. Handle each union through its own `.match`. No new Command, timer, Subscription or Mount pointer stream is needed: selection/centre controls are ordinary HTML buttons; existing measured chart width supplies the lane.

| Fact or action                                                              | Required result                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Select an existing event                                                    | Cancel a provisional gesture first, then select the event; retain committed viewport/interval, observation inspection and captured baseline.                                                                                                                                                                                                                                  |
| Unknown key, NotSupplied/Invalid feed                                       | No-op; do not cancel an unrelated gesture or invent a substitute.                                                                                                                                                                                                                                                                                                             |
| Clear an actual selected event                                              | Roll back a provisional gesture, then set None; retain committed viewport/interval, inspection and baseline. Clear with no selected event is a no-op.                                                                                                                                                                                                                         |
| Centre an event within observation bounds                                   | Roll back first; translate the committed viewport to centre its time with existing panDomain/constrainDomain, preserving span and the existing minimum1000ms policy. Retain interval selection and baseline. Pinned inspection stays; existing settleInspection may clear a Following key that is outside the new view. Never choose a replacement observation automatically. |
| Centre with no selection or event outside bounds                            | No-op; the button is disabled. Observation bounds never expand to fit an event.                                                                                                                                                                                                                                                                                               |
| Pan/brush/zoom/ranges/resize/reset/clear interval                           | Retain selected event identity, even if it leaves the current view. Existing gesture and observation policies remain.                                                                                                                                                                                                                                                         |
| Capture/replace/clear comparison baseline or change observation Fresh/Stale | Retain selected event and its source snapshot.                                                                                                                                                                                                                                                                                                                                |
| ChangedSignalDataset, including reused revisions/IDs                        | Existing init resets baseline and gestures; decode the new event payload and reset its selection to None. No identity continuity across replacement.                                                                                                                                                                                                                          |

All event controls live outside plot gesture-capture surfaces. Cancellation is the existing rollback policy; late pointer Ended/Cancelled facts cannot commit the abandoned work. Late ordinary Following hover may still change current observation independently, as in the qualified comparison contract.

## Shared time lane and density policy

Place one Events section between the comparison panel and the latency detail chart. Its compact SVG uses the latency layout's frame width, plot-left/right and X projection, the same content width and a height of52 SVG units. It creates no measured Y scale. Existing chart frame heights/margins and quality lanes remain unchanged. The section states the current UTC interval in HTML; it does not add another crowded SVG time-label row.

Only events whose exact time is within the inclusive viewport form visible marks. Each projected X must be finite. Do not edge-clamp out-of-view events. The HTML event list retains every accepted event, including those outside the viewport or the full observation range; show exact counts and distinguish those two statuses. A zero-in-view lane says No events in this time range. A selected off-screen event retains its full details and Outside current view notice; an event outside bounds says Outside available time range and cannot be centred.

Avoid a barcode of overlapping individual marks: group visible events into12-SVG-unit screen cells relative to plotLeft, using floor((x−plotLeft)/12). This is explicit application presentation policy, not new package chart math or data aggregation. A cell's marker is anchored at its first event's actual X, never an invented average time. Group identity uses unambiguous serialization of ordered member IDs, not delimiter joining. Groups retain original Model event references, member IDs, exact times and count. Recompute visual groups when viewport/width changes without changing raw data or selected event identity.

A singleton uses the caller's glyph/style. A multi-event cell uses a neutral bundle glyph, not one member's kind or a severity colour. Explain the bundle cue beside the lane; the expanded HTML list identifies each visible bundle by its count and exact first/last timestamps while preserving time-ordered event buttons. Do not cram event labels or count digits into the SVG. Near events remain individually selectable through the complete chronological HTML list. The lane is a visual summary, not a replacement for that list. In this first slice lane marks are decorative, aria-hidden and outside the tab sequence; selection occurs through clearly labelled HTML buttons. There is no hidden hit-test, nearest-event click policy or expandable cluster submodel.

Grouping is not claimed as a large-data performance solution. Dense fixtures prove retained members and truthful counts; rendering budgets, virtualisation and P5 downsampling remain separate work.

## Selected-event annotations and interaction

For a selected event, draw one time-only guide at its exact X in each detail chart, clipped through the existing plot clip. Draw its overview guide only when its time is within the full observation bounds. Each role projects its own domain; no nearest-record alignment, interpolation, Y value or event-driven domain expansion occurs.

The default event guide uses a dash-dot6 2 1 2 cue, distinct from the existing cursor2 4 and baseline3 3, plus an HTML legend and accessible record-specific description. Caller paints/glyphs and CSS theme values remain extensible. A selected event inside a visual bundle gets its own exact-time guide; the bundle remains a summary of all members. The HTML summary preserves its own time even if the guide visually coincides with an observation cursor or another reference.

The complete chronological list sits in a native, initially closed Browse events (N) disclosure, following the repo's existing raw-table pattern. It is not a new application-selection store. Selected-event details remain outside the disclosure so the lane stays compact after the list is closed. The list contains a normal Select event button per accepted event, with exact UTC time, kind and label. The selected button exposes aria-pressed and a visible non-colour selection cue. Selection details expose ID, description/sourceRef or explicit unspecified text, own feed provenance, viewport status and Clear event/Centre event controls. Labels are escaped text and wrap at narrow widths. Metadata are never SVG overlays or unsafe links.

If an observation exists at that exact time, the event detail may state its exact observation ID; otherwise state No observation at this exact timestamp. Do not display a nearby observation as the measurement at the event, and do not alter observation inspection. The existing inspector/keyboard controls remain how users examine surrounding raw readings. No event is described as causing a latency/error change.

Use one restrained polite event-selection live region containing only the selected ID/time/label announcement, or No event selected after clear. It changes on selection/clear, not on pan/hover or visual regrouping. Full details, viewport status, source metadata and counts stay outside that live region. Screen-reader announcements still require direct acceptance, not just markup.

## Illustrative fixtures

Retain all115 observation records and their existing quality metadata. Add8 plainly labelled static event records under independent revision signal-events-v1, updatedAt=t0+129000, asOf=t0+130000, cutoff10000ms (t0=1700000000000):

| Key            | Time offset | Purpose                                                                            |
| -------------- | ----------- | ---------------------------------------------------------------------------------- |
| event-before   | −5000ms     | Outside available observation time range; retained text, disabled centre.          |
| event-missing  | +12000ms    | Within Missing latency run; selecting does not fabricate a measurement.            |
| event-deploy   | +48000ms    | Caller-recorded deployment near the existing spike; no causal claim.               |
| event-config   | +48000ms    | A distinct event at the same instant; deterministic order and membership.          |
| event-note     | +48200ms    | Nearby distinct time; no exact observation, bundle/guide fidelity.                 |
| event-gap      | +72000ms    | Event during the absent-record interval; no gap repair.                            |
| event-boundary | +119000ms   | Inclusive right boundary, exact observation association.                           |
| event-after    | +125000ms   | Outside observation bounds but before own snapshot asOf; sources stay independent. |

Kinds, descriptions, source refs and fixture styling are caller-authored. Event snapshot times must not be borrowed from observation freshness scenarios. Include dedicated tests for an empty supplied feed, invalid feed and dense/coincident events rather than adding more page modes or controls.

## Module responsibilities and compatibility

Proposed new app files: events.ts (input schemas/normalisation/feed unions), events-data.ts (illustrative caller fixture), event-derive.ts (pure visible groups, selected event/status, exact guide geometry) and event-view.ts (HTML list/details, lane, guide composition). Existing model/message/update own lifecycle; view composes the new section and guides. quality.ts gains only the optional decode boundary/caller type; quality-data.ts supplies the event dataset for this route.

Derivation consumes existing CartesianLayout; no new generic layout/annotation engine, global registry or hidden state. Selected guide lines use numeric SVG attributes. Theme/custom-style resolution uses existing Viz helpers. If package math is later changed, the repo's vendored D3 source-of-truth rule applies; this design proposes no package math change.

The Controlled state/source disclosure must include the accepted event feed (or NotSupplied/Invalid), independent snapshot, selected key, lane width and the12-unit grouping policy. This supports checking rendered evidence without inspecting hidden runtime state.

The promo route must disclose all17 actual source files after these four additions, preserve10 Pages routes and base-aware links, and update the recipe copy. No new gallery/homepage card. Existing callers without events, observation validation, raw115-row table, quality bands/lanes, comparison arithmetic/provenance and measurement teardown remain compatible.

## Verification contract

- Input/state: omitted/empty/invalid event feeds do not conceal valid observations; duplicate event IDs fail only the event layer; coincident times and namespaced IDs succeed; integer/UTC-range/asOf boundaries and malformed style fail explicitly. Caller input mutation after normalisation cannot change accepted data.
- Selection: exact selected ID, unknown-key no-op, independent observation/baseline state, clear/centre policies, all retention transitions and same-revision replacement reset. Capture/clear/centre during pan/brush roll back first and reject late commits. Pinned versus Following settlement on centre is explicit.
- Pure derivation: inclusive endpoints, outside viewport/bounds, signed UTC times, equal timestamps, time/ID order, empty visible list, finite projection failure,12-unit cell boundaries and resized regrouping. Preserve every member/reference/count and actual first-event anchor; no average timestamps, edge clamps or Y-domain changes.
- Composition: stable keyed HTML buttons and aria-pressed, exact metadata/source/time/unspecified values, singular selected guides, bundle cue independent of kind, no label collision with axes/quality lanes, escaped text, no invented nearest reading. Existing baseline/error bars/bands/raw table stay intact.
- Native: mouse/keyboard select/clear/centre; event during a gap; same-time events; off-screen selection; simultaneous baseline/current/event;390/1280 light/dark; committed selection after centre and held-gesture cancellation. Device/assistive-technology gates remain separate until directly observed.
- Delivery: baseline typecheck/check before product edits; meaningful RED→GREEN regressions; sequential root check/typecheck/workspace tests and packed consumers only if package surfaces change. Pages-base build/route tests must retain10 routes. Restart4321 after shared-dist builds; record exact counts and qualified boundaries. Commit completion; no release/push/version change.

## Scope, self-review and next stage

Defer duration/range events, event editing/loading, feed refresh/live replay, persistence/export, multiple event sources, automatic causal ranking, severity rules, hyperlinks, SVG marker activation, multi-event selection and a public generic annotation engine. This slice is local composition with one optional caller event feed.

Self-review: selection has one owner; optional event errors are isolated; event/observation snapshots and IDs are distinct; instant-time and cell grouping semantics are exact; all transition exceptions and dataset-reset boundaries are written; fixtures cover gaps, ties and range boundaries without replacing current measurements. No placeholders or unresolved alternatives remain in the proposed design.

Next: review this written spec, then create a concrete test-first implementation plan. Native execution remains the user's selected method. This design approval does not imply publication or completion of replay/hardware/assistive-technology gates.
