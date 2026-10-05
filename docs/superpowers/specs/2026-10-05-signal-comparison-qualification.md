# Signal comparison qualification

Date: 2026-10-05. Local branch: `codex/foldkit-0-166-0`. Approved feature baseline: `7b5db30`. No push, publication, version bump or deployment is included.

## Delivered contracts

Pure `errorBarGeometry` returns readonly numeric stems and caps for either axis, preserves datum identity/order and rejects invalid or overflowing coordinates. Root and exact `chart/errorBars` exports were exercised by packed Bun, Node and strict TypeScript consumers without optional framework peers. Bounds remain caller-supplied metadata; no statistical inference is performed.

The native Foldkit model owns a separate captured baseline with copied readings, nested bounds and source snapshot. Capture/clear first roll back provisional gestures; late pointer facts cannot commit that obsolete gesture. Inspection, viewport and selection remain independent. Dataset replacement always clears the baseline, including reused revisions and IDs.

Comparison preserves exact current-minus-baseline arithmetic, ms/percentage-point units, quality, support zero, methods, bounds and captured provenance. Missing/Invalid and absent inspection remain explicitly unavailable. Selected error bars, baseline time/value references and HTML disclosures compose with existing clips, bands, domains and quality lanes. The route discloses all 13 actual application source files.

Task commits: `2915d08` geometry; `273a871` capture state; `7438bd0` derivation. Composition and this evidence are committed together after qualification.

## Automated evidence

Each task observed RED before implementation and GREEN afterwards. Geometry: 6 tests; packed consumers: 5 tests. Baseline state plus existing input/state regressions: 20 tests. Derivation plus geometry/state/input: 24 tests.

Final Signal checks: 53 passing tests, 456 assertions across 10 files. Root `bun run check` and `bun typecheck` exited zero. Sequential `bun run test`: **520 pass, 1 skip, 0 fail** (Astro 74, Viz 211, promo 117, web 118). Pages-base production build generated 10 routes; Pages regression passed with 290 assertions. These prove host contracts and production output, not native device or assistive-technology acceptance.

Session logs: `/tmp/comparison-all-signal.log`, `/tmp/comparison-task4-check.log`, `/tmp/comparison-task4-types.log`, `/tmp/comparison-task4-tests.log`, `/tmp/comparison-pages-build.log`, `/tmp/comparison-pages-test.log`. Logs are local session evidence, not committed dependencies. Review server restarted from apps/promo at `http://127.0.0.1:4321` after production qualification.

## Direct native observations

Firefox Developer Edition on macOS, desktop 1909×1050, dark theme: hydrated Capture/Clear disabled with no inspection; keyboard inspected signal035; pin/capture retained inspection and captured 100 ms, bounds 92–108 and support 0. Resume and keyboard inspection of signal040 showed current 0 ms/0%, retained baseline 100 ms/0.2%, and exact differences −100 ms/−0.2 percentage points.

Fresh→Stale changed current provenance while the captured source stayed Fresh at capture. Missing signal010 latency and Invalid signal022 errors displayed unavailability and retained diagnostics. Replace explicitly captured signal022 with Stale provenance; Clear removed baseline marks/references without changing inspection. Recapture signal035 restored Fresh provenance. Range selection 20–60 retained it, temporary absent current inspection was explicit, and keyboard inspection of signal040 restored comparison. Desktop cards, sources, bounds and deltas remained readable without overlap in the observed viewport.

## Open native gates

This run did not complete off-screen pan, 390/1280 layout and light-theme checks, table/source inspection or a new contextual screenshot. The browser foreground changed to another active task during the native pass; further interaction stopped to preserve that activity. Earlier M2 layout observations are historical and do not qualify the added comparison panel.

Held-pointer capture/clear, native Escape/lost capture, hardware touch/outside-plot scrolling, actual screen-reader announcements and representative-user comprehension remain unperformed. The native API exposes completed drags, not independently held pointer phases; connected DOM browser inventory was empty. Host rollback/render tests do not close these gates. No critical-system suitability or complete P2/P3/visx parity claim is made.

## Implementation rulings

- Named pure-helper lint scope extends only to baseline.ts: synchronous validated copying, not Effect handling. Cost if wrong: exceptions in that named helper.
- Named pure-helper scope extends only to comparison.ts: synchronous arithmetic/projection. Cost if wrong: exceptions in that named helper.
- Comparison promises reading content rather than object identity: Foldkit schema constructors copy nested records; only pure geometry promises datum identity. Cost: comparison readings may have different references, with exact data retained.
- Named pure-render scope extends only to comparison-view.ts. Cost if wrong: existing renderer exceptions in that named file.
- Fresh review uses the whole approved feature range from 7b5db30 rather than earlier, already reviewed branch work. Cost if wrong: unrelated historical changes are outside this review.
- Native acceptance stays partial where the surface was unavailable or changed to other user activity. Cost: those native paths remain unqualified despite passing host regressions.

## Independent review

Pending the single fresh whole-feature review required by the execution plan. Material findings will be reproduced and fixed RED→GREEN before final completion; deferred polish and rulings will be recorded here.

## Remaining scope

P2 error-bar geometry and P3 captured comparison are delivered locally. Wider axis/unit/time edge qualification, interaction acceptance and the other precision goals remain partial. Existing fixture decimal-authoring polish remains deferred; arbitrary caller values are never rounded. Next recommended bounded work: finish comparison-specific native layout and interaction qualification, then consider fixture-only decimal authoring.
