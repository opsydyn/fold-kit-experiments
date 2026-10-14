# Earthquake Globe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking. Execution requires plan review and an explicitly chosen method; this document launches no worker.

**Goal:** Build an accessible, rotatable FoldKit SVG globe of one recorded earthquake snapshot, without new dependencies.

**Architecture:** Viz supplies an additive pure spherical projection and open-line clipping module. The consuming FoldKit app owns immutable observations, view state, selection and display policy. Astro embeds the app using the existing integration, not a new renderer or runtime.

**Tech Stack:** Existing FoldKit 0.167.0, Effect 4.0.0, Astro 7.2.8, TypeScript, Bun, Vitest, Playwright, oxlint and oxfmt.

**Spec:** [Approved design](../specs/2026-10-14-earthquake-globe-design.md). Written scope approved in the conversation on 2026-10-14; execution is not yet approved.

## Global Constraints

- No new dependencies, Three.js, D3 runtime, WebGL, canvas renderer, automatic rotation, live fetching, animation loop, persistence, filtering, connection arcs, promo/export integration, package version bump or publication in this slice.
- One `/earthquake-globe` reference page linked from the existing chart gallery.
- One bundled, immutable USGS M2.5+ past-seven-days GeoJSON snapshot; capture actual bytes once during implementation with source URL, capture time, feed generation time, original count and SHA-256.
- Sphere silhouette, front-hemisphere graticule and event markers; country polygons/coastlines deferred.
- Start at longitude 180, latitude 0, zoom 1; normalise longitude to [-180, 180), clamp latitude to [-90, 90].
- Zoom factor 1.25 in [1, 2]; turns of 15 degrees; reset clears gesture and selection.
- Magnitude display domain [-1, 8], radius [3, 10] SVG units, linear/clamped; depth colour domain [0, 700] km. Preserve raw measurements, including negative values; unknown is not zero.
- Do not change existing `geoOrthographic`, `geoPath` or `ProjectionObject` behaviour. Expose only the new `/shape/globe` subpath, not extra root exports.
- No unfiltered root `bun test`, no ambient model trial, no push, installation or publication. Scoped existing test commands are permitted during approved execution.

## Review Focus

Five additional failure modes to pin in the owning tasks, not speculative extra features:

1. Two pointers overlap: only the pointer that began the drag can move/end it (Task 3).
2. A drag ends over a marker: the generated click must not change selection (Tasks 3-4).
3. Front/back crossings near the dateline: preserve separate visible segments rather than draw a false chord (Task 1).
4. Optional values or URLs are malformed: preserve unknown measurements and never render an unsafe external link (Task 2).
5. Mobile resizing and route re-entry: drag sensitivity uses current rendered size, listeners are disposed, and the returning app starts in its initial state (Tasks 3-4).

## Execution Gates And File Ownership

Before product code, recheck branch/HEAD/status against the inspected `main` baseline `bf87c0a`. Do not revert intervening work. Run `bun typecheck` and `bun run check`; if unrelated failures exist, report them and agree on a scoped qualification boundary instead of silently fixing them. Read the independent Viz skill; consult the Astro integration skill for the page embedding, not an integration redesign.

The approved spec already records the architecture decision, decision-challenge verdict `proceed`, and boundary verdict `safe with noted risk`. This plan refines that same additive boundary; it does not introduce another approval protocol or ADR folder. Pause for a design amendment if correctness needs general polygon clipping, runtime dependencies or modifications to existing projection semantics.

Tasks run in order. Each owns a meaningful deliverable and red/green test cycle. Keep commits scoped to completed task files after applicable checks, preserving unrelated changes. No commit or push is made by this planning step.

| Owner            | Create                                                                                                                                                   | Modify                                                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Geometry         | `packages/foldkit-viz/src/shape/globe.ts`, `test/globe.test.ts`                                                                                          | Viz `package.json`, `tsdown.config.ts`, `README.md`, `D3-PROVENANCE.md`, `THIRD-PARTY-NOTICES.md`, `test/package-import-smoke.test.ts` |
| Data             | `apps/web/src/apps/earthquake-globe/data.ts`, `data.test.ts`, `fixtures/usgs-week.geojson`, `fixtures/provenance.json`                                   | None                                                                                                                                   |
| State/lifecycle  | App `model.ts`, `message.ts`, `update.ts`, `update.test.ts`, `mount.ts`, `mount.test.ts`                                                                 | None                                                                                                                                   |
| View/integration | App `view.ts`, `view.test.ts`, `globe.css.ts`, `app.ts`, `main.ts`; `apps/web/src/pages/earthquake-globe.astro`; `apps/web/e2e/earthquake-globe.spec.ts` | `apps/web/src/pages/charts.astro`                                                                                                      |

