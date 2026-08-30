# FoldKit 0.155 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the demo application and both published packages to the FoldKit 0.155 message, union, mount, and runtime-record contracts without weakening the Astro/viz boundaries.

**Architecture:** Keep FoldKit message, route, and tagged-state schemas as namespace-owned values and match them through their own exhaustive `.match` methods. Keep the Astro package responsible for its existing client/server adapter boundary, convert its public config types to FoldKit records, and keep `@opsydyn/foldkit-viz` pure by changing only its compatibility fixtures and peer contract.

**Tech Stack:** Bun workspaces, FoldKit `0.155.0`, Effect `4.0.0-rc.112`, Astro `7.1.1`, TypeScript `6.0.3`, `@foldkit/vite-plugin` `0.19.x`, `@foldkit/oxlint-plugin` `0.9.x`, Oxlint, Oxfmt, Vitest, Bun tests, and release-please.

**Spec:** `docs/superpowers/specs/2026-08-30-foldkit-0-155-migration-design.md`

## Global Constraints

- Target `foldkit@0.155.0`, Effect `4.0.0-rc.112`, and the matching `@effect/platform-browser` release.
- Use a `@foldkit/vite-plugin` release whose peer metadata accepts FoldKit 0.155 and Effect `rc.112`; verify the selected `0.19.x` metadata during installation.
- Use a 0.155-compatible `@foldkit/oxlint-plugin` line and remove `foldkit/message-binding-matches-tag`.
- Replace `m`, `r`, and `ts` with `defineMessageUnion`, `defineRouteUnion`, and `defineTaggedUnion` without compatibility aliases.
- Match FoldKit-owned unions through their own `.match`; retain Effect `Match` for non-FoldKit unions and partial matches.
- Convert FoldKit result producers and consumers to records; omit statically absent `commands` and never write literal `commands: []`.
- Keep tuple-shaped chart domains, coordinate pairs, ranges, and other numeric data unchanged.
- Convert `Mount.define` and `Mount.defineStream` call sites to named configuration objects and ensure every mount uses `element`.
- Keep request cancellation state, interrupt keys, and policies in `apps/web`; Astro continues to provide lifecycle facts only.
- Keep `@opsydyn/foldkit-viz` free of FoldKit, Astro, Commands, request context, and server-rendering runtime imports.
- Use static imports for package-owned runtime dependencies. Preserve only existing literal user-module loaders such as `() => import('./main')`.
- Build package artifacts before running the web app’s Astro typecheck, and use Oxlint/Oxfmt rather than Biome.
- Do not rewrite historical migration specs or plans, hand-edit generated changelogs, or add unused 0.155 APIs.

## File Ownership Map

The migration is intentionally broad in `apps/web` because the demo contains
58 application message modules, 48 message-bearing UI modules, 58 application
updates, and 48 UI primitive init/update implementations.

- **Dependency and lint boundary:** `package.json`, `apps/web/package.json`, `packages/astro-foldkit/package.json`, `packages/foldkit-viz/package.json`, `bun.lock`, and `oxlint.config.ts`.
- **Application messages and runtime:** `apps/web/src/apps/*/message.ts`, `apps/web/src/apps/*/{main,model,update,view,subscription,command}.ts`, and the matching `*.test.ts`/`*.story.test.ts` files.
- **UI messages, mounts, and primitive runtime:** `apps/web/src/ui/*/index.ts`, with the five mount files `bar-chart`, `area-chart`, `line-chart`, `scatter-chart`, and `histogram-chart`.
- **Union-specific boundaries:** `apps/web/src/apps/health/{message,model,main,update}.ts` and `apps/web/src/apps/request-diagnostics/{message,model,navigation,update}.ts`.
- **Carousel OutMessage boundary:** `apps/web/src/ui/carousel/index.ts` and `apps/web/src/apps/carousel/{message,update,view,subscription}.ts`.
- **Astro public contract:** `packages/astro-foldkit/src/types.ts`, `src/client.ts`, existing server/client adapters, and `packages/astro-foldkit/test/{unit,integration}/`.
- **Viz compatibility boundary:** `packages/foldkit-viz/test/chart-harness.ts`, `test/foldkit-compatibility.test.ts`, `test/package-import-smoke.test.ts`, and `packages/foldkit-viz/README.md`.
- **Documentation and release metadata:** `AGENTS.md`, `README.md`, `docs/roadmap.md`, both package READMEs, and the release-please manifest/configuration.

Generated `dist` output is produced by package builds and is not hand-edited.

---

### Task 1: Establish the 0.155 dependency and lint floor

**Files:**
- Modify: `package.json`
- Modify: `apps/web/package.json`
- Modify: `packages/astro-foldkit/package.json`
- Modify: `packages/foldkit-viz/package.json`
- Modify: `oxlint.config.ts`
- Modify: `bun.lock`

**Interfaces:**
- Consumes: the current workspace ranges (`foldkit ^0.148.0`, Effect `rc.109`, Vite plugin `0.16.x`, and Oxlint plugin `0.3.x`).
- Produces: one installed FoldKit `0.155.0` line, Effect `rc.112` line, compatible Vite/Oxlint plugins, and package peer floors that reject older incompatible APIs.

- [ ] **Step 1: Record the current baseline.** Run each command without modifying files:

  ```sh
  bun typecheck
  bun run check
  bun test
  ```

  Record each exit status and the current diagnostic counts in the implementation notes. Treat these results as baseline evidence; do not repair unrelated pre-existing diagnostics in this task.

