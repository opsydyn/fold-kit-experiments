# Keyed Chart Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an Astro-hosted, downloadable scatter/histogram workbench whose keyed panels retain state and whose range inspections highlight every matching point.

**Architecture:** App-owned chart children are composed by two typed `foldChildAt` adapters. The parent owns panel identity and linked inspection; sibling highlights are derived inputs, not dispatched updates. The promo wrapper and standalone project reuse the same maintained application and chart sources.

**Tech Stack:** FoldKit 0.167.0, Effect 4.0.0, Astro 7.1.1, TypeScript, Bun, Vitest, oxlint, oxfmt; existing Viz primitives, fflate, and StackBlitz SDK.

**Spec:** [Approved design](../specs/2026-10-08-keyed-chart-comparison-design.md).

## Execution Status

Approved for all five tasks and subagent-driven execution on 2026-10-08.
The controller's authoritative ledger is
`.superpowers/sdd/2026-10-08-keyed-chart-comparison/progress.md`.
Tasks 1-3 are implemented and reviewed (`35ff4ce`, `5e8073e`, `6e2afbd`).
Task 4 source/automated checkpoint `70b7c7b` is approved; its live browser
acceptance is pending. The Mac is unlocked. Controller standalone QA at port
4349 observed captured structure, linking, keyboard reorder,
add/cap and 390px controls were observed; a scatter-axis label overlap is assigned
to the final fix wave. Task 5 source/automated qualification is complete;
controller review and remaining host/browser acceptance are pending. Firefox
was navigated by unrelated activity and the CUA binding invalidated, so the
controller stopped UI actions and preview, pending exclusive browser access.

## Global Constraints

- Start with one scatter and one histogram panel; allow zero to four panels.
- Use one immutable local dataset with unique stable datum IDs.
- IDs are never reused during an app instance, including after the collection becomes empty.
- Only the final histogram bin includes its upper endpoint.
- Keep the single local active point for keyboard navigation and its tooltip.
- No remote data, Query/KeyedQuery cache, persistence, time-series synchronisation, VirtualList, or Machine runtime.
- No new public Viz/Astro APIs or chart-math rewrite; chart math changes require the D3 source reference.
- No DOM references in Models, view-time DOM mutation, or effects in update bodies; use Commands and scoped Mount effects.
- Use past-tense Messages, FoldKit union matchers, record update returns, and static imports except established island loader boundaries.
- Keep the qualified FoldKit/plugin versions: 0.167.0 and 0.27.0; preserve optional Viz peers.
- Use `bun run test` for workspace tests. Run build-mutating checks sequentially.
- The separately authorised upgrade checkpoint is `3fe48cf`. Preserve the qualified dependencies. No push, merge or publication is authorised.

## Review Focus

1. Duplicate labels/equal coordinates must not merge distinct IDs; reject duplicate IDs in exported settings/data (Tasks 1, 2, 5).
2. A delayed clear from an old source must not erase a newer inspection (Task 2).
3. Empty data, zero-sized hidden charts, and an empty panel collection must remain finite and keyboard-safe (Tasks 1, 3).
4. DOM reordering, nested scrolling, and resize must not leave stale pointer coordinates or steal focus (Task 3).
5. An export requested during edits must use a captured structural snapshot and remain runnable without workspace paths or unpublished packages (Task 5).

## Execution Prerequisite

- [x] Read the spec, current `AGENTS.md`, and `CLAUDE.md`; inspect status/diff before changing files.
- [x] Resolve the uncommitted 0.167 compatibility work before creating an execution worktree: ask for its separate checkpoint authority, or use a user-selected checkout already containing it. Do not silently copy, stage, or revert it.
- [x] Establish the isolated checkout with `superpowers:using-git-worktrees`; record its base commit and the dependency prerequisite in the execution ledger.
- [x] Run `bun typecheck`, `bun run check`, and `bun run test`. Record exact exits; investigate baseline failures before feature edits.

## File Map

