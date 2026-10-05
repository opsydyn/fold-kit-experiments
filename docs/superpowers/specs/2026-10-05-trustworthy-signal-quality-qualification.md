# Trustworthy signal quality — M2 qualification

Date: 2026-10-05. Implementation baseline: `a9a3029`. Existing managed promo worktree, native execution. This records engineering evidence for an illustrative static source, not publication, representative-user comprehension or critical-system suitability.

## Delivered contracts

Pure `contiguousRuns` and `intervalBandGeometry` exports preserve caller records and supplied bounds; all X coordinates are finite and strictly increasing, excluded records break runs, and the caller owns quality/time adjacency. Bands use the existing linear area primitive with separately retained endpoint geometry, including singleton/equal intervals. Root and exact subpath consumers are exercised under Bun, Node and strict TypeScript without optional framework peers.

The Signal desk owns metric-specific Observed/Estimated/Missing/Invalid readings, caller-labelled intervals/support, source revision/asOf/updatedAt/cutoff and reference styles. Schema and semantic validation reject malformed metadata, unusable times, duplicate identities/times, invalid values/bounds/support and invalid references. Freshness is explicit source state; controls select supplied snapshots without reading the wall clock. Dataset replacement reinitialises selection/inspection/gestures.

The 115-record fixture preserves the original 120-record regression fixture separately. Missing latency records10–14, invalid errors22, estimated30–39, support0 at35, observed0 at40 and omitted70–74 are distinct. Full-data Y domains include centres, intervals and references. Full runs retain viewport neighbours and are clipped without fabricating records or bridging quality/time gaps. Missing/Invalid/gap lanes lie outside measured Y space. Solid/dashed/hollow/text cues accompany colour. Complete reference meanings appear in keyed adjacent lists. Exact inspector/table/current-state source and ten actual application source disclosures preserve supplied quality/bounds/support and source metadata.

## Automated and native evidence

- Root `bun run check`: zero lint errors/warnings and format check passed.
- Root `bun typecheck`: zero errors/warnings.
- Root `bun run test`: 493 pass, one environment-gated skip, zero failures. Breakdown: Astro integration74, Viz205, promo96, web118.
- Pages-base `PROMO_BASE_PATH=/fold-kit-experiments/ bun run --filter @opsydyn/promo build`: ten routes. Explicit `PROMO_BASE_PATH=/fold-kit-experiments/ bun test apps/promo/test/pages-build.test.ts`: one pass,290 assertions.
- Render tests exercise quality reasons, interval endpoints/support0/null, source freshness,115 raw rows, clipped cursor/marks, all-invalid/zero/singleton and shared-location/long reference labels. A RED regression caught the undefined theme variable in hollow estimated marks; the actual `--surface` variable now passes.

## Direct native observations

The locked Mac initially blocked CUA; after unlock, the in-app browser remained unavailable. Native Firefox Developer Edition supplied the QA surface. Its Responsive Design Mode was exercised at1280×1000 and390×1000 in light/dark mode. The pre-existing DPR2 and custom mobile user agent were retained; this is desktop Firefox responsive evidence, not an iPhone browser claim.

Keyboard Home/Right traversed actual records, including `signal-010` Missing latency (errors0.2%), `signal-022` invalid errors with rawNaN/reason (latency86ms), estimated `signal-035` (100ms, supplied92–108ms, support0; errors0.2% and supplied0.1–0.30000000000000004%), and observed `signal-040` with two exact zeroes. These matched the native raw table's identities, UTC times, quality and supplied intervals/support. The table retains115 actual rows and skips signal-070–074; adjacent rows069/075 reflect the6000ms gap.

Native range sliders selected records20–60, displaying `22:13:40.000Z`–`22:14:20.000Z` in both details while overview retained the full extent. A detail mouse drag moved the viewport to `22:13:55.325Z`–`22:14:35.325Z`; pin35 remained exact and displayed outside-current-view. The interval clipped cleanly through the estimated run boundary and the gaps remained open. Selection remained20–60. Resize390 retained that state and reduced tick density; labels and reference text wrapped. Native scrolling outside the data plot moved the page.