Paths under `test/` in the geometry row are relative to `packages/foldkit-viz/`; app filenames are relative to `apps/web/src/apps/earthquake-globe/`. Restore ignored D3 references under `d3-main/d3-geo/`, not in an application import path.

### Task 1: Pure Globe Geometry And Consumer Contract

**Interfaces:** Import existing `GeoCoord` from `./geo` (`readonly [longitude, latitude]`, degrees). Produce these exports from `/shape/globe`:

```ts
type GlobeView = Readonly<{
  center: GeoCoord;
  radius: number;
  translate: readonly [number, number];
}>;
type GlobePoint = Readonly<{ x: number; y: number; facing: number; visible: boolean }>;
const GLOBE_EPSILON: number; // 1e-9, dimensionless unit-sphere tolerance
function projectGlobePoint(coordinate: GeoCoord, view: GlobeView): GlobePoint;
function clipGlobeLine(
  coordinates: ReadonlyArray<GeoCoord>,
  view: GlobeView,
): ReadonlyArray<ReadonlyArray<readonly [number, number]>>;
```

`facing` is the rotated unit-sphere front component, not earthquake depth. Visible means `facing >= -GLOBE_EPSILON`. Validate finite coordinates/translation/centre, latitude bounds, and positive finite radius; reject invalid configuration with `RangeError`. Longitude is periodic; app observations still enforce their narrower geographic input bounds. Output must remain finite; reject arithmetic overflow rather than return invalid SVG values.

Clipping consumes open polylines whose edges are minor great-circle arcs. Empty/singleton input yields no drawable segments; consecutive duplicates do not produce NaN. Reject ambiguous antipodal edges with `RangeError`. Insert limb intersections, emit only segments with at least two distinct projected points, and split across invisible runs. This is not a general GeoJSON stream or polygon API.

- [x] **Pin the reference before porting.** Retrieve the official `d3/d3-geo` rotation, orthographic and circle-clipping sources and their transitive math helpers at one immutable commit, with the corresponding upstream licence. Retain ignored local source under `d3-main/d3-geo/`; record URLs, hash, mapping and preserved notices in existing provenance files. A source/licence retrieval failure stops this task; never guess a commit or licence. Do not install or import D3 at runtime.
- [x] **Write independent projection witnesses in `test/globe.test.ts`.** With view `{center:[0,0],radius:100,translate:[200,200]}`: `[0,0]` gives `(200,200)`, facing 1/visible; `[30,0]` gives `(250,200)`; `[0,30]` gives `(200,150)`; `[180,0]` is hidden although its projected x/y overlaps the centre. At centre `[90,30]`, that same coordinate projects to the centre. Add pole/dateline, near-horizon, invalid/overflow, periodic-longitude and frozen-input cases. Reconstruct geographic vectors using an independent inverse basis in the test to check rotation round trips, without adding an unused inverse public API.
- [x] **Run red.** `bun test test/globe.test.ts` from `packages/foldkit-viz`. Expected failure: the missing module/export, not a setup error. After the export exists, retain the backside witness and demonstrate that substituting the current unclipped orthographic result fails it.
- [x] **Implement point projection and spherical clipping.** Adapt the pinned reference in `src/shape/globe.ts`; no framework/Effect imports. Test equatorial `[[80,0],[100,0]]`: visible endpoint x approximately 298.4807753, exit at x 300/y 200 for the above view. Test `[[80,0],[120,0],[-120,0],[-80,0]]` produces two visible runs, not one connecting chord. Add exact-horizon, all-hidden, duplicate and antipodal cases using analytic expected endpoints, not production-derived assertions.
- [x] **Add the subpath with build and import tests.** Add matching `exports`, `typesVersions` and tsdown entry for `shape/globe`. Extend the existing package-import fixture with a typed import and independent backside assertion; run its existing Bun and Node consumer paths without installing a new dependency. Preserve all existing entries and geometry tests. Document degree units, error/visibility policy, open-line limitation and workspace-only availability in Viz README.
- [x] **Verify green and commit this deliverable.** From Viz run `bun test test/globe.test.ts`, `bun run build`, `bun test test/package-import-smoke.test.ts`, `bun run typecheck`; from root run `bun run check`. Expected exit 0, finite consumer output and hidden backside witness. Commit only this task's geometry/export/provenance/test/docs files after checks pass.