- [ ] **Step 2: Update direct dependencies.** Set the exact app/runtime versions and compatible tooling with the workspace package manager:

  ```sh
  bun add --cwd apps/web foldkit@0.155.0 effect@4.0.0-rc.112 @effect/platform-browser@4.0.0-rc.112 @foldkit/vite-plugin@^0.19.0
  bun add --cwd packages/astro-foldkit effect@4.0.0-rc.112 @foldkit/vite-plugin@^0.19.0
  bun add --cwd packages/astro-foldkit --dev foldkit@0.155.0
  bun add --cwd packages/foldkit-viz --dev effect@4.0.0-rc.112 foldkit@0.155.0
  bun add --dev @foldkit/oxlint-plugin@^0.9.0
  ```

- [ ] **Step 3: Raise peer ranges without changing package versions yet.** Set `packages/astro-foldkit` to `foldkit >=0.155.0 <0.156.0`, and set `packages/foldkit-viz` to the same FoldKit floor plus `effect >=4.0.0-rc.112 <5.0.0`. Leave the package versions for the release task.

- [ ] **Step 4: Replace obsolete lint configuration.** Remove `foldkit/message-binding-matches-tag` from `oxlint.config.ts` and add `foldkit/mount-factory-must-use-element` at error severity. Keep the existing no-empty-constructor rule at error severity.

- [ ] **Step 5: Install and verify metadata.** Run `bun install`, then inspect the resolved versions:

  ```sh
  bun pm ls | rg 'foldkit@|effect@|@effect/platform-browser|@foldkit/vite-plugin|@foldkit/oxlint-plugin'
  npm view @foldkit/vite-plugin@0.19.0 peerDependencies
  npm view @foldkit/oxlint-plugin@0.9.0 version
  ```

  Expected: FoldKit resolves to `0.155.0`, Effect packages resolve to `4.0.0-rc.112`, the Vite plugin peer metadata accepts both, and no old binding/tag rule is configured.

- [ ] **Step 6: Commit the dependency boundary.**

  ```sh
  git add package.json apps/web/package.json packages/astro-foldkit/package.json packages/foldkit-viz/package.json oxlint.config.ts bun.lock
  git commit -m "build: align workspace with FoldKit 0.155"
  ```

### Task 2: Migrate application message declarations

**Files:**
- Create: `apps/web/src/apps/health/message.test.ts`
- Modify: `apps/web/src/apps/*/message.ts` (58 application message modules)
- Modify: application files importing named message constructors under `apps/web/src/apps/`

**Interfaces:**
- Consumes: `defineMessageUnion` from `foldkit/message` and the existing message field schemas.
- Produces: one `Message` namespace per application message module, with callable no-field constructors and `typeof Message.Type` message types.

- [ ] **Step 1: Write the failing namespace contract test.** Add a small test proving the target constructor shape:

  ```ts
  import { describe, expect, it } from 'bun:test';

  import { Message } from './message';

  describe('health message union', () => {
    it('owns constructors and omits an empty call argument', () => {
      expect(Message.TickedFrame({ deltaTimeMs: 16 })).toEqual({
        _tag: 'TickedFrame',
        deltaTimeMs: 16,
      });
      expect(Message.FetchedHealth({
        status: 'ok',
        uptimeSeconds: 1,
        startedAt: '2026-01-01T00:00:00.000Z',
        timestamp: '2026-01-01T00:00:01.000Z',
      })._tag).toBe('FetchedHealth');
    });
  });
  ```

- [ ] **Step 2: Run the contract test to verify the old API fails.**

  ```sh
  bun test apps/web/src/apps/health/message.test.ts
  ```

  Expected: FAIL because the current `Message` value has no namespace-owned constructors.

- [ ] **Step 3: Convert application message modules.** For every `apps/web/src/apps/*/message.ts` file, replace `m` and `Schema.Union` with a single declaration:

  ```ts
  import { defineMessageUnion } from 'foldkit/message';

  export const Message = defineMessageUnion({
    FetchedHealth: {
      status: Schema.String,
      uptimeSeconds: Schema.Number,
      startedAt: Schema.String,
      timestamp: Schema.String,
    },
    FetchFailed: { error: Schema.String },
    TickedFrame: { deltaTimeMs: Schema.Number },
  });

  export type Message = typeof Message.Type;
  ```

  Preserve every existing tag and field schema. Keep `Schema.Unknown` for `Result` and child-message payloads; do not widen those fields to `any`.

- [ ] **Step 4: Convert overridden message types.** In `apps/web/src/apps/carousel/message.ts`, keep the type-safe overrides while taking the constructor type from the namespace:

  ```ts
  export const Message = defineMessageUnion({
    GotCarouselMessage: { message: Schema.Unknown },
    SettledSlides: { result: Schema.Unknown },
  });

  export type GotCarouselMessage = Omit<
    typeof Message.GotCarouselMessage.Type,
    'message'
  > & { readonly message: CarouselMessage };

  export type SettledSlides = Omit<
    typeof Message.SettledSlides.Type,
    'result'
  > & { readonly result: Result.Result<ReadonlyArray<Slide>, string> };
  ```

- [ ] **Step 5: Migrate application message call sites.** Remove named value imports such as `FetchedHealth` and use `Message.FetchedHealth(...)` at construction sites. Update local no-field calls from `Variant({})` to `Message.Variant()`. Keep type-only imports when a file needs only `type Message`.