Fresh→Stale retained pinned35 and changed revision/asOf/cutoff text. After the review correction, the inspector's own native accessibility subtree includes `Source: Stale`, revision and exact snapshot times/cutoff; the pin and interval readout remain unchanged. ARIA live-region markup is tested; screen-reader announcements were not heard or qualified.

Narrow light layout revealed that the planned quality-lane position collided with the UTC title. A real-render RED regression measured5px baseline separation; moving the lane start from42px to26px preserves plot/frame extents and separates those labels. Native desktop dark rendering confirms distinct lane marks and axis title. After the final restart, the corrected lane was rechecked at1280 and390px; its marks sit above the UTC title. A contextual [final native dark screenshot](../../assets/2026-10-05-signal-quality.png) records the source-aware inspector, support0 and plotted intervals/gaps. Original responsive353×667 dimensions and enabled touch simulation were restored, then Responsive Design Mode was closed. The native browser remains on the Signal desk with pin35; dev server remains at `http://127.0.0.1:4321` (pid60643).

## Independent review

One fresh read-only reviewer assessed `a9a3029..aff1519`, independently passing32 focused tests/261 assertions. No Critical findings. Both Important findings were reproduced RED and fixed GREEN: finite projected band coordinates can overflow existing area serialization (now explicit RangeError); the inspector omitted source identity/freshness (now present in its own live-region subtree). The inherited tiny-domain slope overflow was regraded Important because newly accepted quality readings must render; D3's normalise-before-interpolate evaluation is used when a precomputed slope overflows. Tests retain raw values down to Number.MIN_VALUE and finite relative projection.

Deferred Minor: the illustrative errors interval fixture exposes binary±0.1 tails. Exact caller values remain unquantised; fixture-only decimal authoring is recommended separately.

All declined-to-judge boundaries received executor rulings: native reviewer acceptance is not inferred (executor observations above are separate); published site/package, representative comprehension, statistical validity, transport/alarms/operational suitability and the listed deferred chart features remain outside this scope. The inherited tiny-domain crash was fixed rather than deferred.

## Limits

Held-pan Fresh/Stale, native Escape/lost-capture rollback and multi-touch/outside-plot touch scrolling were not exercised for M2: the in-app browser/CDP surface was unavailable, and the fallback native app API exposes complete drags rather than controllable held-pointer sequences. State/input regressions cover those transitions but do not replace native evidence. Hardware touch and screen-reader task/announcement acceptance remain unperformed. Native mouse pan, keyboard/ranges, resize, themes and ordinary page scrolling are observed above. This is partial native qualification, not completion of every planned input gate.

This closes only partial P1, interval-band P2 and unit/domain/reference portions of P3/F5. Error bars, pinned comparison baselines, generic crossing-aware segmentation and the remaining visx families remain outside M2. Representative-user comprehension, hardware touch acceptance, live transports, alarms, publication and broad critical-system suitability are unperformed.

## Execution rulings

- Extend the existing pure-render lint scope to named quality/schema/fixture/view helpers: these synchronously validate and render data, rather than run Effect state handlers. Cost if wrong: broader lint exceptions only in those named files.
- Use tolerance for mathematical 180ms plus10% display headroom: IEEE arithmetic produces198.00000000000003. Cost: sub-ULP display-domain variation; raw readings are never rounded.

- Regrade and repair inherited tiny-domain slope overflow: newly validated props accept those readings, so inheritance does not justify a render crash. Cost: only non-finite-slope evaluation order changes; ordinary finite slopes remain unchanged.
- Move quality-lane start42px→26px after native title overlap: cost is lane spacing only; data plot/frame extents stay unchanged.