| Area                 | Files and responsibility                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pure inspection      | New `apps/web/src/ui/shared/inspection.ts` and `.test.ts`: keyed point/range matching only                                                              |
| Existing charts      | `apps/web/src/ui/scatter-chart/index.ts`, `histogram-chart/index.ts`, their new `index.test.ts`: optional overlays, datum IDs, keyboard facts           |
| Existing linked demo | `apps/web/src/apps/linked-charts/{model,fold,view}.ts` and existing tests: repair first-match behaviour                                                 |
| Workbench state      | New `apps/web/src/apps/comparison/{data,initial-settings,settings,model,message,fold,update}.ts` and focused tests                                      |
| Workbench UI         | New `apps/web/src/apps/comparison/{view,command,main,app}.ts`, `comparison.css`, runtime/view tests                                                     |
| Measurement          | New `apps/web/src/ui/shared/plot-events.ts` and `.test.ts`: scoped client-coordinate facts and width changes                                            |
| Reference host       | New `apps/web/src/pages/comparison.astro`, `apps/web/src/stories/comparison.stories.ts`; link from `apps/web/src/pages/charts.astro`                    |
| Promo host           | New `apps/promo/src/examples/comparison/{app,main,model,message,update,view,command,project}.ts`, `comparison-host.css`; new page and download endpoint |
| Export sources       | New `apps/promo/src/lib/comparison-sources.ts`; narrow extension of `example-project.ts`; new export tests                                              |
| Evidence             | New `docs/superpowers/specs/2026-10-08-keyed-chart-comparison-qualification.md`; update `docs/roadmap.md` only as gates actually pass                   |

Do not split unrelated chart internals or create a new workspace. Add tests next
to web code, following Vitest setup; promo tests use `bun:test` under `test/`.

## Task 1: Repair Range Highlighting Without Moving Local Focus

**Files:** pure inspection, existing charts, and existing linked demo from the file map.

**Interfaces:**

- Add optional `id?: string` to app-owned `Scatter.Point`; existing callers remain valid. Its `InspectedPoint.key` is `point.id ?? point.label`; comparison callers always supply IDs.
- `inspection.ts` exports `KeyedPoint = Readonly<{ id: string; x: number; y: number; label: string }>` and `Inspection = { _tag: 'Point'; key: string } | { _tag: 'Range'; lower: number; upper: number; includeEnd: boolean }`.
- Export `matchingKeys(points: ReadonlyArray<KeyedPoint>, inspection: Inspection): ReadonlyArray<string>` and `matchingBinIndices(points: ReadonlyArray<KeyedPoint>, keys: ReadonlyArray<string>, bins: ReadonlyArray<{ x0: number; x1: number }>): ReadonlyArray<number>`.
- Add optional `highlightedKeys?: ReadonlyArray<string>` to `Scatter.view` and `highlightedBins?: ReadonlyArray<number>` to `Histogram.view`. These are derived render inputs, never copied to child Models.
- Histogram `InspectedRange` gains `includeEnd: boolean`, emitted from the actual bin index. Update existing event assertions to include it.
- Existing linked Model gains `inspection: Option<Inspection>`; its histogram fold updates that field rather than `scatter.activeIndex`. Its view derives the overlay/count. Keep scatter-to-histogram behaviour working.

- [x] **Write failing matching and rendered-overlay tests.** Define this fixture locally in `inspection.test.ts`: IDs `a,b,c,d`, salaries `10,20,20,30`, identical labels, and `b/c` with identical coordinates. Assert:

```ts
expect(matchingKeys(points, { _tag: 'Range', lower: 10, upper: 20, includeEnd: false })).toEqual([
  'a',
]);
expect(matchingKeys(points, { _tag: 'Range', lower: 20, upper: 30, includeEnd: true })).toEqual([
  'b',
  'c',
  'd',
]);
expect(matchingKeys(points, { _tag: 'Range', lower: 40, upper: 50, includeEnd: false })).toEqual(
  [],
);
expect(matchingKeys(points, { _tag: 'Point', key: 'c' })).toEqual(['c']);
expect(matchingKeys([], { _tag: 'Point', key: 'c' })).toEqual([]);
```

In `scatter-chart/index.test.ts`, render through the existing runtime test setup:
two overlay marks have `data-linked-highlight="true"`, an independently active
third point retains its tooltip, and omitting the overlay preserves old output.
Change the linked-demo test named "highlights the first scatter point" to assert
the complete matching key set and unchanged local `activeIndex`.

