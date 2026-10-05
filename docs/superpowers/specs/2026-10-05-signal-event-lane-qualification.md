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
