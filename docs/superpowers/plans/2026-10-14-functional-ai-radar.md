# Functional & AI Radar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task, after plan review and execution-method selection. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a usable spherical radar of 32 original functional-programming/AI demo entries without new dependencies.

**Architecture:** One application owns immutable data, virtual layout, filtering, camera and selection. Existing pure Viz sphere helpers project the wireframes/blips; FoldKit owns rendering and scoped input lifetime. No earthquake-app state or new shared/public geometry API is introduced.

**Tech Stack:** Existing FoldKit 0.167.0, Effect 4.0.0, Astro 7.2.8, TypeScript, Vanilla Extract, Vitest/Scene, Playwright and Bun; unchanged manifests/lockfile.

**Spec:** [Approved written design](../specs/2026-10-14-functional-ai-radar-design.md), approved in conversation after local design commit `56bca21`. The user approved this plan for inline execution; local implementation/verification commits are authorised, not push or publication.

## Global Constraints

- One `/functional-ai-radar` reference app with the spec's exact 32-entry roster, eight per category; placements are illustrative, not adoption advice.
- Techniques, Tools, Platforms, Languages & Frameworks; Adopt, Trial, Assess, Caution. No numeric suitability score or geographic meaning.
- `600x600` SVG; outer base radius 260; shell fractions 0.4/0.6/0.8/1.0; default centre `[0,20]`, zoom 1; zoom factors 1.25 within [1,2]; turns of 15 degrees.
- Full-data ID order controls display numbers and category slots. Filtering/input reordering never repacks; no runtime randomness.
- Original descriptions and checked first-party HTTPS sources. No copied Thoughtworks data, prose, artwork or recommendations; no runtime network load.
- No Three.js, D3 runtime, new dependencies, public exports, generic renderer, editor, persistence, AI service, automatic spin, inertia, version bump, push or publication.
- Existing globe, CI, deployment, linter/formatter and release-normalization behavior stay untouched. Live normalization qualification remains pending the next genuine package release.
- Scope keyboard rotation to the scene root; preserve list access, visible mobile selection feedback, truthful empty/Failure states and teardown.

## Review Focus

1. Invalid URL schemes/userinfo and a ninth category entry must fail validation, not produce links or overlapping layout slots: Task 1.
2. Zero enabled rings and filtering out a selection must yield zero matches and an explicit cleared state, not resurrect hidden data: Tasks 3/4.
3. Different shells can share a projected point; all entries must remain individually inspectable from the list: Tasks 2/4.
4. Descendant marker keydowns must not rotate the root or remove the focused marker; typing/search shortcuts remain local: Task 4.
5. DOM-present details can still be offscreen on mobile; select a real visible blip and assert name/category/ring viewport intersection with no auto-scroll: Task 4.

## Execution Gates And File Ownership

The approved spec contains the architecture decision, challenge and boundary
review; do not scaffold duplicate records. Use the existing
`codex/functional-ai-radar` branch if still clean and correctly based. Inspect
fresh state before execution; preserve unrelated work and stop for unexpected
boundary changes. Do not create or delete another worktree automatically.
Expected preparation changes are this plan and the spec's approval-status update.
After plan approval, commit only those records before product work; do not treat
them as unexplained changes or include unrelated files in that commit.

All paths below are relative to `apps/web/src/apps/functional-ai-radar/` unless
stated otherwise. Tasks execute in order. If delegated, each implementer receives
the spec, its task, predecessor interfaces and approved file scope; no additional
qualification/model trial follows from delegation. Inline execution uses one fresh
read-only native whole-branch reviewer at the end, not per-task workers/reviewers.