- [ ] **Step 6: Run the focused test and stale-helper search.**

  ```sh
  bun test apps/web/src/apps/health/message.test.ts
  rg -n --glob '*.ts' "from ['\"]foldkit/message['\"]|\bm\(" apps/web/src/apps
  ```

  Expected: the contract test passes; the search returns no application `m` import or declaration. Remaining failures should identify stale call sites for the next task, not hidden compatibility aliases.

- [ ] **Step 7: Commit the application message migration.**

  ```sh
  git add apps/web/src/apps
  git commit -m "refactor: namespace application FoldKit messages"
  ```

### Task 3: Migrate UI message namespaces and constructor consumers

**Files:**
- Modify: `apps/web/src/ui/*/index.ts` (48 message-bearing UI modules)
- Modify: `apps/web/src/apps/*/{view,update,model,subscription}.ts` where UI constructors are used
- Modify: `apps/web/src/stories/charts-primitives.stories.ts`
- Modify: `apps/web/src/stories/mount.ts`

**Interfaces:**
- Consumes: application `Message` namespaces from Task 2 and `defineMessageUnion`.
- Produces: UI modules exposing `Message` and, where applicable, a separate `OutMessage` namespace; chart consumers construct values through `Chart.Message.Variant()`.

- [ ] **Step 1: Convert each UI message declaration.** Replace patterns such as:

  ```ts
  export const HoveredBar = m('HoveredBar', { index: Schema.Number });
  export const BlurredBar = m('BlurredBar', {});
  export const Message = Schema.Union([HoveredBar, BlurredBar]);
  ```

  with:

  ```ts
  export const Message = defineMessageUnion({
    HoveredBar: { index: Schema.Number },
    BlurredBar: {},
  });
  export type Message = typeof Message.Type;
  ```

  For `apps/web/src/ui/carousel/index.ts`, define `Message` and `OutMessage` independently so the child input and parent-facing output remain separate unions.

- [ ] **Step 2: Migrate UI-owned call sites.** Change local constructors to `Message.Variant(...)`. Change app call sites from `BarChart.HoveredBar(...)` to `BarChart.Message.HoveredBar(...)`, and change no-field calls to no-argument form. Do not change tuple-valued chart data such as `[cx, cy]` or `[min, max]`.

- [ ] **Step 3: Update Storybook helper types.** Change `apps/web/src/stories/mount.ts` from tuple-shaped `init`/`update` signatures to record-shaped results:

  ```ts
  type FoldkitAppConfig = {
    Model: unknown;
    init: (...args: ReadonlyArray<unknown>) => {
      readonly model: unknown;
      readonly commands?: ReadonlyArray<unknown>;
    };
    update: (model: unknown, message: unknown) => {
      readonly model: unknown;
      readonly commands?: ReadonlyArray<unknown>;
    };
    view: (model: unknown, h: HtmlBuilder<unknown>) => Document;
  };
  ```

  Keep the `makeApplication` wrapper’s `init: () => config.init(initProps)` behavior unchanged.

- [ ] **Step 4: Update Storybook primitive stories.** In `apps/web/src/stories/charts-primitives.stories.ts`, replace each positional read with record access:

  ```ts
  const { model: model0 } = BarChart.init({ bars: SAMPLE_BARS, config: ... });
  return mountChart(
    () => ({ model: model0 }),
    BarChart.update,
    (model, h) => BarChart.view({ model, toParentMessage: (m) => m }, h),
  );
  ```

  The story helper must not manufacture `commands: []` for a primitive that has no commands.

- [ ] **Step 5: Run UI stale-API searches.**

  ```sh
  rg -n --glob '*.ts' "from ['\"]foldkit/message['\"]|\bm\(|\.Hovered[A-Za-z]+\(|\.Blurred[A-Za-z]+\(" apps/web/src/ui apps/web/src/apps apps/web/src/stories
  ```

  Expected: no old message helper or unnamespaced UI constructor remains; remaining tuple diagnostics are confined to the runtime-record tasks.

- [ ] **Step 6: Commit the UI message migration.**

  ```sh
  git add apps/web/src/ui apps/web/src/apps apps/web/src/stories
  git commit -m "refactor: namespace FoldKit UI messages"
  ```

### Task 4: Convert tagged states, routes, and FoldKit matchers

**Files:**
- Modify: `apps/web/src/apps/health/model.ts`
- Modify: `apps/web/src/apps/health/update.ts`
- Modify: `apps/web/src/apps/request-diagnostics/model.ts`
- Modify: `apps/web/src/apps/request-diagnostics/navigation.ts`
- Modify: `apps/web/src/apps/request-diagnostics/update.ts`
- Modify: `apps/web/src/apps/request-diagnostics/view.ts`
- Modify: `apps/web/src/apps/*/update.ts`
- Modify: `apps/web/src/ui/*/index.ts`
- Modify: `apps/web/src/apps/request-diagnostics/{navigation,machine,main.scene}.test.ts`

**Interfaces:**
- Consumes: namespace-owned message values from Tasks 2 and 3.
- Produces: `HealthState`, `ExplorerState`, URL-route, and normalized-route namespaces plus exhaustive union `.match` handlers.

- [ ] **Step 1: Add state-constructor assertions to existing tests.** Extend the request-diagnostics navigation/state tests with constructor checks:

  ```ts
  expect(ExplorerState.Loading()).toEqual({ _tag: 'Loading' });
  expect(ExplorerState.Cancelling({ reason: 'RouteExit' })).toEqual({
    _tag: 'Cancelling',
    reason: 'RouteExit',
  });
  ```

