# Signal event lane — qualification

Date: 2026-10-05. Branch: `codex/foldkit-0-166-0`. Plan baseline: `875e3ae`. This is local implementation evidence; no push, release or publication is claimed.

## Delivered scope

Optional caller event feeds are decoded independently of observations into native Foldkit feed/inspection unions. Accepted records, nested styles and source snapshots are isolated from caller mutation. Recorded instants retain exact UTC milliseconds and their own source freshness; coincident timestamps retain distinct IDs. Eight illustrative events accompany the existing 115 observations.

Selection/clear/centre facts preserve independent observation inspection, committed interval and captured baseline. Provisional pan/brush is rolled back before a valid event action; unknown keys and unavailable feeds do not cancel gestures. Centring preserves the viewport span within observation bounds, settles Following inspection and retains Pinned inspection. Dataset replacement resets event selection even with reused revision/IDs.

The shared 52-unit lane reuses the latency X layout. Visible events group into 12-unit cells relative to plot-left, retain every original Model member, and anchor at the first actual event time. Selected guides use exact timestamps and existing chart clips; no edge clamp, gap repair, nearest measurement or Y-domain expansion. HTML provides all accepted records, independent provenance, exact associations/status and accessible selection controls. A dedicated polite event announcement changes with selection/clear rather than pan, hover or regrouping.

No public Viz API/runtime dependency change, event replay, feed transport or critical-system qualification is included. Remaining device and assistive-technology gates are separate.

## Automated evidence

- Task1: six input regressions failed before event state existed, then passed 106 assertions. Omitted/empty/invalid feeds, independent source validity, exact time boundaries, unique/namespaced IDs, ties and caller mutation are covered.
- Task2: seven absent-fact regressions failed first, then passed 78 assertions. Exact centre domains, rollback, late commit rejection, no-op invalid actions, retention matrix and dataset replacement are covered.
- Task3: the geometry module was absent on RED; seven geometry/source regressions pass 42 assertions. Inclusive boundaries, signed times, nonfinite projection, actual anchors, 12-unit cell boundaries, collision-safe group keys, member reference retention, resize and unclamped offscreen guides are covered.
- Task4: six full-view regressions failed without the panel/guides, then passed 64 assertions. Independent feed states/provenance, gap/Missing association, decorative bundles, pressed state, stable announcement, escaped plain metadata and existing quality/comparison/raw-table composition are covered.

Pre-review `bun run check` and `bun typecheck` exit0 with no errors/warnings. Sequential `bun run test`: **549 pass, 1 existing skip, 0 fail** (Astro74, Viz211, promo146, web118). Pages-base build exits0 with **10 routes**; `PROMO_BASE_PATH=/fold-kit-experiments/viz/ bun test apps/promo/test/pages-build.test.ts` passes **290 assertions**. Built Signal HTML contains all **17 actual source disclosures**. Dev server restarted from apps/promo on127.0.0.1:4321 after builds. Full logs remain local under `/tmp/events-task{1,2,3,4}-*.log`; they are not committed runtime dependencies.

## Direct browser evidence

Direct checks used the existing Codex in-app browser review tab after restarting/reloading the app. Native HTML mouse clicks selected all eight IDs; keyboard Enter also selected and centred events. Before/after events retain their metadata with disabled Centre. Coincident config/deploy events select independently; the200ms follow-up and gap event expose no exact observation, while Missing/boundary events associate signal-012/signal-119 without fabricating values.

Keyboard range controls set a committed20–60s interval. Capturing signal-035, inspecting/pinning signal-040 and centring event-gap produced viewport52–92s with the20–60s interval unchanged. Centring event-note then produced28.2–68.2s. Baseline035 and pinned040 stayed independent, including source freshness; switching observation Stale left event source Fresh with its original snapshot. Selected event identity survived viewport/width changes.

Held-pointer tests used real browser pointer down/move, ordinary HTML keyboard activation and eventual pointer up. **Select/Clear/Centre passed for active pan and active brush**: pan had a changed provisional viewport; brush had a visible dashed preview rectangle. Each action restored committed state before applying, retained the interval and prevented a late release from committing abandoned work. A first rapid probe read unsettled UI state, and initial overview probes targeted an offscreen surface; those do not count as acceptance. The successful probes verified visible capture geometry and settled native UI before and after each action. No product patch was made for those tooling observations.

| Viewport  | Theme | Evidence                                                               |
| --------- | ----- | ---------------------------------------------------------------------- |
| 1280×1000 | Light | [Screenshot](../../assets/2026-10-05-signal-event-lane-1280-light.png) |
| 1280×1000 | Dark  | [Screenshot](../../assets/2026-10-05-signal-event-lane-1280-dark.png)  |
| 390×1000  | Light | [Screenshot](../../assets/2026-10-05-signal-event-lane-390-light.png)  |
| 390×1000  | Dark  | [Screenshot](../../assets/2026-10-05-signal-event-lane-390-dark.png)   |