| Task | Owned files                                                                                                                                                                                   | Deliverable                                     |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1    | `data.ts`, `fixture.ts`, `data.test.ts`                                                                                                                                                       | Validated original dataset                      |
| 2    | `geometry.ts`, `geometry.test.ts`                                                                                                                                                             | Stable virtual layout and projected shell scene |
| 3    | `model.ts`, `message.ts`, `update.ts`, `update.test.ts`, `mount.ts`, `mount.test.ts`                                                                                                          | Model transitions and scoped pointer lifecycle  |
| 4    | `view.ts`, `radar.css.ts`, `view.test.ts`, `app.ts`, `main.ts`, `apps/web/src/pages/functional-ai-radar.astro`, `apps/web/src/pages/charts.astro`, `apps/web/e2e/functional-ai-radar.spec.ts` | Usable rendered route and browser qualification |

Before code, pause the ordinary preview with `bunx --no-install astro dev stop`
from `apps/web`, then run `bun run check`, `bun typecheck`, `bun run test` from
the root. Record failures before changing anything. Run shared builds and
browser checks serially; restore the ordinary preview after verification.
Missing-browser/server-startup failures are infrastructure failures, not RED.
Before each task commit, run fresh root `bun run check`, `bun typecheck` and
the task's focused tests. The full root suite and production/browser checks
also gate the final implementation receipt; a task commit is not whole-app
acceptance. Keep verification serial while the preview is paused.

### Task 1: Original Dataset And Validation

**Interfaces:** `data.ts` owns these readonly contracts and constants:

```typescript
type Category = 'techniques' | 'tools' | 'platforms' | 'languages-frameworks';
type Ring = 'adopt' | 'trial' | 'assess' | 'caution';
type RadarEntry = Readonly<{
  id: string;
  name: string;
  category: Category;
  ring: Ring;
  description: string;
  sourceUrl: string;
}>;
type RadarDataset = Readonly<{ authoredOn: string; entries: ReadonlyArray<RadarEntry> }>;
type RadarData =
  | Readonly<{ _tag: 'Ready'; dataset: RadarDataset }>
  | Readonly<{ _tag: 'Failure'; reason: string }>;
```

Export `categoryIds`, `ringIds` in the spec's order, `categoryLabels`, `ringLabels`
and `demoNotice` with the spec's exact provenance text. Export
`decodeRadarDataset(input: unknown): RadarData` and `loadDemoRadar(): RadarData`.
`fixture.ts` exports `demoRadar`, the raw local `{ authoredOn, entries }` fixture
authored on `2026-10-14`; it contains no layout/camera/filter state.

- [x] **Write `data.test.ts` before these modules exist.** Import the contracts
      above; pin the complete roster/rings from the spec, 32 unique IDs, eight per
      category and immutable input. Include these exact boundary assertions:

  ```typescript
  expect(decodeRadarDataset({ authoredOn: '2026-10-14', entries: [] })).toEqual({
    _tag: 'Ready',
    dataset: { authoredOn: '2026-10-14', entries: [] },
  });
  expect(
    decodeRadarDataset({ ...demoRadar, entries: [demoRadar.entries[0], demoRadar.entries[0]] })
      ._tag,
  ).toBe('Failure');
  ```

  Also assert Failure for whitespace-only names/descriptions, malformed IDs,
  unknown category/ring, malformed date, a ninth category entry, `javascript:`,
  HTTP and credential-bearing HTTPS URLs. Never fetch links inside tests.

- [x] **Run RED:** from root, `bun run --filter @opsydyn/web test src/apps/functional-ai-radar/data.test.ts`.
      Expect failing imports/assertions for the new behavior, not test-runner setup.
- [x] **Implement the data boundary and fixture.** Use existing Effect Schema
      patterns and structured URL parsing. IDs match lower-case kebab-case, dates
      are valid `YYYY-MM-DD`, source URLs are HTTPS with nonempty hostname and no
      username/password. Do not coerce values, drop bad rows or mutate input. Decode
      empty data successfully; enforce at most eight entries per category. Keep
      original concise descriptions and the exact sample placements, not invented
      endorsement/failure stories. Check each source once against primary material;
      retain links/check date in the execution receipt, not a new crawler/service.