### Task 2: Recorded Snapshot And Strict App-Boundary Decoding

**Interfaces:** `data.ts` produces:

```ts
type Earthquake = Readonly<{
  id: string;
  longitude: number;
  latitude: number;
  magnitude: number | null;
  depthKm: number | null;
  timeMs: number;
  place: string | null;
  url: string | null;
}>;
type SnapshotProvenance = Readonly<{
  sourceUrl: string;
  capturedAt: string;
  generatedAtMs: number;
  originalCount: number;
  sha256: string;
}>;
type DecodedSnapshot = Readonly<{
  provenance: SnapshotProvenance;
  events: ReadonlyArray<Earthquake>;
  excluded: Readonly<Record<string, number>>;
  warnings: Readonly<Record<string, number>>;
  window: readonly [number, number] | null;
}>;
type SnapshotResult =
  | Readonly<{ _tag: 'Ready'; snapshot: DecodedSnapshot }>
  | Readonly<{ _tag: 'Failure'; reason: string }>;
function decodeSnapshot(input: unknown, provenance: SnapshotProvenance): SnapshotResult;
function loadBundledSnapshot(): SnapshotResult;
```

Use `window` as the accepted events' min/max time, clearly labelled observed-event span, not a fabricated exact feed boundary. Display the captured feed category separately. Diagnostics use stable reason codes, not raw untrusted payload text. Ready with zero events is valid empty data, not Failure. A malformed FeatureCollection/metadata or repeated valid ID is Failure; malformed individual rows are counted exclusions. Event/generated times must be safe integer epoch milliseconds within the JavaScript Date range; validate the capture timestamp and metadata count against actual feature length. Optional invalid measurements/place/link create warnings and null values. Allow only HTTPS `earthquake.usgs.gov/earthquakes/eventpage/` URLs with no embedded credentials; use `URL`, not prefix matching. Define ties by deterministic code-point ID ordering, not machine locale.

- [x] **Write decoder tests before capture.** In Vitest, a small explicit synthetic FeatureCollection at a fixed time yields `longitude:-122`, `latitude:37`, `depthKm:-1.5`, `magnitude:null` and the original ID, with source inputs deeply frozen. Assert descending time/ID ties, null versus zero, negative magnitude/depth, invalid coordinate/time exclusions (including finite `1e16` and fractional timestamps), non-earthquake exclusions, unsafe/malformed URLs, duplicate-ID Failure, inconsistent metadata and empty Ready. These are decoder fixtures, never substitute chart observations.
- [x] **Run red.** `bun run --filter @opsydyn/web test src/apps/earthquake-globe/data.test.ts`; missing decoder must fail. Implement `decodeSnapshot` with existing Effect Schema/type patterns, preserving raw numbers and separating fatal envelope errors, excluded rows and optional-value warnings. Do not coerce strings or mutate input arrays.
- [x] **Capture once after execution approval.** Fetch `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson` into `fixtures/usgs-week.geojson`, retaining its actual bytes. Save the adjacent provenance record from actual response metadata, capture UTC and SHA-256. Use `.geojson?raw` via the existing Vite/Astro import mechanism; parse locally in `loadBundledSnapshot`, never fetch at app runtime. If retrieval fails, stop; do not replace with invented data or keep retrying without explaining why.
- [x] **Add retained-fixture checks.** Assert the stored byte digest equals provenance, metadata count equals originalCount, generated time matches, decoding succeeds, accepted plus excluded counts equals originalCount, and all accepted IDs are unique. Capture actual cardinalities as fixture-specific assertions after inspecting the response; no expected value is guessed in this plan. Tests remain offline and use no current clock.
- [x] **Verify green and commit this deliverable.** Run the focused Vitest command and root `bun run check`. Expected exit 0; diagnostics counted independently. Commit only decoder, tests, snapshot and provenance.