All four layouts had zero document horizontal overflow; lane/detail widths matched1120px at1280 and350px at390. All three exact-time guides remained present, and long metadata wrapped. Raw observations were expanded and visibly contained115 rows; the working source section exposed17 names. Viewport override reset, Light/Fresh/full viewport restored, interval/event/baseline cleared and disclosures closed. These prove browser UI behaviour, not physical touch, independent capture loss, actual screen-reader speech or representative-user comprehension.

## Decisions and boundaries

- Extended the existing pure Signal-file lint override to the four new pure modules. The unknown-input parser and malformed-payload test helper have narrow documented exceptions; the parser actually schema-decodes unknown data.
- Compared gesture rollback intervals by value: Foldkit's gesture constructor copies nested startSelection. Exact evidence, rather than object allocation, is the preservation contract.
- Kept a local finite-output guard: Viz's finiteCoordinate helper is internal, and this slice does not expand public package exports or deep-import internals.
- Screen-cell grouping is presentation policy, not large-data qualification. Close events can straddle a cell boundary; grouping must retain exact data across width/viewport changes.

## Remaining acceptance and next work

Physical touch, independent capture loss, actual screen-reader announcement behaviour and representative-user comprehension remain open unless directly observed below. Replay/live transport, future scheduled events, duration events, event editing/loading, persistence/export, causal ranking and P5 rendering budgets remain deferred.

Recommend a bounded signal-desk accessibility acceptance pass next: actual screen-reader selection/clear announcements, keyboard reading order and focus after centring, with direct touch/capture-loss checks on an available device. It qualifies the interaction already delivered before adding replay complexity.

## Independent final review and correction — 6 October 2026

One fresh reviewer inspected `875e3ae..8e098f7` read-only. No Critical issue was found. The confirmed Important issue was positional patching: entering an empty event range repurposed the original polite announcement node as provenance, then replaced the new announcement on leaving the range. SSR string equality had missed actual DOM identity. The fix keys stable Ready-feed siblings, including the announcement, source, disclosure and selected detail. A real installed Foldkit patcher regression now verifies node identity, unchanged announcement text through viewport transitions, and retained open disclosure through clear/reselect. The DOM harness runs in a separate process to avoid contaminating SSR globals and uses the already locked happy-dom20.10.6 as a promo-only dev dependency. Framework internal APIs are confined to this test fixture.

The reviewer also found a caller-style legend described every guide as dash-dot, even for supported `dashPattern: 'none'`. Re-graded Important because it misexplains the caller's visual encoding; the detail now says “Selected-event guide = exact selected event time”. A full-view regression verifies the solid caller guide and style-independent legend. Both new tests failed before correction and passed afterward: eight event-view tests,70 Bun assertions plus20 actual DOM assertions in the isolated process. No second review was dispatched.

The reviewer declined actual screen-reader speech, physical touch, independent capture loss, large-feed performance and representative-user comprehension. Ruling: keep these explicitly unqualified; direct platform/device measurements and user studies are required. Cost if wrong: residual accessibility, device, scaling and communication defects remain possible. These are acceptance boundaries rather than evidence of successful behaviour.

Additional implementation rulings retained for audit:

- Narrow pure-module lint exceptions: cost if wrong is reduced lint coverage only for those documented files.
- Rollback interval comparison by value rather than allocation: cost if wrong is an unreported allocation change; exact contents remain covered.
- Local finite projection guard: cost if wrong is duplicated guard maintenance; nonfinite outputs remain tested.
- Legacy axis regression covers the three measured charts, with the decorative lane covered separately: cost if wrong is an axis assumption excluded from the legacy test.
- Test-only patch internals and direct locked DOM dev dependency: cost if wrong is test maintenance on Foldkit upgrades; runtime dependencies and public Viz APIs remain unchanged.

Post-correction qualification: `bun run check` and `bun typecheck` exit0; full sequential workspace tests pass **551 tests,1 existing skip,0 failures** (74Astro,211Viz,148promo,118web). Pages build produces10 routes; its separate links/islands regression passes290 assertions. Logs: `/tmp/events-review-{red,green,check,types,tests,pages-build,pages-test}.log`.

After restarting4321, direct browser selection of event-gap showed the corrected explanation. Clearing preserved the open Browse events disclosure and changed the announcement to “No event selected”. A1280×1000 Dark check selected event-note, retained all three guide layers and had zero horizontal overflow; [post-correction screenshot](../../assets/2026-10-06-signal-event-lane-review-dark.png). Light/Fresh/full viewport was restored with event,interval and baseline empty, and viewport override reset. DOM identity itself is proved by the patch regression; no screen-reader speech claim is made.