- [x] **Run GREEN:** rerun the focused command; all cases must pass. Inspect all
      32 records for the spec's roster, category/ring assignment and honest notice.
- [x] **Review and commit only these three files** with message
      `feat(web): add original functional AI radar dataset`. For delegated work,
      review this deliverable before Task 2; for native work, self-review now and
      retain one whole-branch independent review for the end if authorized.

### Task 2: Stable Layout And Shell Projection

**Consumes:** Task 1's `RadarEntry`, `Category`, `Ring`, labels and ordered IDs;
existing `projectGlobePoint`/`clipGlobeLine` from `/shape/globe`. No app Model import.

**Produces:** `geometry.ts` exports `RADAR_SIZE = 600`, `RADAR_BASE_RADIUS = 260`,
`shellFractions` and the following readonly interfaces:

```typescript
type Coordinate = readonly [number, number];
type RadarFilters = Readonly<{
  query: string;
  category: Category | 'all';
  rings: ReadonlyArray<Ring>;
}>;
type RadarPosition = Readonly<{
  entry: RadarEntry;
  longitude: number;
  latitude: number;
  displayNumber: number;
}>;
type RadarView = Readonly<{ center: Coordinate; zoom: number }>;
type RadarMark = RadarPosition & Readonly<{ x: number; y: number; facing: number; depth: number }>;
type RadarShell = Readonly<{
  ring: Ring;
  radius: number;
  segments: ReadonlyArray<ReadonlyArray<Coordinate>>;
}>;
type RadarProjection = Readonly<{
  marks: ReadonlyArray<RadarMark>;
  shells: ReadonlyArray<RadarShell>;
}>;
```

Export the exact signatures:

```typescript
function layoutEntries(entries: ReadonlyArray<RadarEntry>): ReadonlyArray<RadarPosition>;
function filterPositions(
  positions: ReadonlyArray<RadarPosition>,
  filters: RadarFilters,
): ReadonlyArray<RadarPosition>;
function countRings(
  positions: ReadonlyArray<RadarPosition>,
  filters: RadarFilters,
): Readonly<Record<Ring, number>>;
function categoryCenter(category: Category): Coordinate;
function projectRadar(
  positions: ReadonlyArray<RadarPosition>,
  filters: RadarFilters,
  view: RadarView,
): RadarProjection;
```

`countRings` applies query/category but ignores enabled rings.
Filtering and counts reuse one matching policy; no duplicated search logic.

- [x] **Write `geometry.test.ts` with independent witnesses.** Build explicit
      valid synthetic `RadarPosition` records for two front entries at `[30,0]`, one
      Adopt and one Trial, and a rear entry at `[180,0]`. With all rings/category All,
      query empty and view `{ center:[0,0], zoom:1 }`, assert:

  ```typescript
  expect(scene.marks.find((mark) => mark.entry.id === 'adopt')?.x).toBeCloseTo(352, 10);
  expect(scene.marks.find((mark) => mark.entry.id === 'trial')?.x).toBeCloseTo(378, 10);
  expect(scene.marks.every((mark) => mark.y === 300)).toBe(true);
  expect(scene.marks.some((mark) => mark.entry.id === 'rear')).toBe(false);
  expect(scene.shells.map((shell) => shell.radius)).toEqual([104, 156, 208, 260]);
  ```

  For eight tools with IDs `a` through `h`, pin `a: [-75,22]`, `e: [-75,-22]`;
  reverse input and filter to one ID without changing positions/numbers. Pin
  category centres `[-135,20]`, `[-45,20]`, `[45,20]`, `[135,20]`. Pin depth
  ordering/ties independently, including different radii projecting to the same
  centre. Check trimmed mixed-case name/description search, ring-count semantics,
  all rings disabled, poles/horizon, frozen inputs and non-finite view rejection.

- [x] **Run RED:** `bun run --filter @opsydyn/web test src/apps/functional-ai-radar/geometry.test.ts`.
      Expect the new adapter/layout behavior to fail before implementation.