- [x] **Prove RED.** Run `bun run --filter @opsydyn/web test src/ui/shared/inspection.test.ts src/ui/scatter-chart/index.test.ts src/apps/linked-charts`. Expect missing helper/overlay or first-match assertions to fail, not environment failures.
- [x] **Implement the contracts.** Use existing interval membership semantics, no new binning. Range matching uses `y`; point matching uses ID. Ignore non-finite coordinates for range matching. Add stable IDs to the linked fixture, retain immutable inputs, and expose a text count using the same keys as rendering.
- [x] **Reject ambiguous data identity.** Before matching, reject empty or duplicate IDs with `RangeError`; test an array containing the same ID twice throws rather than silently coalescing it. Equal labels/coordinates with different IDs remain valid.
- [x] **Verify compatibility.** Add explicit legacy no-ID tests for the old label key and single active point; update `fold.test.ts` to preserve Command completion mapping. Run the same targeted command and the full web tests; expect zero failures.
- [x] **Checkpoint.** Run `bun run check`, `bun typecheck`, `bun run test`; stage only Task 1 files and commit `fix: highlight every scatter point in linked ranges`.

## Task 2: Compose Stable-ID Panels and Parent-Owned Linking

**Files:** new workbench state files and `settings.test.ts`, `update.test.ts`, `fold.test.ts`.

**Interfaces:**

- `data.ts` exports `points: ReadonlyArray<KeyedPoint>`, using the illustrative linked-demo values with unique IDs.
- `settings.ts` exports a Schema and type `Settings` with `panels: ReadonlyArray<{ id: number; kind: 'scatter' | 'histogram' }>`, `linkInspections: boolean`, and `nextPanelId: number`; `initialSettings` uses IDs 1/2, counter 3, linking true.
- `model.ts` exports tagged `Panel` variants containing `{ id, chart }`, `Model = { panels: ReadonlyArray<Panel>; nextPanelId: number; linking: Linking }`, and `init(settings?: Settings): Return<Model, Message>`.
- `Linking` is `Independent` or `Linked({ inspection: Option<{ sourceId: number; value: Inspection }> })`.
- `message.ts` defines `ClickedAddPanel({kind})`, `ClickedRemovePanel({id})`, `ClickedMovePanel({id,direction:'earlier'|'later'})`, `ChangedLinkInspections({enabled})`, `GotScatterMessage({id,message})`, and `GotHistogramMessage({id,message})`. Use existing Schema.Unknown plus typed override patterns where needed; casts stay at the handler boundary.
- `fold.ts` exports `comparisonFolds(updaters: {scatter: typeof Scatter.update; histogram: typeof Histogram.update})`, returning typed `scatter(model,id,message)` and `histogram(model,id,message)` folds.
- `update.ts` exports `update(model: Model, message: Message): Return<Model, Message>`.

- [x] **Write failing collection tests.** Assert default panel types/IDs, add through four then no-op, remove all then add ID 3, reorder preserves child object references and active inspection, unknown-ID/wrong-kind no-op, and endpoint moves no-op. Decode settings rejects negative/non-integral IDs, duplicates, more than four panels, and a counter not greater than all captured IDs; zero panels is valid.
- [x] **Write failing linking tests.** Inspect in panel 1 then panel 2; a clear from panel 1 retains source 2. Remove panel 2 and assert shared inspection is None while panel 1 local state is unchanged. Toggle off/on and assert independent states survive and re-enabled linking has no source. Add a sibling while linked and assert its derived overlay immediately agrees without changing its local Model.
- [x] **Prove RED.** Run `bun run --filter @opsydyn/web test src/apps/comparison/settings.test.ts src/apps/comparison/update.test.ts src/apps/comparison/fold.test.ts`; expect absent workbench modules/behaviour failures.
- [x] **Implement keyed folds and transitions.** `readAt` checks ID and tag; `writeAt` never inserts. Keyed OutMessage handlers store only semantic inspection. Reuse `foldChildInit` to lift init Commands; preserve computed Command lists. Do not re-dispatch overlay updates into sibling children.
- [x] **Prove Command routing and late-result safety.** Adapt the existing `ProbeInspection` test: run a child Command after reordering, assert its completion still carries the original ID, remove that ID, then assert applying the completion returns the same parent Model and no Commands. Spy on the child updater to prove missing/wrong-kind IDs never invoke it. Each OutMessage is consumed once.
- [x] **Checkpoint.** Run targeted tests and the three workspace gates; stage only Task 2 files and commit `feat: compose comparison panels with keyed child folds`.