## Accessibility acceptance pass — 6 October 2026

Assessed committed implementation `505a8a2` in the clean managed promo worktree. This pass changes evidence only; no product implementation or acceptance claim for unavailable surfaces.

| Check                                       | Direct evidence                                                                                                                                                                             | Result                                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Sequential keyboard controls                | Tab from Fresh snapshot reaches Stale snapshot, overview SVG, Range start, Range end, Zoom in, then Reset view; disabled Zoom out is skipped                                                | Observed in Codex in-app Chromium                                                    |
| Event browser keyboard order                | Enter expands Browse events; eight successive Tab actions reach before, missing, config, deploy, note, gap, boundary, after                                                                 | Observed; each button exposes ID, label, kind and exact UTC in its accessible name   |
| Selection focus                             | Enter on event-note retains that button as active element, now labelled Selected event; polite DOM text contains exact ID/time/label                                                        | Observed DOM focus/content; no speech claim                                          |
| Centre focus and viewport                   | On a zoomed view, Enter centres event-gap at72s: view42.250–101.750s; Centre event remains active with visible outline                                                                      | Observed; [screenshot](../../assets/2026-10-06-signal-keyboard-centre.png)           |
| Clear focus                                 | Tab from Centre reaches Clear; Enter removes selected detail and leaves activeElement BODY; reproduced twice                                                                                | Observed at6d2a297; corrected in the follow-up below                                 |
| Continuation after clear                    | Next Tab reaches Browse events summary; disclosure stays open                                                                                                                               | No keyboard trap or restart at the top was observed                                  |
| Native Firefox semantics                    | Existing localhost Signal tab exposes heading/provenance/event-browser summary via macOS accessibility tree; decorative lane contributes no record targets                                  | Observed accessibility tree, not screen-reader utterances                            |
| VoiceOver speech                            | Settings initially Off; temporarily enabled for this approved check. Caption panel already enabled in Utility. VoiceOver output-surface acquisition timed out without observable utterances | Not qualified; setting restored to Off and verified                                  |
| Physical touch and independent capture loss | Available inventory includes desktop browsers and Simulator, with no physical-device interaction surface exposed for this session                                                           | Not performed; Simulator or injected events would not close the physical-device gate |