- [x] **Implement only the app-local adapter.** Sort full-data IDs with a stable
      lexical comparison; use the spec's eight-slot formula and global ID-order
      display numbers. Derive stable results without a cache or second mutable
      store. Project each ring at `260 * shellFraction * zoom`; reject non-finite
      centres, invalid latitude and zoom outside [1,2] rather than emit bad SVG.
      Cull rear/outside-centre marks, then sort ascending scaled-radius/facing depth
      and ID. Generate each shell's equator/four boundary meridians at <=5-degree
      spacing through existing clipping; output radius for its SVG outline. Keep all
      four guides, even when ring filters exclude their marks. Do not port new math
      or change any Viz helper/public contract.
- [x] **Run GREEN:** rerun geometry tests and Task 1's focused tests. Inspect
      output paths for finite coordinates and horizon splitting, not just existence.
- [x] **Review and commit only the geometry module/tests** with message
      `feat(web): add stable spherical radar layout`.

### Task 3: Model Transitions And Scoped Input

**Consumes:** Task 1's validated data and Task 2's coordinate/filter types,
layout/filter helpers, category centres and size/radius constants.

**Produces:** `model.ts` exports Schema-compatible `Selection` tagged
`None | Selected { id } | Cleared` and `Gesture` tagged
`Idle { ignoreNextBlipClick } | Dragging { pointerId, startX, startY, startCenter,
renderedRadius, maxDistance }`. Its readonly `Model` has `data`, `center`, `zoom`,
`query`, `category`, `enabledRings`, `selection` and `gesture`. `Selected.id`
represents the spec's selected ID; do not duplicate it in a separate field or
combine a nullable ID with an independent cleared flag.

Export `initModel(data: RadarData): Model`, and `init(_props: AppInitProps)` returning
the normal FoldKit init record using `loadDemoRadar()`. Defaults: centre `[0,20]`,
zoom 1, empty query, category `all`, all rings, Selection None and Gesture Idle.
`update.ts` exports `update(model: Model, message: Message): Return<Model, Message>`.
Map `Model.enabledRings` to `RadarFilters.rings` explicitly; query and category
map directly. Do not add a second filter representation or matching policy.

`message.ts` exports the `defineMessageUnion` value/type `Message`:

- `ChangedQuery { query }`, `ChangedCategory { category }`, `ClickedRing { ring }`.
- `ClickedClearFilters`, `ClickedResetView`, `ClickedZoomIn`, `ClickedZoomOut`.
- `ClickedTurn { direction: east | west | north | south }`, `PressedRadarKey { key }`.
- `ClickedBlip { id, keyboard }`, `ClickedEntryRow { id }`.
- `StartedRadarPointer { pointerId, clientX, clientY, renderedBaseRadius }`,
  `MovedRadarPointer { pointerId, clientX, clientY }`, `EndedRadarPointer { pointerId }`.
- `CompletedRadarPointerMount`.

Use the corresponding string/number/boolean and literal schemas. `mount.ts`
exports `pointerEventName = 'foldkit-radar-pointer'`, `radarEvents` (custom tag
`foldkit-radar-input`), `RadarPointerMount` and
`forwardRadarPointers(element: Element): Effect.Effect<void, never, Scope.Scope>`.

- [x] **Write `update.test.ts` and `mount.test.ts`.** Pin the default Model and
      observable transitions, including this distinguishing zoom/reset witness:

  ```typescript
  const zoomed = update(initModel(loadDemoRadar()), Message.ClickedZoomIn()).model;
  expect(zoomed.zoom).toBe(1.25);
  const reset = update(zoomed, Message.ClickedResetView()).model;
  expect(reset.center).toEqual([0, 20]);
  expect(reset.zoom).toBe(1);
  ```

  Explicitly verify query/category/rings intersection; excluded selection becomes
  Cleared; still-matching selection survives; all four rings unchecked produces
  no matches; repeated toggles cannot duplicate rings. List selection recentres;
  marker selection/rotation do not clear valid details; invalid/excluded IDs are
  no-ops. Reset-view retains filters/selection; clear-filters retains the camera.
  Pin category facing/All preservation, zoom clamps, 15-degree turns and Home.
  Verify start-relative drag, unrelated pointers, cancellation/leave, four-pixel
  threshold, keyboard activation after drag and finite-input arithmetic overflow.
  The actual scoped Effect must forward fresh width/identity facts and remove
  every listener after scope closure, following the existing Mount test pattern.