## Task 3: Build the Workbench Interaction and Measurement Layer

**Files:** `comparison/{view,command}.ts`, `comparison.css`, `view.test.ts`, `main.scene.test.ts`; shared `plot-events.ts` and `.test.ts`; both app-owned chart components and their tests.

**Interfaces:**

- `view.ts` exports `body(model: Model, h: HtmlBuilder<Message>): Html` and `view(model: Model, h: HtmlBuilder<Message>): Document`.
- `plot-events.ts` exports `pointerPositions(element: Element): Stream<{ clientX: number; clientY: number; left: number; top: number; width: number; height: number }>` and `widthChanges(element: Element): Stream<number>`.
- Add `MovedPlotPointer` with those numeric fields to Scatter; its update computes nearest-point inspection using current chart coordinates. Read `getBoundingClientRect()` inside the scoped pointer event effect, not in the view; sample each pointer event so reorder/scroll cannot leave cached hit-test bounds stale.
- Reuse the promo ResizeObserver acquire/release pattern for width changes. Charts receive `RecordedChartWidth({width})` and update `layout` without resetting inspection. Ignore non-finite/non-positive widths; keep finite previous dimensions while hidden.
- Add `PressedKeyNav({direction})` to Histogram using `arrowKeyNav`/`nextIndex`; explicitly no-op for zero bins before modulo arithmetic. Apply the same empty-data guard to Scatter.
- `command.ts` defines `FocusComparisonTarget({selector})` with `Dom.focus(selector, {makeFocusable:true})`, a completion Message, and harmless handling for a target removed before commit. The parent schedules it for add/remove. Per controller ruling, reorder also uses a guarded post-commit focus-restoration Command because keyed DOM movement can drop browser focus. No focus authority is stored in Model/view/update.

- [x] **Write failing keyboard/render tests.** With two bins, ArrowRight inspects bin 0, then bin 1 with `includeEnd:true`; unrelated keys do nothing. Empty chart keyboard input produces no inspection or NaN. Rendering shows all linked matches, a text count including zero, a separate local tooltip, and a data alternative for both chart types.
- [x] **Write failing movement and cleanup tests.** Mount the shared pointer stream against a fake element. Dispatch the same client position before/after changing its rectangle and assert emitted local geometry uses the new rectangle. Close its Effect scope and assert listeners are removed. Resize notifications preserve active inspection; closing the width stream disconnects its observer. Test zero-width then positive-width recovery.
- [x] **Prove RED.** Run `bun run --filter @opsydyn/web test src/ui/shared/plot-events.test.ts src/ui/scatter-chart/index.test.ts src/ui/histogram-chart/index.test.ts src/apps/comparison/view.test.ts src/apps/comparison/main.scene.test.ts`.
- [x] **Implement the view and scoped effects.** Render panels with FoldKit's stable key attribute set to panel ID. Use native linking control, named move/remove icon buttons, distinct local/linked mark styles, and stable headings. Two columns when space permits, one at 390px; measure available width instead of shrinking text with a fixed SVG. Keep controls outside the chart frame and use existing design tokens. No new icon dependency unless the existing repository has none suitable; follow its current icon convention.
- [x] **Implement focus and verify actual runtime behaviour.** Heading IDs are `comparison-panel-${id}` with `tabindex=-1`; add control ID is `comparison-add-scatter`. Add focuses the new heading. Remove focuses next, then previous, then add. Verify reorder keeps the same DOM node and focused control, and chart Mount streams are disposed on removal. A removed focus target must not crash or steal focus elsewhere.
- [x] **Verify input equivalence.** Keyboard and pointer inspection yield the same interval facts. Sample coordinates in client space, including nested scroll and non-default browser chrome; remove the workbench's reliance on `outerHeight - innerHeight`. Preserve existing histogram brush behaviour with regression tests. CSS disables non-essential transitions under reduced motion.
- [x] **Checkpoint.** Run targeted tests and the three workspace gates; commit only Task 3 paths as `feat: add accessible comparison controls and range inspection`.