- [ ] **Step 2: Replace the health union.** In `apps/web/src/apps/health/model.ts`, define the model state as one `defineTaggedUnion` value and derive `Loaded` from its namespace type when the optic needs that narrowed shape:

  ```ts
  export const HealthState = defineTaggedUnion({
    Loading: {},
    Failed: { error: Schema.String },
    Loaded: {
      data: HealthData,
      elapsedMs: Schema.Number,
      sinceLabel: Schema.String,
    },
  });
  export type HealthState = typeof HealthState.Type;
  export type Loaded = typeof HealthState.Loaded.Type;
  export const Model = HealthState;
  export type Model = typeof Model.Type;
  export const init: Model = HealthState.Loading();
  ```

  Update `health/main.ts`, `health/update.ts`, and `health/view.ts` to use `HealthState.Loaded(...)`, `HealthState.Failed(...)`, and `HealthState.Loading()`.

- [ ] **Step 3: Replace request-diagnostics `ts` declarations.** In `apps/web/src/apps/request-diagnostics/model.ts`, replace the seven `ts` values and `Schema.Union` with `ExplorerState = defineTaggedUnion({...})`. Preserve every field and tag. Update every constructor in request-diagnostics source/tests to `ExplorerState.Idle()`, `ExplorerState.Loading()`, `ExplorerState.Cancelling({ reason })`, and so on.

- [ ] **Step 4: Replace request-diagnostics routes.** In `navigation.ts`, define separate raw and normalized unions:

  ```ts
  export const DiagnosticsUrlRoute = defineRouteUnion({
    Index: {},
    NotFound: { path: Schema.String },
    Path: { path: Schema.NonEmptyArray(Schema.String) },
  });
  export type DiagnosticsUrlRoute = typeof DiagnosticsUrlRoute.Type;

  export const DiagnosticsRoute = defineTaggedUnion({
    Index: {},
    Document: { repository: Schema.String, document: Schema.String },
  });
  export type DiagnosticsRoute = typeof DiagnosticsRoute.Type;
  ```

  Use `DiagnosticsUrlRoute.Index`, `DiagnosticsUrlRoute.Path`, and `DiagnosticsUrlRoute.NotFound` with `mapTo` and `parseUrlWithFallback`. Return `DiagnosticsRoute.Document({...})` or `DiagnosticsRoute.Index()` from normalization. Preserve current URL strings and fallback behavior.

- [ ] **Step 5: Replace FoldKit message matchers.** For every app/UI update whose `message` is a `defineMessageUnion` value, use the namespace matcher:

  ```ts
  export const update = (model: Model, message: Message): Return =>
    Message.match<Return>(message, {
      ClickedReload: () => ({ model }),
      SettledMetrics: ({ result: raw }) => ({ model: settleModel(model, raw) }),
    });
  ```

  For the health and request-diagnostics tagged states, use `HealthState.match` and `ExplorerState.match` when matching those values. Retain `Match.value(...).pipe(...)` only for Effect unions that are not owned by a FoldKit union namespace.

- [ ] **Step 6: Update nested constructors and raw fixtures.** Use `Navigation.UrlRequest.Internal` and `Interruptible.Outcome.Interrupted`/`NotFound` constructors where values are constructed. Keep raw `_tag` objects only in tests that intentionally represent wire data.

- [ ] **Step 7: Run union tests and searches.**

  ```sh
  bun test apps/web/src/apps/health apps/web/src/apps/request-diagnostics
  rg -n --glob '*.ts' "\bfrom ['\"]foldkit/schema['\"]|\bts\(|\br\(|Match\.tagsExhaustive" apps/web/src
  ```

  Expected: no `ts`/`r` declarations remain, and `Match.tagsExhaustive` is not used to match a union now owned by `Message`, `HealthState`, `ExplorerState`, `DiagnosticsRoute`, or `DiagnosticsUrlRoute`.

- [ ] **Step 8: Commit the union migration.**

  ```sh
  git add apps/web/src/apps apps/web/src/ui
  git commit -m "refactor: adopt FoldKit 0.155 union namespaces"
  ```

### Task 5: Migrate the five chart mounts

**Files:**
- Modify: `apps/web/src/ui/bar-chart/index.ts`
- Modify: `apps/web/src/ui/area-chart/index.ts`
- Modify: `apps/web/src/ui/line-chart/index.ts`
- Modify: `apps/web/src/ui/scatter-chart/index.ts`
- Modify: `apps/web/src/ui/histogram-chart/index.ts`

**Interfaces:**
- Consumes: each module’s `Message.RecordedChartBounds` or `Message.RecordedSvgBounds` constructor from Tasks 3 and 4.
- Produces: 0.155 `Mount.define` configuration objects with an element-aware `execute` function and the same emitted messages.

- [ ] **Step 1: Convert each positional mount.** Use this shape for the four chart-bound mounts:

  ```ts
  export const CaptureChartBounds = Mount.define('CaptureChartBounds', {
    messages: [Message.RecordedChartBounds],
    execute: ({ element }) =>
      Effect.sync(() => {
        const rect = element.getBoundingClientRect();
        return Message.RecordedChartBounds({
          screenLeft: rect.left + window.screenX,
          renderedPW: rect.width,
        });
      }),
  });
  ```

  Use `Message.RecordedSvgBounds` and the existing `clientLeft` field for the histogram mount. Preserve the existing viewport calculations and message fields.