- [x] **Run RED:** `bun run --filter @opsydyn/web test src/apps/functional-ai-radar/update.test.ts src/apps/functional-ai-radar/mount.test.ts`.
      Test-runner startup failures do not count as reproductions.
- [x] **Implement Model, Messages and update.** Use existing FoldKit schemas,
      `Message.match`, readonly records and normal Return values. Derive matching
      positions via Task 2 before selection; retain Cleared until another valid
      selection. Filter/view commands end gestures. In drag use
      `longitude = startLongitude - dx / renderedRadius * 90` and
      `latitude = startLatitude + dy / renderedRadius * 90`; normalize/clamp only
      after rejecting non-finite derived values. Ignore unrelated pointers. Consume
      only the next pointer blip activation after a >4 CSS-pixel drag; keyboard
      selection remains available and starts fresh interaction state.
- [x] **Implement scoped pointer forwarding.** Use the earthquake Mount as a
      pattern, not an import. Read current outer base radius from SVG width and
      Task 2's constants; carry pointer ID/client coordinates in synchronous custom
      events. Only primary-button starts; forward release/cancel/leave. Effects own
      listener acquisition/removal; callbacks never mutate Model or camera/DOM.
- [x] **Run GREEN:** rerun both focused files, then all new radar unit tests.
      Verify listener removal by dispatching after scope closure and seeing no facts.
- [x] **Review and commit the six state/input files** with message
      `feat(web): add radar filtering selection and scoped gestures`.

### Task 4: Rendered App And Browser Acceptance

**Consumes:** data/labels/notice from Task 1; layout/filter/count/projection from
Task 2; Model/Selection/Message/update/Mount from Task 3. `view.ts` exports
`view(model: Model, h: HtmlBuilder<Message>): Document`.

`main.ts` re-exports Message, init, Model, update and view. `app.ts` exports the
existing `lazyApp(() => import('./main'))` wrapper. The new Astro route uses the
existing Layout and `client:load`; add one gallery link, not another gallery mount.

- [x] **Write `view.test.ts` before rendering code.** Use the real render helper
      `apps/web/src/ui/shared/render-chart.test-helper.ts` and FoldKit Scene, with
      `Scene.Mount.resolveAll([RadarPointerMount, Message.CompletedRadarPointerMount()])`.
      Assert labelled provenance, all matching rows, no hidden/filter-excluded marker
      targets, actual ring/category after rotation, visible selected outline and
      selected-last ordering. A small explicit dataset with different-ring entries
      must retain separate list buttons and distinct details regardless of their
      visibility; Task 2 supplies the exact coincident-projection witness. Exercise query/category/native checkbox,
      zoom/reset/clear/list controls through the real view rather than only updates.
      Assert one polite atomic live region, None versus Cleared, zero matches versus
      empty dataset and Failure without fake blips. Pin HTTPS source link attributes.
      A Scene key interaction must acknowledge handled/ignored outcomes with the
      installed `Scene.expectHandled()`/`Scene.expectIgnored()` APIs.
- [x] **Run RED:** `bun run --filter @opsydyn/web test src/apps/functional-ai-radar/view.test.ts`.
      Expect the requested view behavior to fail before rendering code exists.
