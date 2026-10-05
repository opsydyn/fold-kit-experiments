# Signal comparison — browser qualification follow-up

Date: 2026-10-05. Product checkout: `68f9f72`, managed worktree, branch `codex/foldkit-0-166-0`. Authorised scope: qualify the existing comparison experience and commit evidence. No product source changes, publication or release.

## Surface and recovery

Directly operated the existing Codex in-app browser at `http://127.0.0.1:4321/examples/signals/`. The user confirmed the page was ready. These are real-browser UI observations using keyboard/locator input and browser mouse input, not synthetic DOM event dispatch or direct model mutation. The browser now exposes held mouse phases and a viewport override; earlier Firefox tooling limitations are historical.

The first load had no chart controls because Astro could not hydrate the built Foldkit client module. Server logs also showed stale optimised Effect module URLs following workspace verification, which rebuilds shared dist outputs. Restarting the existing Astro dev server, reloading and waiting for the actual Capture control restored hydration. This was dev-process recovery; no source patch was necessary. Avoid running shared-dist builds against a live review process without restarting it afterwards.

Original light theme and default viewport were restored. Temporary raw-table/state disclosures were closed. The page remains open with full time extent, no selection, captured signal035, Following signal040 and Fresh current source for review.

## Observed layout matrix

| Viewport  | Theme | Result                                                                                 | Evidence                                                               |
| --------- | ----- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1280×1000 | Light | Two cards and deltas readable; metadata wraps; document width1280                      | [Screenshot](../../assets/2026-10-05-signal-comparison-1280-light.png) |
| 1280×1000 | Dark  | Cards, exact values, sources and plot context readable; document width1280             | [Screenshot](../../assets/2026-10-05-signal-comparison-1280-dark.png)  |
| 390×1000  | Light | Stacked cards and deltas readable; document width390                                   | [Screenshot](../../assets/2026-10-05-signal-comparison-390-light.png)  |
| 390×1000  | Dark  | Controls wrap; stacked metadata and deltas readable while scrolling; document width390 | [Screenshot](../../assets/2026-10-05-signal-comparison-390-dark.png)   |

The dark narrow screenshot shows the first part of the panel; the later scroll observation included current source and both differences. No horizontal document overflow was observed in any of these four presentations. This qualifies this fixture and these viewports, not arbitrary labels, browser engines or physical devices.

## Observation, quality and source agreement

Keyboard Home/Right inspected signal035, captured it, then inspected signal040 independently. Captured latency100ms, supplied92–108 bounds and support0 remained intact; current latency/errors were0. Differences were exactly −100ms and −0.2 percentage points. Same-record capture rendered one comparison bar and two distinct caps in the latency detail.

Opened Raw observations: 116 table rows including its header, therefore115 observations. Rows035/040 matched the cards, UTC timestamps, raw values and quality/bounds/support. Expanded Controlled state/source showed captured035 with its own snapshot, Following040, full viewport and no selection. The disclosure is actual UI evidence; internal runtime state was not accessed.

Keyboard inspection of Missing010 displayed collector-unavailable latency, Comparison unavailable and numeric error difference0. Invalid022 displayed rawNaN and its collector reason, latency difference−14ms and unavailable error comparison. Switching current source to Stale retained Fresh at capture and the original baseline asOf. Current source was returned to Fresh afterwards.

## Off-screen baseline

Selected record range20–60, pinned040 and panned left500 pixels in the detail plot. Viewport changed from `[1700000020000,1700000060000]` to `[1700000039157.0881,1700000079157.0881]`; the committed selection remained20–60. Baseline035 lay outside the viewport. Its HTML notice, exact evidence and horizontal100ms reference persisted; error-bar stemX was−52.50000031738281 in SVG coordinates, outside plotLeft56 and under the existing plot clip. It was neither clamped to the edge nor used to expand the viewport. See [contextual screenshot](../../assets/2026-10-05-signal-comparison-offscreen.png).

## Held gestures and cancellation

Using actual browser mouse-down, move and mouse-up phases, separately exercised Capture/Replace, Clear and Escape during both a detail pan and an overview brush. Button activation used Space while the pointer remained held. Checks waited for rendered UI changes before reading the controlled source.

For pan, the provisional viewport visibly moved. Capture explicitly replaced the baseline with inspected040 and rolled back to the committed viewport first. Clear rolled back and produced None. Escape rolled back. For all cases, subsequent pointer release retained that exact committed viewport and the20–60 selection.

For brush, the provisional SVG rectangle with opacity0.1 was observed. Capture/Clear/Escape removed that preview while the pointer remained held, preserving committed viewport and20–60 selection. Their later releases did not commit the abandoned brush. Captured/None state agreed with the respective action. This directly closes the previously unobserved capture/clear/Escape held-mouse paths in this browser.

## Remaining gates

- Independent loss of pointer capture without pointer-up, Escape or an explicit baseline action was not exercised. Browser cancellation/release paths and host regressions do not establish that separate scenario.
- The in-app browser rejected `Input.dispatchTouchEvent` as unsupported before any touch event was delivered. Hardware touch, second-touch cancellation and outside-plot touch scrolling remain unperformed. Responsive dimensions do not establish touch acceptance.
- Actual screen-reader speech/announcements and representative-user comprehension remain unperformed. Accessible DOM output and polite-live-region markup do not close those gates.
- No deployment, operational certification or complete visx/P2/P3 parity claim follows from this qualification.

## Verification and next work

Before this follow-up's browser checks, the unchanged product checkout passed fresh root typecheck, check and sequential workspace tests: **523pass,1skip,0fail**. Session logs: `/tmp/comparison-native-{types,check,tests}.log`. Qualification documents/assets receive a final root formatting/lint check before commit. No new tests are needed for evidence-only changes. The recovered dev server remains on4321.

Recommended next product slice: write a bounded design for caller-owned event annotations and a shared event lane, linking spikes to deployments/incidents without inventing causal claims. Keep the remaining hardware/assistive-technology gates separate and arrange direct acceptance when those surfaces are available.
