# Controlled signal exploration — M1 qualification

Date: 2026-10-05. Implementation baseline: `332d08d`. Local managed promo worktree, native execution. This is engineering and browser evidence; publication, deployment, representative-user comprehension and hardware touch acceptance are separate.

## Delivered contracts

Pure root and subpath exports: `clientToLocal`, `constrainDomain`, `zoomDomain`, `panDomain`, `nearestByX`. Numeric inputs are finite; domains remain increasing and bounded; singular/unrepresentable inverse transforms return null; invalid numeric inputs throw RangeError. Inspection retains original records and deterministic key ties, including overflow-prone finite coordinates. Packed Bun/Node and TypeScript consumers exercise these contracts without optional peers.

The optional `chartFrame.onMount` attaches the caller's typed Mount action to the actual SVG. Legacy markup remains unchanged. A scoped stream reads fresh screen matrices, owns capture/listeners/ResizeObserver, and emits six declared input fact types. The parent Foldkit Model owns selection, viewport, inspection and gesture policy. No DOM references enter Model.

The Signal desk composes an overview, latency/errors detail charts, native controls, exact-value inspector, all 120 raw records, current controlled-state source and seven actual application source files. Caller fractional percentages retain their precision in the inspector/table; axis labels format tick values. Full-data Y domains include zero and 10% headroom; all-zero data gets a usable display extent. Narrow time ticks reserve room for complete UTC labels.

## Automated evidence

- Numeric reference/validation/round-trip tests: coordinates, viewport, inspection. Ordinary tolerance `1e-10 * max(1, abs(expected))`; epoch round trip below `1e-3`ms.
- Pure state tests: brush threshold/preview/release, tap, pan from starting domain, cancellation, foreign and late pointers, second-pointer cancellation, resize, native range indices, pin/outside-view behaviour, keyboard, empty/invalid/singleton/short extents and stable IDs.
- Real Foldkit render tests: labelled SVGs, gesture surfaces, raw records/units, source, notices, no fabricated outside-view cursor and fractional caller precision.
- Instrumented browser-boundary tests: fresh affine matrices, null/singular/hidden recovery, capture failures, cancellation facts, scoped listeners/observer teardown, no post-close messages, release on unmount. These are host tests, not hardware/browser touch evidence.
- External packed consumers: Bun, Node, strict TypeScript, typed optional frame Mount; pure consumers do not install Foldkit/Effect.
- Required root lint/format and typecheck passed with zero warnings/errors; the full suite passed 467 tests with one environment-gated Pages test skipped.
- Pages-base build `/fold-kit-experiments/`: ten routes, including `examples/signals/index.html`; artifact links/islands resolve within the base. Publication is unperformed.

## Direct browser observations

At 1280 and 390 CSS pixels, light/dark layouts were inspected in the Codex in-app browser. Narrow content width stayed 390 pixels, with retained controlled state and focused latency SVG through resize. An initial crowded overview time axis was reproduced RED then fixed GREEN by adapting tick density.

A native mouse drag near observations 20–60 committed the continuous interval `22:13:39.947Z`–`22:14:19.955Z`; sample-index controls correctly reported records 20–59 within that interval. Both details shared X and retained independent Y domains. Direct inspection of `signal-042` agreed across charts/readout/raw row/source: `2023-11-14T22:14:02.000Z`, latency 81ms, errors 0.4%.

Pinning followed by pan outside the viewport retained the exact record and displayed “outside current view”, with zero cursor elements. Home/Right moved the pinned key explicitly; End/Left stepped visible records. Zoom/clear/reset kept their declared independent selection/view policies. Held pan plus native Escape restored the starting viewport. Actual native pointer capture was observed; releasing it through a browser fixture caused rollback.

A temporary `scale(0.85) rotate(3deg)` SVG fixture hit `signal-042` through its real screen matrix. Hiding/restoring the SVG changed unavailable/ready status while retaining domain state and inspection. Gallery navigation and a fresh route mount restored usable input. Temporary transform/display/touch-emulation fixtures were removed; viewport override is reset for handoff.

A contextual [desktop light screenshot](../../assets/2026-10-05-signal-desk.jpg) records the linked interval, exact inspector, detail charts and source disclosures.

## Limits and remaining gates

Native touch delivery is **unperformed**: this browser reports `Input.dispatchTouchEvent` unsupported. Single-touch brush/pan, second-touch cancellation and outside-plot touch scrolling therefore remain hardware/browser acceptance gates. Pure second-pointer and cancellation tests do not close them. Native mouse scrolling outside the plot was observed.

Rectangle/key brushes, resize handles, pinch/wheel zoom, measured HTML tooltip placement, general multi-series registry, quality/uncertainty and downsampling remain outside this slice. No complete F1–F3 or visx parity claim is made. Representative-user comprehension and critical-system suitability are untested.

Independent whole-change review: pending at the first explorer commit; final result and any material regression fixes are recorded below before completion.

## Final verification

Root `bun run check` and `bun typecheck`: pass, zero errors/warnings. Root `bun run test`: 467 pass, one environment-gated skip, zero failures. Breakdown: Astro integration 74, Viz 197, promo 78, web 118. Pages-base build: ten pages; explicit `PROMO_BASE_PATH=/fold-kit-experiments/ bun test apps/promo/test/pages-build.test.ts`: one pass, 290 assertions. Native touch remains unperformed as stated above.