### Task 3: FoldKit-Owned State And Scoped Pointer Lifecycle

**Interfaces:** `model.ts` exports Schema/value plus TypeScript `Model` using the repository's schema/type-override pattern; `initModel(data: SnapshotResult): Model`; and `init(props: AppInitProps): { model: Model }`, loading the bundled snapshot. `update(model: Model, message: Message): Return<Model, Message>` is pure and synchronous. State:

```ts
type Gesture =
  | Readonly<{ _tag: 'Idle'; ignoreNextMarkerClick: boolean }>
  | Readonly<{
      _tag: 'Dragging';
      pointerId: number;
      startX: number;
      startY: number;
      startCenter: readonly [number, number];
      renderedRadius: number;
      maxDistance: number;
    }>;
type Model = Readonly<{
  data: SnapshotResult;
  center: readonly [number, number];
  zoom: number;
  selectedId: string | null;
  gesture: Gesture;
}>;
```

`message.ts` uses `defineMessageUnion` and exports its inferred `Message` type. Facts: `ClickedZoomIn`, `ClickedZoomOut`, `ClickedReset`, `ClickedTurn({direction:'east'|'west'|'north'|'south'})`, `PressedGlobeKey({key:string})`, `ClickedMarker({id:string,keyboard:boolean})`, `ClickedEventRow({id:string})`, `StartedGlobePointer({pointerId,clientX,clientY,renderedBaseRadius})`, `MovedGlobePointer({pointerId,clientX,clientY})`, `EndedGlobePointer({pointerId})`. All pointer numeric fields are numbers. `mount.ts` exports `GlobePointerMount`, defined through `foldkit/mount`, declaring these three pointer messages.

SVG viewBox is `0 0 600 600`, centre `[300,300]`, base radius 260 units. At pointer start the Mount reads the rendered SVG width and forwards base radius in CSS pixels (`width * 260 / 600`); update multiplies by current zoom and retains that start radius. Do not mix screen, CSS-pixel and SVG-unit deltas. Drag maps full diameter to 180 degrees: centre longitude `startLongitude - dx / radius * 90`, latitude `startLatitude + dy / radius * 90`, then normalize/clamp. This is view-control policy; projection itself remains spherical.

- [x] **Write update tests for exact defaults and outcomes.** Centre initializes `[-180,0]`, zoom 1, no selection, Idle/false. Eight zoom-ins clamp at 2; eight zoom-outs clamp at 1; east then west restores centre modulo 360. A pointer starting at `(0,0)` with radius 100 and moving to `(50,0)` sets longitude 135, not an accumulated 90 after the same move repeats. Pointer 2 cannot start over, move or end pointer 1's drag; invalid/zero size or nonfinite inputs do nothing. Reset clears gesture/selection and restores defaults.
- [x] **Pin selection and click suppression.** With explicit events `front:[180,0]`, `back:[0,0]`, table-select back recentres `[0,0]`; later rotation preserves its details/ID but hides the marker. Unknown IDs do nothing. Record maximum drag displacement; at >=4 CSS pixels, end in Idle with `ignoreNextMarkerClick:true`. The next pointer marker click consumes suppression without selecting; keyboard selection bypasses it, a new drag resets it. Cancellation/leave closes the matching gesture. Assert these sequences, not merely Message construction.
- [x] **Run red, then implement Model/Message/update.** `bun run --filter @opsydyn/web test src/apps/earthquake-globe/update.test.ts`. Use exhaustive `Message.match`, no refs, external store or extra async states. Commands are absent where not produced. Keyboard arrows invoke the same turn logic; `+`/`=` and `-` invoke zoom, `Home` resets. Other keys are ignored.
- [x] **Test and implement the Mount boundary.** Current ordinary chart pointer callbacks do not carry pointer IDs; do not reuse them by guessing identity. The app-local Mount acquires pointerdown/move/up/cancel/leave listeners with Effect `acquireRelease`, reads real `PointerEvent` fields, and forwards declared facts through the existing FoldKit dispatcher/custom-event mechanism. It owns no view state and mutates no chart DOM. Only primary-button down starts a gesture. No global listeners, pointer capture, animation subscription or ResizeObserver is needed: ending on leave and measuring each start are intentional. `mount.test.ts` dispatches two-pointer and resized-element facts, proves cancellation mapping, then disposes the scope and proves no further message emission. Reuse existing scoped Mount/test APIs rather than invent a dispatcher.
- [x] **Verify green and commit this deliverable.** Run both focused app test files, root `bun run check` and `bun typecheck`. Expected exit 0, exact state outcomes and disposed listeners. Commit only state/message/update/Mount and their tests.