- [ ] **Step 2: Verify the new mount lint boundary.** Run Oxlint against the five files:

  ```sh
  NODE_OPTIONS="--experimental-strip-types" bunx oxlint \
    apps/web/src/ui/bar-chart/index.ts \
    apps/web/src/ui/area-chart/index.ts \
    apps/web/src/ui/line-chart/index.ts \
    apps/web/src/ui/scatter-chart/index.ts \
    apps/web/src/ui/histogram-chart/index.ts
  ```

  Expected: `foldkit/mount-factory-must-use-element` reports no diagnostics and no old mount call shape remains.

- [ ] **Step 3: Search for old mount forms.**

  ```sh
  rg -n --glob '*.ts' "Mount\.define\(|Mount\.defineStream\(" apps/web/src/ui
  ```

  Inspect each result and confirm the second argument is the named config object, not a Message schema.

- [ ] **Step 4: Commit the mount migration.**

  ```sh
  git add apps/web/src/ui/bar-chart/index.ts apps/web/src/ui/area-chart/index.ts apps/web/src/ui/line-chart/index.ts apps/web/src/ui/scatter-chart/index.ts apps/web/src/ui/histogram-chart/index.ts
  git commit -m "refactor: migrate chart mounts to FoldKit 0.155"
  ```

### Task 6: Convert UI primitive init/update results to records

**Files:**
- Create: `apps/web/src/ui/record-contract.test.ts`
- Modify: `apps/web/src/ui/*/index.ts` (all 48 UI primitive modules)

**Interfaces:**
- Consumes: 0.155 `Update.Return` and the namespace message types from previous tasks.
- Produces: chart primitive `init` and `update` functions that return `{ model }` when they have no commands and preserve all existing model transitions.

- [ ] **Step 1: Write the failing record contract test.** Add a focused test for a representative primitive:

  ```ts
  import { describe, expect, it } from 'bun:test';

  import * as BarChart from './bar-chart';

  describe('chart primitive runtime contract', () => {
    it('returns records and omits statically absent commands', () => {
      const initialized = BarChart.init({ bars: [{ label: 'A', value: 1 }] });
      expect(initialized).toHaveProperty('model');
      expect('commands' in initialized).toBe(false);

      const updated = BarChart.update(initialized.model, BarChart.Message.BlurredBar());
      expect(updated).toEqual({ model: initialized.model });
    });
  });
  ```

- [ ] **Step 2: Run the test against tuple implementations.**

  ```sh
  bun test apps/web/src/ui/record-contract.test.ts
  ```

  Expected: FAIL because the current primitive APIs return arrays.

- [ ] **Step 3: Convert every primitive initializer.** Replace `readonly [Model, readonly []]` return annotations and `[model, []]` returns with records:

  ```ts
  export function init(cfg: InitConfig): { readonly model: Model } {
    const layout = makeLayout(...);
    return {
      model: {
        bars: cfg.bars,
        activeIndex: Option.none(),
        config: { ...DEFAULT_CONFIG, ...cfg.config },
        layout,
        svgBounds: Option.none(),
      },
    };
  }
  ```

  For display-only primitives, return `{ model }` and do not include a literal commands property.

- [ ] **Step 4: Convert every primitive updater.** Replace tuple return annotations with `Update.Return<Model, Message>` or an equivalent inferred record and return `{ model: nextModel }`. Keep existing `Match`/union matcher changes from Task 4 and preserve all chart math.

- [ ] **Step 5: Run primitive tests and typecheck.**

  ```sh
  bun test apps/web/src/ui/record-contract.test.ts
  bun run --filter @opsydyn/web typecheck
  ```

  Expected: the new record test passes; typecheck may still report application composition tuple consumers, which are handled in Task 7.

- [ ] **Step 6: Commit the primitive record migration.**

  ```sh
  git add apps/web/src/ui
  git commit -m "refactor: return records from chart primitives"
  ```

### Task 7: Convert application runtime records and carousel OutMessage composition

**Files:**
- Create: `apps/web/src/ui/carousel/update.test.ts`
- Modify: `apps/web/src/apps/*/{main,model,update}.ts`
- Modify: `apps/web/src/apps/*/*.test.ts`, `*.story.test.ts`, and `*.scene.test.ts`
- Modify: `apps/web/src/apps/carousel/{message,update}.ts`
- Modify: `apps/web/src/ui/carousel/index.ts`
- Modify: `apps/web/src/apps/request-diagnostics/{update,machine}.ts`
- Modify: `apps/web/src/apps/linked-charts/update.ts`
- Modify: `apps/web/src/apps/histogram-brush/update.ts`

**Interfaces:**
- Consumes: record-returning UI primitives from Task 6 and 0.155 `Update.Return`/`ReturnWithOutMessage`.
- Produces: record-shaped app init/update functions, explicit carousel child folding, and unchanged request-exit cancellation behavior.

- [ ] **Step 1: Write the failing carousel OutMessage test.** Add a direct child contract test:

  ```ts
  import { describe, expect, it } from 'bun:test';

  import { Message } from './carousel';
  import { init, update } from './carousel';

  describe('carousel OutMessage', () => {
    it('returns a direct OutMessage when navigation changes the slide', () => {
      const result = update(init({ id: 'test', slideCount: 3, loop: false }), Message.ClickedNext());
      expect(result.model.activeIndex).toBe(1);
      expect(result.outMessage?._tag).toBe('ChangedSlide');
      expect('commands' in result).toBe(false);
    });
  });
  ```