- [x] **Implement `view.ts`/`radar.css.ts`** with unframed scene, compact controls,
      full list and details. Render guides before marks with no guide input; normal
      depth order except selected-last emphasis. Use fixed 20-unit blip radii and
      20-unit numbered SVG text within the stable viewBox; full names/category/ring
      remain in details/list. Clip marker edges to the scene viewport. Use a unique
      `functional-ai-radar-viewport` clip ID; this app mounts one scene only.
- [x] **Wire native, accessible controls.** Search uses OnInput; category uses
      OnChange with validated literals; labelled native ring checkboxes use one
      `ClickedRing` click handler, not duplicate change/click dispatches. Buttons are
      type button with names/tooltips. Root uses installed
      `h.OnKeyDownSelfPreventDefault`; marker Enter/Space uses prevent-default selection
      without rotation. Numbered marks have keyed IDs and accessible full labels.
      Use `data-blip-id` on scene marks and `data-entry-id` on rows for identity checks.
      Root attributes expose current longitude/latitude/zoom for observable tests.
      Define role group `Functional and AI radar`, region `Selected technology`,
      search label `Search technologies` and list buttons `Inspect <entry name>`.
      Reuse light/dark tokens with teal/green/amber/rose category swatches and text;
      ring checkboxes show query/category counts before enabled-ring exclusions.
- [x] **Finish layout/route and run unit GREEN.** Put compact name/category/ring
      summary before the scene on mobile and beside it on desktop without reversing
      DOM reading order. Longer description/list may continue below. No auto-scroll,
      duplicate live summary, nested cards, viewport Model or new dependency. Add
      app/main, route and gallery link; rerun all new radar unit/Scene tests.
- [x] **Write `apps/web/e2e/functional-ai-radar.spec.ts`.** Use existing
      desktop 1365x900/mobile 390x844 projects and their exclusive server. Required
      journeys/assertions:
  - Initial 32 rows, four guides, explicit demo notice; after search/category/rings,
    filtered list and result count agree, and every rendered marker belongs to
    those filtered IDs. Rear-side entries remain counted; marker/list counts need
    not equal. Zero rings yields no rows/marks, not fallback data.
  - Iterate all 32 named list buttons and assert each actual name/category/ring
    in selected details; rear/overlapping entries are reachable and recentered.
  - A real front marker selects without camera change; at 390x844 all compact
    selected name/category/ring elements have viewport intersection ratio 1,
    unchanged scrollY, unchanged marker focus, and exactly one live region.
  - Root ArrowRight changes longitude by 15; focused marker ArrowRight is not
    consumed and does not rotate/remove focus. Marker Enter/Space selects once;
    typing/Home/arrows in search do not affect the view. Native checkbox Space
    toggles one ring once. Reset-view and clear-filters preserve their contracts.
  - Mouse drag, unrelated-pointer isolation, cancellation, zoom limits and
    genuine Chromium-emulated touch change the expected pose without a trailing
    accidental selection. Use CDP touch only on mobile; report any deliberate
    desktop-touch skip separately, never as a mobile pass.
  - Light/dark screenshots, zero page/console errors and no unexpected external
    HTTP requests; navigation away/back restores default state and no old input
    listeners. Check reduced motion and a 320px no-page-overflow viewport.
    Capture scene screenshots before/after rotation and SVG raster pixels for
    nonblank guides/marks. Inspect text/control overlap and source-link contrast.
    Do not change Playwright configuration or add public fixture switches.
- [x] **Run browser qualification serially:** from `apps/web`,
      `bun run test:e2e e2e/functional-ai-radar.spec.ts`. Every required desktop/mobile
      journey must pass; document deliberate skips and startup failures separately.
      Fix failures at their actual boundary and rerun without weakening assertions.
- [x] **Final verification and scoped review.** Run root `bun run check`,
      `bun typecheck`, `bun run test`, then
      `bun run --filter @opsydyn/web build` and the focused browser file serially.
      Existing globe regression tests must remain green. Inspect any package export-map,
      manifest/lockfile, shared app, workflow or config diff as a scope violation;
      the planned imports of existing Viz/FoldKit/Effect APIs are allowed.
      If a necessary change crosses those boundaries, stop for revised approval.
      Complete the selected review method, fix meaningful findings and rerun affected
      checks. Reviewer output is not a substitute for executed verification.