### Task 4: Accessible Scene, Route And Browser Qualification

**Interfaces:** `view(model: Model, h: HtmlBuilder<Message>): Document` in `view.ts`. `main.ts` exports `Model`, `Message`, `init`, `update`, `view`; no subscriptions for a static-data app. `app.ts` uses existing `lazyApp(() => import('./main'))`. The Astro page embeds this app with `client:load` and the existing Layout. No integration package or shared renderer edits.

- [x] **Write meaningful Scene/render tests first in `view.test.ts`.** Use Task 3's explicit front/back fixture and `Scene` or existing real render helper. Assert only front markers exist, no hidden focus targets, selected details persist behind the globe, table activation recentres, all SVG numbers/paths are finite, and recorded timestamps/counts appear. Pin empty Ready and Failure content. Assert distinct unknown magnitude/depth styles, raw negative depth in details, validated links only, and marker radius values 3/10 at magnitude -1/8. Run focused Vitest red before view implementation.
- [x] **Implement the unframed responsive scene and controls.** Use `projectGlobePoint`, and `geoGraticule(30)` from existing `/shape/geo`; pass each LineString's existing two-degree samples to `clipGlobeLine`, emitting one SVG path per returned visible run. Never feed graticule geometry through existing unclipped `geoPath`. Keep the fixed square viewBox responsive; use a disk clip for marker edges, not visibility. Draw a visible sphere outline and graticule with theme tokens. Controls are compact arrow/zoom/reset icons with accessible names and tooltips, using the established icon system; do not install an icon package. Arrow controls, focus-visible styling, legends, selected-event details and a complete sorted event table remain usable on mobile. Use existing scale/colour helpers; avoid radius-based energy claims, colour-only selection, instruction panels and floating-card wrappers.
- [x] **Wire keyboard and pointers without duplicate activation.** Mount on the SVG only; buttons/table remain normal DOM controls. Marker click dispatches pointer selection; Enter/Space on a focused marker dispatches keyboard selection and prevents its duplicate default click. Prevent defaults only for handled keys while the root chart control is focused; unrelated keys/page scrolling stay intact. On the SVG interaction surface set touch-action to none; retain ordinary scrolling elsewhere. Visible marks have IDs/accessibility labels, with a keyboard table path for all accepted events. Use the page-scoped clip ID `earthquake-globe-disk`; this slice mounts exactly one globe and does not claim a reusable multi-instance view contract.
- [x] **Add route and gallery link.** Create `earthquake-globe.astro` following `histogram-brush.astro`; add a link in `charts.astro`, not another heavy gallery-mounted app. Do not alter promo, navigation infrastructure, SSR policy or provider endpoints. Add a Scene test activating zoom/reset and table controls through the real view, not only direct update calls.
- [x] **Add and run `e2e/earthquake-globe.spec.ts`.** Use existing desktop 1365x900 and mobile 390x844 Playwright projects. From `apps/web`, run `bun run test:e2e e2e/earthquake-globe.spec.ts`. Verify globe/table hydration, visible changes after pointer drag, two-pointer isolation, zoom limits/reset, marker/table inspection, keyboard focus/default behaviour, light/dark contrast, narrow layout, gallery navigation and route exit/re-entry with defaults restored. Use CDP touch dispatch on the mobile project if required; do not label a mouse replay as touch evidence. Fail on page errors and unexpected external requests: the chart must not request USGS, an atlas or a renderer at runtime.
- [x] **Retain visual evidence.** Save desktop/mobile light/dark screenshots and after-rotation/zoom/selection examples as test artifacts. Check the SVG raster has non-background sphere/graticule/marker pixels and no overlapping controls/text; use existing browser canvas facilities to raster-check the SVG, not a new canvas renderer or image dependency. Assertions on SVG existence alone do not establish a visible globe. Empty/Failure states are exercised with synthetic data in Scene tests; do not add public fixture-switching query parameters just for testing. Record any unavailable browser/touch check as unverified rather than a pass.
- [x] **Run final workspace qualification.** From root, sequentially run `bun run check`, `bun typecheck`, `bun run test`, `bun run --filter @opsydyn/web build`, then the focused browser command. Expected exit 0 for each; stop to investigate regressions. Confirm dependency versions and lockfile are unchanged, existing projections/exports remain compatible, and all modified files fit task ownership. Commit only this task's files after checks; stop before merging, pushing or publishing.