- [ ] **Step 2: Run the child test against the tuple implementation.**

  ```sh
  bun test apps/web/src/ui/carousel/update.test.ts
  ```

  Expected: FAIL because the child currently returns the third tuple slot as an `Option`.

- [ ] **Step 3: Convert application initializers.** Update all `apps/web/src/apps/*/main.ts` and model-level `init` functions:

  ```ts
  export const init: Runtime.ApplicationInit<typeof Model.Type, typeof Message.Type> = () => ({
    model: initialModel,
    commands: [FetchHealth()],
  });
  ```

  Use `{ model: initialModel }` for no-command initialization. Keep computed command arrays as `commands` even when they may be empty. Update `counter`, `health`, `request-diagnostics`, and every chart demo explicitly; do not globally replace numeric tuples.

- [ ] **Step 4: Convert application update returns and child consumers.** In all `apps/web/src/apps/*/update.ts` files, use `Update.Return<Model, Message>` and return records. Replace child reads such as `const [chart] = Chart.update(...)` with `const chartResult = Chart.update(...); chartResult.model`. Use `.commands ?? []` only when forwarding commands, and use `Update.combine` when a later step depends on the model from an earlier step.

- [ ] **Step 5: Convert request-diagnostics machine results without changing policy.** Change `runMachine` and every caller from tuple reads to `.model`/`.commands`. Keep `Machine.step` because the UI displays `Transitioned` versus `Ignored`. Preserve the route-exit cancellation-intent check and ensure an interrupt result cannot enqueue a replacement `FetchMetrics` command.

- [ ] **Step 6: Convert carousel child output explicitly.** In `apps/web/src/ui/carousel/index.ts`, use `Update.ReturnWithOutMessage<Model, Message, OutMessage>`, omit `outMessage` when absent, and include `outMessage: Message` directly when a slide changes. Use `OutMessage.ChangedSlide({ index })` from the separate OutMessage namespace.

  In `apps/web/src/apps/carousel/update.ts`, replace positional child destructuring with `Update.foldChild`. The parent app has no outward OutMessage channel, so consume the child output through an exhaustive explicit no-op step:

  ```ts
  import { foldChild } from 'foldkit/update';

  const foldCarousel = foldChild({
    update: Carousel.update,
    read: (model) => Option.some(model.carousel),
    write: (model, nextCarousel) => ({ ...model, carousel: nextCarousel }),
    toParentMessage: (message) => Message.GotCarouselMessage({ message }),
    foldOutMessage: (outMessage) =>
      Carousel.OutMessage.match(outMessage, {
        ChangedSlide: () => (model) => ({ model }),
      }),
  });
  ```

  The explicit `ChangedSlide` branch records that the parent has no additional state or command to derive, while preventing the child result from being silently discarded.

- [ ] **Step 7: Convert all tests and story fixtures.** Replace tuple destructuring with `result.model`, `result.commands ?? []`, and `result.outMessage` assertions. Update expected values from `[{ model }, []]` to `{ model }` where commands are statically absent.

- [ ] **Step 8: Run focused application tests.**

  ```sh
  bun test apps/web/src/apps/carousel apps/web/src/apps/request-diagnostics apps/web/src/apps/health
  bun test apps/web/src/ui/carousel/update.test.ts apps/web/src/ui/record-contract.test.ts
  ```

  Expected: the child output test, application tests, and request-diagnostics cancellation tests pass with record results.

- [ ] **Step 9: Confirm tuple migration scope.**

  ```sh
  rg -n --glob '*.ts' "readonly \[Model|const \[[^]]+\] = .*\.(init|update)|\[model, \[\]\]|\[model, commands\]" apps/web/src
  ```

  Inspect every remaining result. Only numeric/chart data tuples may remain; no FoldKit init/update return or consumer may remain tuple-shaped.

- [ ] **Step 10: Commit application records and OutMessage handling.**

  ```sh
  git add apps/web/src/apps apps/web/src/ui/carousel
  git commit -m "refactor: migrate application updates to records"
  ```

### Task 8: Update the Astro public AppConfig contract and fixtures

**Files:**
- Modify: `packages/astro-foldkit/src/types.ts`
- Modify: `packages/astro-foldkit/src/client.ts`
- Modify: `packages/astro-foldkit/src/server-render.ts` only if 0.155 type inference requires an adapter annotation
- Modify: `packages/astro-foldkit/test/unit/client.test.ts`
- Modify: `packages/astro-foldkit/test/unit/server.test.ts`
- Modify: `packages/astro-foldkit/test/unit/server-render.test.ts`
- Modify: `packages/astro-foldkit/test/unit/server-document.test.ts`
- Modify: `packages/astro-foldkit/test/unit/define-app.test.ts`
- Modify: `packages/astro-foldkit/test/unit/define-page.test.ts`
- Modify: `packages/astro-foldkit/test/integration/package-import-smoke.test.ts`

**Interfaces:**
- Consumes: 0.155 `Update.Return` record and existing server/client adapters.
- Produces: type-safe `AppConfig`, `AppConfigShape`, page config, client model inference, and packed consumer fixtures that accept records and reject tuples.