- [x] **Commit only Task 4's files** with message
      `feat(web): render and qualify functional AI radar`. Restore the preview via
      root `bun run --filter @opsydyn/web dev --host 127.0.0.1 --port 4381`, verify
      the new route responds and provide its URL. Do not push or create/merge a PR
      without separate approval.

## Completion And Handoff

Keep a concise five-field execution receipt in this plan after implementation:
authorised scope, actual red/green witnesses, focused/full counts, browser/artifact
paths, review provenance and remaining uncertainty. Check the four deliverables
against the spec before marking their boxes complete. Do not backfill an
infrastructure failure as RED, turn an emulated test into device acceptance or
claim comparative readability, EHS effect, runtime containment or publication.

Rollback is removing this app/route/gallery link, with no migration, remote
state, shared geometry or release configuration to repair. Live normalization
qualification stays pending the next genuine package release.

Plan preparation inspected the approved spec, installed FoldKit keyboard/Scene
declarations, existing globe data/state/Mount/view tests, real render helper,
Astro route/wrapper and browser configuration. No radar code, fixture, model call
or behavioural experiment was executed during planning. Review this plan and
choose native/inline or subagent-driven execution before starting Task 1.

## Execution Evidence

- result: complete
- claim: Approved four-task radar implemented inline and locally committed, with
  both independent-review findings repaired in one verified fix pass. No push/publication.
- evidence: 55 radar tests; full workspace 973 passed, one existing skip; strict
  checks/typechecks and production build pass; combined radar/globe Chromium
  16 passed, two deliberate desktop-touch skips, both mobile touch cases pass.
- remaining uncertainty: Human preview review, physical device, Safari and
  assistive technology are not qualified. Demo placement is not adoption advice;
  live normalization qualification awaits the next genuine package release.
- next: Needs review of the local preview, then an explicit integration choice.

Approved inline execution produced local data, geometry, state/input and UI
commits `3892537`, `3ccca56` plus correction `601c22b`, `3f45ca6`, and `84810ba`.
No shared package, manifest/lockfile, workflow/configuration, version or existing
earthquake code changed. Independent review of `f2cc400..84810ba` completed;
its single fix pass passed final verification below.

- Feature-absent RED logs: `/tmp/ehs-radar-data-red.log`,
  `/tmp/ehs-radar-geometry-red.log`, `/tmp/ehs-radar-state-red.log`,
  `/tmp/ehs-radar-view-red.log`. GREEN: 51 radar tests across five files.
  Disabling the duplicate-ID guard yielded one behavioural failure; it was restored.
- Strict-check checkpoint failure after initial geometry commit is retained:
  its `Record` return type was corrected in `601c22b`, then checks passed.
  No lint rule/configuration was weakened. This checkpoint was not qualified.
- The first browser run exposed actual focused-marker loss after selected-last
  node movement. The ID-pinned reproduction also failed. Stable interactive nodes
  plus inert foreground paint restored desktop/mobile keyboard GREEN.
- Final strict checks report zero warnings; full typechecks report zero
  errors/warnings/hints across 606 files. Serial root tests: 969 passed,
  one existing promo-artifact skip. Web production build exits 0.
- An earlier full-suite run overlapped a typecheck-triggered package rebuild
  and failed the existing stateflow HTTP smoke. The unchanged serial rerun passed;
  the failed output remains `/tmp/ehs-radar-full-tests-overlap-failure.log`.
  This is not a product RED or justification for weakening the smoke check.
- Combined Chromium radar/globe qualification: 16 passed, two deliberate
  desktop-touch skips; both mobile touch journeys passed. All 32 radar list entries
  were individually inspected in both viewports. Pixel thresholds require over
  12,000 painted and 2,000 coloured pixels per radar raster; measurements are
  attached in `apps/web/playwright-report/index.html`.