## Completion And Review

Review the complete diff against the spec, package import evidence, retained fixture/provenance, independent test witnesses and browser artifacts. Report result, claim, observed command evidence, remaining uncertainty and next action in a concise receipt. Distinguish pure geometry/Scene tests from browser/touch proof; missing verification prevents an unqualified completion claim.

Recommended execution is **inline/native** because these four tasks share interfaces and one agent can keep the narrow data/geometry/view contract consistent without repeated context transfer. An independent final review is useful but requires explicit reviewer availability and scoped delegation approval; do not silently launch a new model trial. Subagent-driven execution remains an option if the user prefers per-task independent gates and approves that delegation.

Planning evidence: current manifests, chart geometry, pointer callbacks, scoped Mount helpers, colocated Vitest/Scene tests and Playwright configuration were inspected. No snapshot/source capture, product code, model trial, build or behavioural test was performed while writing this plan. The plan requires human review and an execution-method choice before Task 1 begins.

## Execution Receipt: 2026-10-14

- result: complete
- claim: all four implementation tasks and one whole-branch self-review fix pass completed inline on local `feat/earthquake-globe`; nothing merged, pushed or published.
- evidence: `bun run check`, `bun typecheck`, `bun run test`, web production build and focused Playwright all exited 0 after the review fixes. Web: 378 tests passed; globe geometry: 21 passed; browser: 5 passed and one intentional desktop-touch skip. Existing promo built-artifact test remains skipped as in the baseline. Desktop/mobile light/dark, rotation and emulated touch screenshots were inspected; SVG raster checks passed. Snapshot: 377 accepted observations, 266238 original bytes, digest `5d7b1cde84293bc11d87fc194579b206598902b61db24e85c62cccdcec4c73d0`. No dependency versions or lockfile changed; Viz's package manifest changed only its additive export/declaration maps.
- remaining uncertainty: author self-review is not independent review; mobile touch is Chromium emulation, not physical-device or Safari acceptance. No live-feed, coastline/polygon, large-dataset or published-package qualification is claimed.
- next: human inspection and branch review before any integration or publication. Recommendation: needs review.

### Execution Decisions

- Used a feature branch in the existing checkout to preserve main and reuse dependencies, rather than create an unapproved worktree. Cost if unsuitable: relocate this local branch to a separate checkout.
- Pure GeoJSON decoding uses documented file-local exemptions for Effect-only control-flow heuristics; unknown input remains an explicit schema boundary. Cost if unsuitable: style refactoring of the decoder, not relaxed data validation.
- Excluded only original USGS bytes from the active `.oxfmtrc.json` formatter; independent digest tests protect the capture. The initial legacy `.oxfmtignore` attempt was ineffective and removed. Cost: this single upstream file retains its source formatting.
- Synchronous custom events carry pointer facts, and the installed Mount API requires a completion acknowledgment. Pose changes through controls/table end active gestures so stale deltas cannot replace new intent. Cost if unsuitable: local input wiring/gesture policy repair.
- Omitted marker focus targets outside the zoomed SVG viewport while preserving every record in the table. Cost: partially clipped markers need rotation or table recentering to inspect.

The initial browser run was rejected as contaminated by concurrent shared-output builds; serial reruns with console-error assertions supply the accepted evidence. A dark source-link contrast issue and two numeric-boundary bugs (empty view tuples and derived pointer overflow) were reproduced before fixes, then verified green. No unresolved critical/important findings or deferred minor findings were recorded. Host Bun tests reported 1.4.2; the repository's package-manager declaration was not changed, and runtime-version parity is not claimed.