- [ ] **Step 1: Add a record-shaped packed consumer fixture.** In `package-import-smoke.test.ts`, change the synthetic page config from:

  ```ts
  init: (flags: Flags) => [flags, []] as const,
  update: (model: Model, _message: Message) => [model, []] as const,
  ```

  to:

  ```ts
  init: (flags: Flags) => ({ model: flags }),
  update: (model: Model, _message: Message) => ({ model }),
  ```

  Keep the existing public imports from `@opsydyn/astro-foldkit`, `/define-page`, and `/server`.

- [ ] **Step 2: Run the fixture before changing package types.**

  ```sh
  bun test packages/astro-foldkit/test/integration/package-import-smoke.test.ts
  ```

  Expected: FAIL on the current tuple-shaped `AppConfigShape`/`PageConfigShape` declarations.

- [ ] **Step 3: Change the structural AppConfig result types.** In `packages/astro-foldkit/src/types.ts`, replace tuple result types with the 0.155 record contract. Keep `commands` optional and preserve the generic props/model/message relationships:

  ```ts
  type AppReturn<Model> = Readonly<{
    readonly model: Model;
    readonly commands?: CommandBatch;
  }>;

  export type AppConfigShape<Props extends Record<string, unknown>> = {
    readonly Model: unknown;
    readonly init: (props: Props) => AppReturn<unknown>;
    readonly update: (model: never, message: never) => AppReturn<unknown>;
    readonly view: (model: never, h: never) => Document;
    readonly navigation?: NavigationConfig<unknown>;
    readonly ports?: Record<string, unknown>;
  };
  ```

  Use this structural record in both `AppConfigShape` and the concrete `AppConfig` init signature. The observable contract is `{ model, commands? }`, with no tuple fallback; the runtime-anchored `update` signature remains `Runtime.ApplicationConfig<Model, Message>['update']`.

- [ ] **Step 4: Update concrete AppConfig and page config types.** Make `init` return `AppReturn<Model>` and keep `update`/`view` anchored to `Runtime.ApplicationConfig<Model, Message>`. Keep `Flags` as the codec in `PageConfig`; do not introduce a second server data-loading API.

- [ ] **Step 5: Fix client model inference.** Change `ConfigModel` in `packages/astro-foldkit/src/client.ts` from `ReturnType<Config['init']>[0]` to `ReturnType<Config['init']>['model']`. Leave page hydration, `defineApp` embed behavior, navigation forwarding, and disposal behavior unchanged.

- [ ] **Step 6: Update Astro fixture expectations.** Change client test doubles and assertions such as `[{ count: 3 }, []]` to `{ model: { count: 3 } }`. Replace tuple type casts in the fixture runtime with record-shaped casts. Keep server document and renderer tests focused on existing SSR/hydration behavior.

- [ ] **Step 7: Build the package before consumer typecheck.**

  ```sh
  bun run --filter @opsydyn/astro-foldkit build
  bun test packages/astro-foldkit/test/unit packages/astro-foldkit/test/integration/package-import-smoke.test.ts
  bun run --filter @opsydyn/astro-foldkit typecheck
  ```

  Expected: the Astro package builds and its public packed consumer resolves records through root, `define-page`, and `server` exports.

- [ ] **Step 8: Commit the Astro boundary migration.**

  ```sh
  git add packages/astro-foldkit/src packages/astro-foldkit/test
  git commit -m "refactor: align Astro FoldKit config with records"
  ```

### Task 9: Update viz compatibility fixtures and current documentation

**Files:**
- Modify: `packages/foldkit-viz/test/chart-harness.ts`
- Modify: `packages/foldkit-viz/test/foldkit-compatibility.test.ts`
- Modify: `packages/foldkit-viz/test/package-import-smoke.test.ts` only for record fixture assertions
- Modify: `packages/foldkit-viz/README.md`
- Modify: `packages/astro-foldkit/README.md`
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `docs/roadmap.md`

**Interfaces:**
- Consumes: the record contract and package ranges from Tasks 1, 6, and 8.
- Produces: documentation that matches FoldKit 0.155 and a pure viz package whose tests prove compatibility without adding runtime dependencies.

- [ ] **Step 1: Convert the viz chart harness.** In `packages/foldkit-viz/test/chart-harness.ts`, replace tuple input/output types with:

  ```ts
  type ChartUpdateResult<Model> = {
    readonly model: Model;
    readonly commands?: ReadonlyArray<unknown>;
  };

  export function runChart<Model, Message>(
    initial: ChartUpdateResult<Model>,
    update: (model: Model, message: Message) => ChartUpdateResult<Model>,
    messages: ReadonlyArray<Message>,
  ): ChartHarnessResult<Model> {
    let model = initial.model;
    const history: Model[] = [];
    for (const message of messages) {
      model = update(model, message).model;
      history.push(model);
    }
    return { model, history };
  }
  ```

  Keep `readonly [number, number]` range types unchanged.

- [ ] **Step 2: Update the compatibility test.** Rename the description from FoldKit 0.148 to 0.155 and add a record contract assertion using `Update.Return` or an equivalent structural record. Keep the existing `TextDirection` compatibility assertion unchanged.

- [ ] **Step 3: Update package documentation.** In the Astro README, replace tuple examples with `{ model }`/`{ model, commands }` and update the compatibility line to FoldKit 0.155 and the compatible Vite plugin. In the viz README, update the compatibility statement while explicitly retaining the no-Astro/no-server/no-runtime boundary.