## Task 4: Host and Qualify the Astro Reference Workflow

**Files:** `comparison/{main,app}.ts`, `apps/web/src/stories/comparison.stories.ts`, `apps/web/src/pages/comparison.astro`, `apps/web/src/pages/charts.astro`, new `apps/web/src/apps/comparison/host.test.ts`, qualification document.

**Interfaces:**

- `main.ts` exports the Model schema, Message, update, and Document view from Tasks 2/3. Its `init(_props: unknown): Return<Model, Message>` delegates to the state initializer with `initialSettings`, rather than interpreting Astro props as Settings.
- `app.ts` uses the existing `lazyApp` boundary; `/comparison` embeds one `client:load` island under the existing Layout.
- The Story uses the existing `apps/web/src/stories/mount.ts` helper with the same application exports and deterministic initial settings, not a separate fake panel implementation.

- [x] **Write a failing host/runtime test.** Embed the application in the existing happy-dom test setup, add a panel, move it, inspect, and remove it. Assert ordered accessible panel names, a maximum of four, preserved IDs, and no updates after disposal. Verify the `/comparison` source/host references this application once and exposes a navigation link from Charts.
- [x] **Prove RED.** Run `bun run --filter @opsydyn/web test src/apps/comparison/host.test.ts` before adding host exports/page.
- [x] **Implement the host and Story.** Use the established app config contract and literal island loader; no integration package edits, new router, server pipeline, or custom runtime. Import plain `comparison.css` so standalone Vite can reuse it without an extra CSS compiler.
- [x] **Verify automated host gates.** Web tests, web production build and Storybook build passed at `70b7c7b`; see qualification evidence. Storybook chunk warnings remain deferred.
- [ ] **Verify browser journeys (controller-owned).** Start a production preview on an unused port. At desktop and 390px, exercise add to four, blocked fifth, reorder, remove source, remove all, re-add, keyboard range inspection, scroll, resize, and pointer hit testing after reorder. Assert matching counts and distinct focus/linked styles, no overflow, and no duplicate runtime/console errors. Record observed evidence and limitations in the qualification doc; stop the temporary server afterward.
- [x] **Checkpoint.** Run the three workspace gates and commit only Task 4 paths as `feat: host the comparison workbench in Astro`.

## Task 5: Reuse the Workbench in Promo and Standalone Exports

**Files:** promo host/export files from the file map; `apps/promo/src/pages/examples/comparison.astro`, `apps/promo/src/pages/downloads/comparison-template.json.ts`, `apps/promo/src/lib/examples.ts`, `apps/promo/src/lib/example-project.ts`; new `apps/promo/test/{comparison-source,comparison-export,comparison-state,comparison-standalone}.test.ts`; roadmap and qualification doc.

**Interfaces:**

- Promo Model owns `{ workbench: Comparison.Model, sources, activeFile, templateUrl, actionStatus }`; it folds the shared workbench with `foldChild`, preserving all Commands. It does not reimplement panel updates or matching.
- `project.ts` exports `captureSettings(model: Comparison.Model): Settings`, `projectFiles(template: Readonly<Record<string,string>>, settings: Settings): Readonly<Record<string,string>>`, and `projectZip(files): Uint8Array` following existing exports.
- `comparison-sources.ts` exports `collectComparisonSources(): Promise<ReadonlyArray<SourceFile>>`. Read source imports/re-exports with TypeScript's parser. Traverse only comparison entry modules and their transitive local dependencies; reject paths outside approved `apps/web/src` and `apps/promo/src/examples/comparison` roots. Exclude tests, Storybook, and Astro loader files.
- Preserve the paths below the repository's `apps/` directory under the generated `src/` tree (for example, `src/web/src/apps/comparison/main.ts`). Relative imports between the included host and reference sources therefore remain internal and unchanged.
- Add only a narrow `comparison` descriptor/entry-path option to `buildExampleTemplate`; preserve the existing line/histogram/scatter defaults. Generated entry imports the promo wrapper at its captured internal path. Copy required plain CSS; include all consumed Viz subpaths and compiled dependencies through the existing vendor walker.