[Recorded keyboard focus trace](../../assets/2026-10-06-signal-keyboard-acceptance.json) captures actual DOM-backed observations. Pointer focus and full screen-reader reading order are not inferred from Tab order. The native tool could inspect VoiceOver settings, but could not acquire the reader output; an enabled switch and page accessibility text cannot prove spoken live-region delivery. [Apple documents the caption panel as an output of spoken text](https://support.apple.com/en-kw/guide/voiceover/unac078/mac).

Important finding at6d2a297 (corrected in the follow-up below): **Clear event removes its own focused button**, so the user momentarily has no focused control or visible focus indicator. The following Tab naturally reaches the existing disclosure, so this is not a keyboard trap. Reproduce: expand Browse events, select an event with Enter, focus Centre event, Tab to Clear event, press Enter, inspect focus. Recommend explicit Foldkit-native focus recovery to a stable event-browser target, with a real DOM focus regression and native requalification. No external state or direct view-time DOM mutation should be introduced.

Overall acceptance remains **partial**. Keyboard selection, centring, accessible event names and continuation were observed; the observed clear-action focus gap is corrected in the follow-up below. Actual spoken announcements, screen-reader reading order, physical touch and independent capture loss remain open. Large-feed performance and representative-user comprehension are still outside this pass. The Codex review tab was reloaded to the default Light/Fresh/full-view state with no event/interval/baseline selection. VoiceOver's original Off state was restored; no caption preference was changed.

### Manual acceptance handoff

Record the physical device, OS, browser and screen-reader versions, test date and observer. Test the same Signal desk URL and revision; record actual results rather than treating this checklist as a pass.

1. With VoiceOver active and its caption panel visible, expand Browse events and select event-gap. Listen for the exact ID, UTC and label; compare actual speech with captions. Select a coincident config/deploy record separately and confirm identities stay distinct.
2. Pan/zoom, resize and change observation freshness without changing the selected event. Check for unintended repeated event announcements. Clear the event and listen for “No event selected”; record where keyboard and screen-reader cursors actually land. The original keyboard focus gap is corrected below; screen-reader cursor placement still needs direct observation.
3. Navigate the event detail, independent event provenance, centre/clear controls and all eight records using the reader. Confirm useful order, names, states and offscreen/out-of-bounds explanations. Tab order alone does not prove this.
4. On a physical touchscreen, check selection/centring and chart gestures, including ordinary page scrolling outside the chart. Test light/dark readability at the actual viewport; desktop resizing or Simulator screenshots do not establish physical touch behaviour.
5. Start a real pan/brush, interrupt it through a genuine platform cancellation/capture-loss path, and compare committed viewport/interval/baseline/event state before and after. Record which native cancellation actually occurred; merely switching apps without observing cancellation is not proof. Confirm subsequent input cannot commit the abandoned gesture.
6. Restore the user's prior accessibility settings and leave the Signal review state predictable. Attach observations, failures and screenshots; retain any unperformed row as open.

Evidence-only commit qualification: fresh `bun run check` and `bun typecheck` exit0; sequential `bun run test` passes551 tests with1 existing skip and0 failures. Logs are local at `/tmp/signal-acceptance-{check,types,tests}.log`. No product files or dependencies changed in this acceptance pass.

## Clear-event focus recovery — 6 October 2026

Approved bounded follow-up to the acceptance finding at6d2a297. Removing the conditional selected-event article also removed its focused Clear button. Clear now returns one `FocusEventBrowser` Command only when it actually changes the Model. The Command uses public `foldkit/dom` focus on the stable Browse events summary; Foldkit waits for the render commit before focusing. `CompletedEventBrowserFocus` is an inert completion fact. A missing target after dataset replacement is handled without crashing. The native disclosure remains user-controlled; focus does not open/close it. No external store, ref, view-time DOM mutation, new runtime dependency or public Viz API was added.

The two new regressions failed before correction: the actual patcher harness retained BODY focus, and a real selected-event clear scheduled no focus command. They now pass with the existing event tests:17 state/view tests,162 Bun assertions. The isolated real-DOM harness runs returned Command effects and checks focus with both open/closed disclosures, unchanged announcement identity, inert completion, repeated-empty no-op and a removed target. State coverage also checks unselected/unavailable/invalid/Empty models schedule no focus. Existing rollback and evidence-preservation tests remain in the full suite.

One fresh focused read-only reviewer inspected the tracked diff and new command against6d2a297. No Critical, Important or Minor finding was reported. The reviewer confirmed installed Foldkit runtime marks a render pending before launching commands and the public focus helper waits for that commit. Its evidence limit is recorded: the isolated harness patches manually before running effects; full dispatch/render sequencing is separately exercised by the live browser checks below. No second reviewer was requested.

Reviewer boundaries and rulings:

- Actual spoken announcements, physical touch and independent capture loss remain unqualified; this keyboard bug fix cannot establish them. Cost if wrong: residual platform/assistive-technology defects remain possible.
- Native/platform acceptance comes from direct checks below, not review or host tests. Broader chart qualification is outside this bounded change; the full suite checks regressions and native evidence checks selected independent state. Cost if wrong: untested platform/chart conditions remain possible.
- Multi-instance focus targeting is outside this private single-page example; the route mounts one Signal desk and its existing chart/input IDs are already specific to that composition. Cost if multiple instances are introduced later: the selector must gain instance scoping. No multi-instance acceptance is claimed.

Live Codex browser keyboard checks at4321: with Browse events open, selecting and clearing event-gap focuses its summary; the next Tab reaches the first event button. With the browser closed, selecting event-note then closing/clearing likewise focuses the summary while it stays closed. The polite region says “No event selected”. A zoomed view with captured signal-030 and pinned signal-031 retains its complete comparison readout and viewport on Clear; focus visibly returns to the open summary. [Focus recovery screenshot](../../assets/2026-10-06-signal-focus-recovered.png). These actions run through the actual Foldkit runtime rather than manually patching VNodes.

Fresh required qualification: `bun run check` and `bun typecheck` exit0; full sequential workspace suite **553 pass,1 existing skip,0 fail** (74Astro,211Viz,150promo,118web). Logs: `/tmp/signal-focus-{baseline-types,baseline-check,red,dom-red,green,check,types,tests}.log`. Actual screen-reader cursor/speech, physical touch and independent capture loss still require the manual acceptance handoff above. Recommended next: perform that human/device acceptance against this focus fix before adding replay complexity.

Post-build Pages verification passes290 assertions over10 generated routes. Working Signal sources now expose18 actual files, including `command.ts`. After restarting4321, a fresh Dark-mode selection/clear again focuses the open summary; the settled screenshot shows the visible focus outline. Light/Fresh/full view with empty event/interval/baseline and closed disclosures was restored. No VoiceOver settings changed in this follow-up. Pages logs: `/tmp/signal-focus-pages-{build,test}.log`.