- [ ] **Step 4: Update repository guidance.** Change the stale FoldKit version in `AGENTS.md`, add the 0.155 namespace constructor and record-return examples, document `Mount.define`’s `execute: ({ element })` shape, and keep the existing static-import and no-inline-runtime guidance. Update `README.md` and `docs/roadmap.md` only where current package capabilities or compatibility ranges are described.

- [ ] **Step 5: Prove the viz boundary.**

  ```sh
  rg -n --glob '*.ts' "from ['\"]foldkit['\"]|from ['\"]foldkit/|from ['\"]@opsydyn/astro-foldkit" packages/foldkit-viz/src
  bun test packages/foldkit-viz/test
  bun run --filter @opsydyn/foldkit-viz typecheck
  ```

  Expected: the source search returns no runtime imports and all viz tests pass with the record harness.

- [ ] **Step 6: Commit compatibility fixtures and docs.**

  ```sh
  git add packages/foldkit-viz/test packages/foldkit-viz/README.md packages/astro-foldkit/README.md AGENTS.md README.md docs/roadmap.md
  git commit -m "docs: update FoldKit 0.155 guidance"
  ```

### Task 10: Run repository gates and prepare the coordinated release

**Files:**
- Modify through release tooling: `packages/astro-foldkit/package.json`, `packages/foldkit-viz/package.json`, `.release-please-manifest.json`, generated changelogs/release notes
- Inspect: `package.json`, `apps/web/package.json`, `packages/astro-foldkit/package.json`, `packages/foldkit-viz/package.json`, `oxlint.config.ts`, and `bun.lock`

**Interfaces:**
- Consumes: all migrated source, tests, docs, and dependency metadata from Tasks 1-9.
- Produces: verified packed artifacts and release-please-ready package minors `@opsydyn/astro-foldkit@0.7.0` and `@opsydyn/foldkit-viz@0.9.0`.

- [ ] **Step 1: Run focused package checks.**

  ```sh
  bun run --filter @opsydyn/astro-foldkit test:unit
  bun run --filter @opsydyn/astro-foldkit test:integration
  bun run --filter @opsydyn/foldkit-viz test
  bun run --filter @opsydyn/astro-foldkit typecheck
  bun run --filter @opsydyn/foldkit-viz typecheck
  ```

  Expected: both package workspaces pass independently before the web consumer is checked.

- [ ] **Step 2: Run the full repository gates.**

  ```sh
  bun run check
  bun typecheck
  bun test
  bun run build
  bun run build-storybook
  ```

  Resolve migration-specific Oxlint errors and Oxfmt changes. Do not add Biome commands or suppress a new FoldKit diagnostic. Report any unrelated baseline diagnostics separately.

- [ ] **Step 3: Verify the packed package surfaces.** Run the existing package smoke tests and inspect the dry-run contents:

  ```sh
  bun test packages/astro-foldkit/test/integration/package-import-smoke.test.ts
  bun test packages/foldkit-viz/test/package-import-smoke.test.ts
  # Run from packages/astro-foldkit
  bun pm pack --dry-run
  # Run from packages/foldkit-viz
  bun pm pack --dry-run
  ```

  Confirm `@opsydyn/astro-foldkit` exposes its root, `define-app`, `define-page`, and `server` entries, and that no generated package entry points to a tuple-only type or a server module in the client bundle.

- [ ] **Step 4: Review migration searches and behavior evidence.**

  ```sh
  rg -n --glob '*.ts' "\bm\(|\br\(|\bts\(|readonly \[Model|Match\.tagsExhaustive|Mount\.define\([^,]+, [A-Za-z]" apps/web/src packages/astro-foldkit/src packages/foldkit-viz/test
  git diff --check
  git status --short --branch
  ```

  The only remaining tuple matches must be data tuples, and the only remaining `Match.tagsExhaustive` uses must be for non-FoldKit Effect unions.

- [ ] **Step 5: Prepare release metadata through release-please.** Use the repository release workflow to set the next package minors to `0.7.0` and `0.9.0`, update `.release-please-manifest.json`, and generate changelog/release notes from the conventional commits. Do not hand-edit generated changelog sections. Confirm the package peer ranges and README compatibility statements in the generated release diff.

- [ ] **Step 6: Commit the release preparation.**

  ```sh
  git add packages/astro-foldkit/package.json packages/foldkit-viz/package.json .release-please-manifest.json packages/astro-foldkit/CHANGELOG.md packages/foldkit-viz/CHANGELOG.md
  git commit -m "chore: prepare FoldKit 0.155 package release"
  ```

## Completion Criteria

- Application and UI message declarations no longer use `m`; route/state declarations no longer use `r` or `ts`.
- FoldKit-owned unions use namespace constructors and exhaustive union `.match` methods.
- All five chart mounts use the 0.155 named `Mount.define` configuration and consume `element`.
- No FoldKit init/update/component result is tuple-shaped; numeric/chart data tuples remain unchanged.
- Carousel returns direct optional `outMessage` records and its parent explicitly folds the child output.
- Request-diagnostics route-exit cancellation behavior is unchanged and covered by tests.
- `astro-foldkit` public AppConfig types and packed fixtures use records, while existing client-only and opt-in server paths remain behaviorally unchanged.
- `foldkit-viz` published source remains free of FoldKit/Astro runtime imports and its compatibility harness consumes records.
- `bun run check`, `bun typecheck`, `bun test`, `bun run build`, and `bun run build-storybook` pass, with unrelated baseline diagnostics clearly separated.
- Packed package exports are verified before release-please produces `astro-foldkit@0.7.0` and `foldkit-viz@0.9.0`.