- [x] **Write failing snapshot/source tests.** Export reordered IDs `[2,3,1]`, linking off, counter 4; assert those values round-trip into Settings and transient bounds/hover/export status do not. Two template exports must not mutate the template or share mutable state. Reject duplicate IDs and escaping/missing source imports. Assert collected workbench/chart sources equal maintained file contents, not manually maintained copies.
- [x] **Write failing wrapper lifecycle tests.** Start an export, edit the workbench, finish it: the action used the original settings snapshot while the live Model retains later edits. Disable repeated export actions while pending; failure leaves the workbench usable and permits retry. Forward a delayed child Command completion using its panel ID; a removed panel remains absent. Standalone mode (`templateUrl:null`) offers no recursive download/playground action.
- [x] **Prove RED.** Run `bun run --filter @opsydyn/promo test test/comparison-source.test.ts test/comparison-export.test.ts test/comparison-state.test.ts`; expect absent export/host contracts to fail.
- [x] **Implement the thin wrapper and template collection.** Match existing source viewer, copy, ZIP, and StackBlitz workflows. Source selection is limited to collected paths. Capture Settings when the Command is created, not when fetch completes. Per the authoritative preflight ruling, `projectFiles` replaces only the data-only `initial-settings.ts` at its captured internal path; `settings.ts` retains Schema/validation. Maintain the next-ID counter, omit transient state, and keep all effects in Commands. Put the workbench first on the promo page, with no new explanatory hero/editor.
- [x] **Prove automated standalone independence.** Follow `standalone-chart-project.test.ts`: create a temporary project, write generated files, run `npm install --no-audit --no-fund`, `npm run typecheck`, and `npm run build`. Assert no `workspace:` dependency, imports escaping the generated tree, or unresolved repository aliases. All three old exports remain covered. CSS, actual clipboard delivery and delayed export completion are tested. The preserved fixture is `/private/tmp/comparison-task-5-preview`: IDs `[2,3,1]`, kinds `[histogram,scatter,scatter]`, linking off, counter 4.
- [x] **Standalone browser smoke (controller-owned; visual defect remains).** Run `npm exec -- vite preview --host 127.0.0.1 --port <unused-port>` in the preserved fixture and exercise add/reorder, multi-match inspection and linking toggle; verify the captured starting structure.
- [x] **Run final qualification sequentially.** `bun run check`; `bun typecheck`; `NPM_CONFIG_CACHE=/private/tmp/foldkit-npm-cache bun run test`; `env -u FOLDKIT_BUILD_ID bun run build`; `bun run --filter @opsydyn/web build-storybook`. Build warnings are reported separately from lint. Update qualification evidence and roadmap checkboxes only for completed gates.
- [ ] **Hosted browser acceptance (controller-owned).** Verify both hosted examples with keyboard, reduced motion and 390px/desktop layouts. The Mac is unlocked, but further QA is pending exclusive Firefox access after unrelated navigation invalidated the controller's binding. Retain only the observed standalone subset.
- [x] **Source self-review and checkpoint.** Review the full diff against every spec acceptance item, verify no package-public runtime or API changes, and run `git diff --check`. Commit only this feature's final paths as `feat: export the maintained comparison workbench`. Do not push or publish without explicit authority.

- [ ] **Controller final review.** Complete remaining hosted/browser gates and the observed scatter-axis label-overlap correction in the final fix/review wave.

## Plan Review and Execution Choice

Spec, plan and subagent-driven execution are approved. The controller owns
independent review and live browser acceptance; implementers perform self-review,
focused RED/GREEN, sequential workspace gates and local checkpoints only.

Spec coverage: range repair (Task 1), identity/linking (Task 2), keyboard/focus/
measurement (Task 3), Astro reference and Story (Task 4), same-source promo/export
and final qualification (Task 5). Live browser, accessibility, physical-device,
merge and publication evidence remain separate from automated qualification.