- Final command logs: `/tmp/ehs-radar-final-check.log`,
  `/tmp/ehs-radar-final-typecheck.log`, `/tmp/ehs-radar-final-tests.log`,
  `/tmp/ehs-radar-final-build.log`, `/tmp/ehs-radar-final-browser.log`.
  Screenshots under `apps/web/test-results/functional-ai-radar-*` were inspected
  for desktop/mobile, selected feedback, light/dark, 320px and rotated scenes.
- Preview restored at `http://127.0.0.1:4381/functional-ai-radar`, HTTP 200.
  Browser results are Chromium/emulated-device evidence, not physical-device,
  Safari, assistive-technology or deployment acceptance. Live normalization
  qualification remains pending the next genuine package release.

### Rulings

1. Geometry's single-ID `e` search test needed a description without `e`;
   the separate description-search test remains. Cost if wrong: one test fixture,
   not a production search-policy change.
2. The single-result Scene search uses Algebraic data types because Effect
   also matches FoldKit's description. Cost if wrong: a test expectation,
   not weakening the required name-or-description match.
3. Selected-last means last visual paint, with one inert foreground layer;
   interactive targets remain depth ordered to preserve demonstrated browser focus.
   Cost if wrong: one app-local paint layer; overlapping entries remain reachable
   through the full list. No imperative DOM focus restoration or shared runtime edit.
4. The reviewer did not check source availability/provenance because network
   verification was excluded. Parent primary-source browsing and original local
   descriptions establish checked-date demo provenance only, not future availability
   or endorsement. Cost if wrong: source-link maintenance, with no runtime network dependency.
5. The reviewer did not inspect screenshot legibility/contrast; the parent inspected
   retained desktop/mobile/320px light/dark images and ran raster/layout checks.
   Cost if wrong: undetected visual UX; human preview review remains recommended.
6. Physical-device, Safari and assistive-technology acceptance remain unqualified.
   Cost if wrong: browser/device-specific behaviour may escape Chromium tests;
   no production or cross-browser acceptance claim is made.

### Independent Review

Native fresh-context reviewer `01a13c3d-ba63-79c2-9401-74cf3a2f2ece` (Lagrange),
inherited model, read-only package/spec/plan/source/test inspection, no command
execution, network, mutation or further delegation. Verdict: with fixes; two
Important findings, no Critical/Minor. All five requested focus areas were checked;
foreground selection paint and search-fixture rulings were accepted. The reviewer
did not independently rerun the supplied verification.

Both findings are accepted: leave Ctrl/Meta/Alt browser chords unhandled while
retaining Shift-plus radar zoom; draw four complete inert, unfilled shell outlines
before their projected guides. Three modifier Scene cases and an independently
specified rotated/zoomed shell-radius test failed before these corrections
(`/tmp/ehs-radar-review-red.log`), then all 55 radar tests passed. No re-review is
dispatched; the one fix pass is gated by executed regressions and the full suite.
Deferred minors: none.

Post-review verification: `/tmp/ehs-radar-review-green.log` (55 passed),
`/tmp/ehs-radar-review-check.log` (zero lint/format warnings),
`/tmp/ehs-radar-review-typecheck.log` (606 files, zero errors/warnings/hints),
`/tmp/ehs-radar-review-tests.log` (973 passed, one existing skip),
`/tmp/ehs-radar-review-build.log` (production build exit 0), and
`/tmp/ehs-radar-review-browser.log` (16 passed, two desktop-touch skips).
Modified-key cancellation/camera assertions and all four shell outlines pass in
both browser viewports. Corrected rotated-shell and narrow/mobile screenshots were
inspected. These reruns qualify the fixes; no second reviewer or provider trial ran.
Final recommendation: needs review. Keep the branch local; no integration is implied.
