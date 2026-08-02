# FoldKit 0.136 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade all workspace consumers to FoldKit 0.136.0, retain the existing Astro and Viz boundaries, and add a locale-aware Greeting island that demonstrates FoldKit Document language and direction updates.

**Architecture:** Land the breaking 0.134-0.136 compatibility work as one atomic green commit: exact peer alignment, render-scoped HtmlBuilder propagation, declarative Commands, and current Scene/Story APIs. Land the Greeting metadata showcase as a second green commit, using the existing Astro island and FoldKit runtime rather than adding package APIs.

**Tech Stack:** Bun workspaces, TypeScript 6, FoldKit 0.136.0, Effect 4.0.0-beta.102, Astro 7.1.1, Vitest, bun:test, Storybook 10, oxlint, oxfmt.

## Global Constraints

- Use `foldkit@^0.136.0` for direct workspace consumers.
- Use `effect@4.0.0-beta.102` and `@effect/platform-browser@4.0.0-beta.102` where required by FoldKit.
- Use `@foldkit/vite-plugin@^0.11.2`.
- Limit published FoldKit peer compatibility to `>=0.136.0 <0.137.0`.
- Pass the render-frame `HtmlBuilder<Message>` through every view boundary; never create or store a global builder.
- Keep `Http.layer` provisioned at each exported HTTP Command Effect boundary.
- Keep request keys, interruption policy, cancellation intent, and FSM state in `apps/web`.
- Keep `@opsydyn/foldkit-viz` pure and framework-free.
- Treat the existing uncommitted 0.130 manifest and lockfile changes as migration input; supersede them without reverting or committing them separately.
- Use `bun run test`, not raw `bun test` at the repository root.
- Run build, typecheck, tests, and dependent builds sequentially because package builds clean shared `dist` output.
- Do not edit generated package versions or changelogs; release-please owns them.

---

### Task 1: Land the Atomic FoldKit 0.136 Compatibility Base

**Files:**

- Modify: `apps/web/package.json`
- Modify: `packages/astro-foldkit/package.json`
- Modify: `packages/foldkit-viz/package.json`
- Modify: `bun.lock`
- Modify: `packages/astro-foldkit/src/types.ts`
- Modify: `packages/astro-foldkit/src/client-helpers.ts`
- Modify: `packages/astro-foldkit/src/client.ts`
- Modify: `packages/astro-foldkit/test/unit/client-helpers.test.ts`
- Modify: `packages/astro-foldkit/test/unit/client.test.ts`
- Modify: `packages/astro-foldkit/test/unit/define-app.test.ts`
- Test: `packages/astro-foldkit/test/integration/package-import-smoke.test.ts`
- Modify: `packages/astro-foldkit/README.md`
- Modify: `packages/foldkit-viz/README.md`
- Modify: `packages/foldkit-viz/test/collect-html.ts`
- Modify: `packages/foldkit-viz/test/collect-html.test.ts`
- Modify: `apps/web/src/stories/mount.ts`
- Modify: `apps/web/src/stories/charts-primitives.stories.ts`
- Modify: `apps/web/src/apps/{animated-bar,arc-diagram,area,bar,box-plot,bubble,bullet,bump,calendar-heatmap,candlestick,carousel,chord,choropleth,color-spaces,correlation-matrix,counter,curve-comparison,density-contour,diverging-bar,diverging-stacked-bar,donut,easing-curves,force-graph,gauge,greeting,health,heatmap,histogram-brush,histogram,line,linked-charts,log-scatter,map-projections,packed-circles,parallel-coords,phyllotaxis,profile,radar,radial-tree,request-diagnostics,sankey,scatter,streamgraph,sunburst,symbol-scatter,threshold-bar,tidy-tree,tile-grid-map,timeline,timestamp,treemap,violin,voronoi-diagram,waterfall,welcome,wind-rose,zoomable-choropleth,zoomable-line}/view.ts`
- Modify: `apps/web/src/ui/{arc-diagram,area-chart,bar-chart,box-plot-chart,bubble-chart,bullet-chart,bump-chart,calendar-heatmap-chart,candlestick-chart,carousel,chord-chart,choropleth-map,color-spaces-chart,correlation-matrix,curve-comparison-chart,density-contour-chart,diverging-bar-chart,diverging-stacked-bar,donut-chart,easing-curves-chart,force-graph,gauge-chart,heatmap-chart,histogram-chart,line-chart,log-scatter-chart,map-projections-chart,packed-circles-chart,parallel-coords-chart,phyllotaxis-chart,radar-chart,radial-tree-chart,sankey-chart,scatter-chart,streamgraph-chart,sunburst-chart,symbol-scatter-chart,threshold-bar-chart,tidy-tree-chart,tile-grid-map,timeline-chart,treemap-chart,violin-chart,voronoi-chart,waterfall-chart,wind-rose-chart,zoomable-choropleth-map,zoomable-line-chart}/index.ts`
- Modify: `apps/web/src/ui/shared/{accessible-table,axes,cursor-tooltip,svg-root,tooltip}.ts`
- Modify: `apps/web/src/apps/{carousel,counter,health,profile,request-diagnostics}/command.ts`
- Modify: `apps/web/src/apps/counter/main.scene.test.ts`
- Modify: `apps/web/src/apps/counter/main.story.test.ts`
- Create: `apps/web/src/apps/health/main.scene.test.ts`
- Modify: `apps/web/src/apps/request-diagnostics/main.scene.test.ts`
- Test: `apps/web/src/apps/{health,request-diagnostics}/command.test.ts`
- Test: `apps/web/src/apps/request-diagnostics/machine.test.ts`

**Interfaces:**

- Consumes: FoldKit `Runtime.ApplicationConfig<Model, Message>['view']`, `HtmlBuilder<Message>`, `Command.define(name, config)`, `Scene.given`, `Story.given`, and `Scene.Subscription.emit`.
- Produces: an Astro `AppConfig` whose view receives `(model, h)`; Viz/web view functions that consume the supplied builder; five object-form Commands; unchanged request-diagnostics interruption semantics.

- [ ] **Step 1: Capture the pre-migration baseline and dirty-state boundary**

Run these commands sequentially:

```sh
git status --short
bun run check
bun typecheck
bun run test
```

Expected: record the exact baseline output before edits. The only expected dirty files are `apps/web/package.json`, `packages/astro-foldkit/package.json`, `packages/foldkit-viz/package.json`, and `bun.lock` from the verified 0.130 bump. Stop and inspect any additional dirty file rather than staging or reverting it.

- [ ] **Step 2: Add a failing render-frame forwarding test**

In `packages/astro-foldkit/test/unit/client-helpers.test.ts`, add a test that supplies a distinct model and builder object, then requires `makeNoMetaView` to forward both while preserving `lang` and `dir`:

```ts
it('forwards the render-frame builder and preserves document attributes', () => {
  const model = { count: 7 };
  const h = { frame: 'test-builder' } as unknown as HtmlBuilder<never>;
  const received: unknown[] = [];
  const appView = (nextModel: typeof model, nextH: HtmlBuilder<never>): Document => {
    received.push(nextModel, nextH);
    return {
      title: 'App title',
      lang: 'ar',
      dir: 'Rtl' as const,
      body: null,
    };
  };
  const wrapped = makeNoMetaView(appView, 'Astro page title');

  expect(wrapped(model, h)).toEqual({
    title: 'Astro page title',
    lang: 'ar',
    dir: 'Rtl',
    body: null,
  });
  expect(received).toEqual([model, h]);
});
```

- [ ] **Step 3: Run the helper test to verify red**

Run:

```sh
bun run --filter @opsydyn/astro-foldkit test:unit -- test/unit/client-helpers.test.ts
```

Expected: FAIL because the current wrapper invokes `view(model)` and drops the builder.

- [ ] **Step 4: Align workspace and public peer dependencies**

Apply these exact manifest changes:

```json
// apps/web/package.json
"@effect/platform-browser": "4.0.0-beta.102",
"@foldkit/vite-plugin": "^0.11.2",
"effect": "4.0.0-beta.102",
"foldkit": "^0.136.0"

// packages/astro-foldkit/package.json
"dependencies": {
  "@foldkit/vite-plugin": "^0.11.2"
},
"devDependencies": {
  "foldkit": "^0.136.0"
},
"peerDependencies": {
  "astro": ">=5.0.0",
  "foldkit": ">=0.136.0 <0.137.0"
}

// packages/foldkit-viz/package.json
"devDependencies": {
  "effect": "4.0.0-beta.102",
  "foldkit": "^0.136.0"
},
"peerDependencies": {
  "effect": ">=4.0.0-beta.102 <5.0.0",
  "foldkit": ">=0.136.0 <0.137.0"
}
```

Regenerate the lockfile and verify the resolved contracts:

```sh
bun install
bun pm ls | rg 'foldkit@|effect@|@effect/platform-browser|@foldkit/vite-plugin'
```

Expected: FoldKit resolves to 0.136.0, Effect and platform-browser resolve to beta.102, and the Vite plugin resolves within 0.11.x.

- [ ] **Step 5: Migrate Astro's public view contract and no-meta wrapper**

In `packages/astro-foldkit/src/types.ts`, erase the internal shape's builder
parameter to `never`; do not use `HtmlBuilder<never>` because FoldKit makes
`HtmlBuilder<Message>` invariant intentionally:

```ts
import type { Runtime } from 'foldkit';
import type { Document } from 'foldkit/html';

export type AppConfigShape<Props extends Record<string, unknown>> = {
  readonly Model: unknown;
  readonly init: (props: Props) => readonly [unknown, CommandBatch];
  readonly update: (model: never, message: never) => readonly [unknown, CommandBatch];
  readonly view: (model: never, h: never) => Document;
  readonly navigation?: NavigationConfig<unknown>;
  readonly ports?: Record<string, unknown>;
};

export type AppConfig<
  Props extends Record<string, unknown> = Record<string, unknown>,
  Model = unknown,
  Message extends TaggedMessage = TaggedMessage,
> = {
  readonly Model: unknown;
  readonly init: (props: Props) => readonly [Model, CommandBatch];
  readonly update: Runtime.ApplicationConfig<Model, Message>['update'];
  readonly view: Runtime.ApplicationConfig<Model, Message>['view'];
};
```

In `packages/astro-foldkit/src/client-helpers.ts`:

```ts
import type { Document, HtmlBuilder } from 'foldkit/html';

export const makeNoMetaView =
  <Model, Message>(
    view: (model: Model, h: HtmlBuilder<Message>) => Document,
    initialTitle: string,
  ) =>
  (model: Model, h: HtmlBuilder<Message>): Document => ({
    ...view(model, h),
    title: initialTitle,
  });
```

In `packages/astro-foldkit/src/client.ts`, recover the concrete model and
message types from the loaded generic config at the lazy-module boundary:

```ts
type ConfigModel<
  Props extends Record<string, unknown>,
  Config extends AppConfigShape<Props>,
> = ReturnType<Config['init']>[0];

type ConfigMessage<
  Props extends Record<string, unknown>,
  Config extends AppConfigShape<Props>,
> = Parameters<Config['update']>[1];

type RuntimeConfigOf<
  Props extends Record<string, unknown>,
  Config extends AppConfigShape<Props>,
> = Runtime.ApplicationConfig<ConfigModel<Props, Config>, ConfigMessage<Props, Config>>;
```

After loading, make one audited adapter cast and use it for the runtime spread
and base view:

```ts
const runtimeConfig = config as unknown as RuntimeConfigOf<Props, Config>;
const baseView = runtimeConfig.view;
const view = shouldSkipMetadata(props)
  ? makeNoMetaView(baseView, clientEnvironment.document.title)
  : baseView;

const program = runtime.makeApplication({
  ...runtimeConfig,
  init: () => config.init(props),
  view,
  container: element,
  preserveScroll: true,
});
```

Preserve the existing port, navigation, and lifecycle fields when assembling
the real object. Do not add another cast or change lifecycle behaviour.

- [ ] **Step 6: Update Astro fixtures and type tests**

In `packages/astro-foldkit/test/unit/define-app.test.ts` and `packages/astro-foldkit/test/unit/client.test.ts`, change every fake root view from:

```ts
view: (_model: Model) => ({}) as Document,
```

to:

```ts
view: (_model: Model, _h: HtmlBuilder<Message>) => ({}) as Document,
```

Import `HtmlBuilder` as a type from `foldkit/html`. In
`client-helpers.test.ts`, import both `Document` and `HtmlBuilder` as types for
the Step 2 test. Keep `package-import-smoke.test.ts` unchanged; its existing
packed Bun, Node, and TypeScript consumer checks remain the publication gate
without adding network installation to the fixture.

- [ ] **Step 7: Verify the Astro package migration**

Run sequentially:

```sh
bun run --filter @opsydyn/astro-foldkit check
bun run --filter @opsydyn/astro-foldkit typecheck
bun run --filter @opsydyn/astro-foldkit test
bun run --filter @opsydyn/astro-foldkit build
```

Expected: all four commands PASS, including the packed import smoke test. If the packed test fails to resolve the package entry, rebuild first; do not replace the package import with a source-relative import.

- [ ] **Step 8: Migrate shared chart view contracts**

For every UI primitive listed in this task, remove `html` value imports and make the supplied builder the final parameter:

```diff
-import type { Html } from 'foldkit/html';
-import { html } from 'foldkit/html';
+import type { Html, HtmlBuilder } from 'foldkit/html';

 export const view = <M>(config: {
   model: Model;
   toParentMessage: (msg: Message) => M;
   ariaLabel?: string;
   renderTooltip?: (datum: Bar, x: number, y: number) => Html;
-}): Html => {
-  const h = html<M>();
+}, h: HtmlBuilder<M>): Html => {
```

This is the exact Bar primitive transformation. Preserve each primitive's own
config fields and rendering body while making these same import, parameter,
and local-factory changes.

For the five shared helpers, replace `ReturnType<typeof html<M>>` aliases with `HtmlBuilder<M>`:

```diff
-import type { Html, html } from 'foldkit/html';
+import type { Html, HtmlBuilder } from 'foldkit/html';

-type H<M> = ReturnType<typeof html<M>>;
+type H<M> = HtmlBuilder<M>;
```

Apply that exact type-only change in all five shared helper modules; their
rendering code already receives `h` and remains unchanged.

Apply the same explicit `HtmlBuilder<M>` type to the internal helpers in `gauge-chart/index.ts` and `phyllotaxis-chart/index.ts`. Do not use `inertHtml` inside render functions.

- [ ] **Step 9: Migrate all root app views and nested view calls**

Use the Bar root as the concrete pattern for each app view listed in this task:

```ts
import type { Document, HtmlBuilder } from 'foldkit/html';

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Bar Chart — foldkit-viz',
  body: h.div(
    [],
    [
      BarChart.view(
        {
          model: model.bar,
          toParentMessage,
          ariaLabel: 'Monthly figures',
        },
        h,
      ),
    ],
  ),
});
```

Preserve each app's current title and rendered content. Move module-level
builder destructuring into the view or prefix constructors with `h`, and pass
that same builder as the final argument to every child chart.

Apply these special cases explicitly:

- `health/view.ts`: turn the module-level `skeleton` into `skeleton(h)` so the render-frame builder creates it.
- `carousel/view.ts`: add `h` to `slidesView` and pass it into `Carousel.view(config, h)`.
- `counter/view.ts`: call `Canvas.view(config, h)` and remove its explicit Message type argument.
- `histogram-brush/view.ts`, `linked-charts/view.ts`, and `request-diagnostics/view.ts`: pass one shared root builder to both child charts.
- `profile/view.ts` and `donut/view.ts`: move destructured attributes and handlers inside the supplied builder scope.

In `request-diagnostics/main.scene.test.ts`, remove the direct `html<Message>()` creation. Give the fixture view the required `(model, h)` signature and use the Scene-provided builder.

- [ ] **Step 10: Migrate Storybook's element-view boundary**

In `apps/web/src/stories/mount.ts`, keep its existing broad model/message
adapter and update only the root view to receive the builder and return a
Document:

```ts
import type { Document, HtmlBuilder } from 'foldkit/html';

export type FoldkitAppConfig = {
  Model: any;
  init: (...args: any[]) => readonly [any, ReadonlyArray<any>];
  update: (model: any, message: any) => readonly [any, ReadonlyArray<any>];
  view: (model: any, h: HtmlBuilder<any>) => Document;
};
```

Do not widen any additional boundary or change the deferred mount/dispose
behaviour in this migration. In `charts-primitives.stories.ts`, import
`HtmlBuilder`, change `mountChart`'s separate element-view parameter to
`(model: Mod, h: HtmlBuilder<Msg>) => Html`, and forward it:

```ts
(model, h) => BarChart.view({ model, toParentMessage: (message) => message }, h);
```

Apply that signature to Bar, Line, Area, and Scatter stories.

- [ ] **Step 11: Migrate all five Commands to named config fields**

Use the no-args shape for `FetchHealth` and `LoadSlides`:

```ts
export const FetchHealth = Command.define('FetchHealth', {
  messages: [FetchedHealth, FetchFailed],
  execute: Effect.provide(
    Effect.gen(function* () {
      const response = yield* HttpClient.get('/api/health');
      const data = yield* HttpClientResponse.schemaBodyJson(HealthData)(response);
      return FetchedHealth(data);
    }).pipe(Effect.catch((error) => Effect.succeed(FetchFailed({ error: String(error) })))),
    Http.layer,
  ),
});
```

Use `args`, `messages`, and `execute` for `SaveUsername` and `SpawnParticle`. Preserve their current Schemas and Effects.

Replace `Command.Interruptible.define` in `request-diagnostics/command.ts` with:

```ts
export const FetchMetrics = Command.define('FetchMetrics', {
  messages: [LoadedMetrics, FailedLoad],
  interrupt: true,
  execute: Effect.provide(
    Effect.gen(function* () {
      const response = yield* HttpClient.get('/api/request-diagnostics');
      const points = yield* HttpClientResponse.schemaBodyJson(Schema.Array(Point))(response);
      return LoadedMetrics({ points });
    }).pipe(Effect.catch((error) => Effect.succeed(FailedLoad({ error: String(error) })))),
    Http.layer,
  ),
});
```

Do not alter `FetchMetrics.Interrupt(...)`, `CompletedCancelFetchMetrics`, the `Cancelling` FSM state, or replacement-request sequencing.

- [ ] **Step 12: Migrate test vocabulary and add subscription-origin coverage**

Rename all 26 calls in the two counter test files:

```ts
Scene.with(model) -> Scene.given(model)
Story.with(model) -> Story.given(model)
```

Create `apps/web/src/apps/health/main.scene.test.ts` with a loaded model whose uptime starts at 12 seconds:

```ts
import { Scene } from 'foldkit';
import { describe, test } from 'vitest';

import { TickedFrame } from './message';
import type { Model } from './model';
import { update } from './update';
import { view } from './view';

const loaded: Model = {
  _tag: 'Loaded',
  data: {
    status: 'ok',
    uptimeSeconds: 12,
    startedAt: '2026-07-07T19:00:00.000Z',
    timestamp: '2026-07-07T19:00:12.000Z',
  },
  elapsedMs: 0,
  sinceLabel: '19:00:00',
};

describe('health scene', () => {
  test('renders a subscription-driven uptime tick', () => {
    Scene.scene(
      { update, view },
      Scene.given(loaded),
      Scene.expect(Scene.text('12.0s')).toExist(),
      Scene.Subscription.emit(TickedFrame({ deltaTimeMs: 500 })),
      Scene.expect(Scene.text('12.5s')).toExist(),
    );
  });
});
```

- [ ] **Step 13: Update compatibility documentation**

In `packages/astro-foldkit/README.md`:

- require FoldKit 0.136.x;
- show `view(model, h)` and use the supplied builder;
- describe object-form interruptible Commands;
- state that `noMeta` pins only `title` while `lang` and `dir` remain owned by the FoldKit Document.

In `packages/foldkit-viz/README.md`:

- require FoldKit 0.136.x;
- replace `Command.Interruptible` wording with `Command.define({ interrupt: ... })`;
- retain the pure geometry and chart-local state boundary.

Update the two collect-html test comments to describe a supplied `HtmlBuilder<M>` rather than the removed `html<M>()` API. Do not change the collector's behaviour.

- [ ] **Step 14: Verify no removed API remains**

Run:

```sh
rg -n 'html<[^>]+>\(\)|Command\.Interruptible\.define|\b(Scene|Story)\.with\b|ReturnType<typeof html' apps packages
rg -n "import \{ html \} from 'foldkit/html'" apps packages
```

Expected: both searches return no owned-source matches. Mentions inside historical design/plan documents are allowed; application, package, test, and README matches are not.

- [ ] **Step 15: Run focused behavioural regression tests**

Run sequentially:

```sh
bun run --filter @opsydyn/web test -- src/apps/health/command.test.ts src/apps/health/main.scene.test.ts
bun run --filter @opsydyn/web test -- src/apps/request-diagnostics/command.test.ts src/apps/request-diagnostics/machine.test.ts src/apps/request-diagnostics/main.scene.test.ts src/apps/request-diagnostics/main.story.test.ts
bun run --filter @opsydyn/web test -- src/apps/counter/main.scene.test.ts src/apps/counter/main.story.test.ts
```

Expected: PASS. In particular, route exit emits one `FetchMetrics.Interrupt`, its outcome emits no replacement, reload still emits exactly one replacement, and retained-island navigation preserves active work.

- [ ] **Step 16: Run the atomic compatibility gate**

Run sequentially:

```sh
bun run check
bun run --filter @opsydyn/astro-foldkit build
bun run --filter @opsydyn/foldkit-viz build
bun typecheck
bun run test
bun run --filter @opsydyn/web build
bun run --filter @opsydyn/web build-storybook
bun run --filter @opsydyn/foldkit-viz docs
git diff --check
```

Expected: every command exits 0. A Storybook bundle-size advisory is non-fatal; rendering, import, type, lint, format, or test diagnostics are not.

- [ ] **Step 17: Review and commit the compatibility base**

Review `git diff --stat` and `git diff`. Confirm the pre-existing four dependency files now contain the 0.136 contract and no unrelated user changes are staged. Commit the complete compatibility unit:

```sh
git add apps/web packages/astro-foldkit packages/foldkit-viz bun.lock
git commit -m "feat: support FoldKit 0.136"
```

Expected: one green commit containing the version alignment and every source/test/doc migration required to compile against it.

---

### Task 2: Add the Greeting Document-Metadata Showcase

**Files:**

- Modify: `apps/web/src/apps/greeting/model.ts`
- Modify: `apps/web/src/apps/greeting/message.ts`
- Modify: `apps/web/src/apps/greeting/update.ts`
- Modify: `apps/web/src/apps/greeting/view.ts`
- Modify: `apps/web/src/apps/greeting/greeting.css.ts`
- Create: `apps/web/src/apps/greeting/main.story.test.ts`
- Create: `apps/web/src/apps/greeting/main.scene.test.ts`
- Create: `apps/web/src/apps/greeting/main.runtime.test.ts`
- Modify: `apps/web/src/pages/greeting.astro`
- Modify: `apps/web/src/layouts/Layout.astro`
- Modify: `apps/web/README.md`
- Modify: `docs/roadmap.md`

**Interfaces:**

- Consumes: the migrated `(model, h) => Document` root-view contract and FoldKit `Document.lang` / `Document.dir`.
- Produces: `Locale = 'en' | 'ar'`, `Model = { name, locale }`, `SelectedLocale({ locale })`, and a hydrated Greeting island that switches the document root between `en/Ltr` and `ar/Rtl`.

- [ ] **Step 1: Write failing update, Scene, and runtime tests**

Create `main.story.test.ts`:

```ts
import { Story } from 'foldkit';
import { describe, expect, test } from 'vitest';

import { Reset, SelectedLocale } from './message';
import { init } from './model';
import { update } from './update';

const initialModel = init({ name: 'astronaut' })[0];

describe('greeting update', () => {
  test('selects Arabic and preserves it when the name resets', () => {
    Story.story(
      update,
      Story.given(initialModel),
      Story.message(SelectedLocale({ locale: 'ar' })),
      Story.model((model) => expect(model.locale).toBe('ar')),
      Story.message(Reset()),
      Story.model((model) => {
        expect(model.name).toBe('World');
        expect(model.locale).toBe('ar');
      }),
      Story.Command.expectNone(),
    );
  });
});
```

Create `main.scene.test.ts`:

```ts
import { Scene } from 'foldkit';
import { describe, test } from 'vitest';

import { init } from './model';
import { update } from './update';
import { view } from './view';

const initialModel = init({ name: 'astronaut' })[0];

describe('greeting scene', () => {
  test('switches the rendered greeting to Arabic', () => {
    Scene.scene(
      { update, view },
      Scene.given(initialModel),
      Scene.expect(Scene.role('button', { name: 'English' })).toHaveAttr('aria-pressed', 'true'),
      Scene.click(Scene.role('button', { name: 'Arabic' })),
      Scene.expect(Scene.role('button', { name: 'Arabic' })).toHaveAttr('aria-pressed', 'true'),
      Scene.expect(Scene.text('مرحبا، astronaut!')).toExist(),
    );
  });
});
```

Create `main.runtime.test.ts` with a real `Runtime.makeApplication` mounted into happy-dom:

```ts
import { Schema } from 'effect';
import { Runtime } from 'foldkit';
import { describe, expect, test, vi } from 'vitest';

import { Model, Name, init } from './model';
import { update } from './update';
import { view } from './view';

describe('greeting document metadata', () => {
  test('applies locale changes to the browser document root', async () => {
    const previousLang = document.documentElement.lang;
    const previousDir = document.documentElement.getAttribute('dir');
    const container = document.createElement('div');
    document.body.appendChild(container);
    const name = Schema.decodeSync(Name)('astronaut');
    const handle = Runtime.embed(
      Runtime.makeApplication({
        Model,
        init: () => init({ name }),
        update,
        view,
        container,
      }),
    );

    try {
      await vi.waitFor(() => {
        expect(document.documentElement.lang).toBe('en');
        expect(document.documentElement.dir).toBe('ltr');
      });
      const arabicButton = Array.from(container.querySelectorAll('button')).find(
        (button) => button.textContent === 'Arabic',
      );
      expect(arabicButton).toBeDefined();
      arabicButton?.click();
      await vi.waitFor(() => {
        expect(document.documentElement.lang).toBe('ar');
        expect(document.documentElement.dir).toBe('rtl');
      });
    } finally {
      handle.dispose();
      container.remove();
      document.documentElement.lang = previousLang;
      if (previousDir === null) document.documentElement.removeAttribute('dir');
      else document.documentElement.setAttribute('dir', previousDir);
    }
  });
});
```

The test must retain the `finally` cleanup even when an assertion fails.

- [ ] **Step 2: Run the Greeting tests to verify red**

Run:

```sh
bun run --filter @opsydyn/web test -- src/apps/greeting/main.story.test.ts src/apps/greeting/main.scene.test.ts src/apps/greeting/main.runtime.test.ts
```

Expected: FAIL because the model is still a branded string, `SelectedLocale` does not exist, and the view has no locale controls or Document direction.

- [ ] **Step 3: Make locale an explicit model field**

In `model.ts`:

```ts
export const Locale = Schema.Literals(['en', 'ar']);
export type Locale = typeof Locale.Type;

export const Model = Schema.Struct({
  name: Name,
  locale: Locale,
});
export type Model = typeof Model.Type;

const Props = Schema.Struct({ name: Name });

export const init = (props: unknown): readonly [Model, readonly []] => {
  const { name } = Schema.decodeUnknownSync(Props)(props);
  return [{ name, locale: 'en' }, []];
};
```

In `message.ts`, retain `Reset` and add:

```ts
export const SelectedLocale = m('SelectedLocale', { locale: Locale });
export const Message = Schema.Union([Reset, SelectedLocale]);
```

In `update.ts`, use exhaustive message matching. `SelectedLocale` replaces only `locale`; `Reset` changes `name` to the branded `World` value and preserves `locale`.

- [ ] **Step 4: Render accessible language controls and Document metadata**

In `view.ts`, derive one locale record:

```ts
const presentation =
  model.locale === 'ar'
    ? {
        title: 'مرحبا!',
        greeting: 'مرحبا، ' + model.name + '!',
        lang: 'ar',
        dir: 'Rtl' as const,
      }
    : {
        title: 'Hello, ' + model.name + '!',
        greeting: 'Hello, ' + model.name + '!',
        lang: 'en',
        dir: 'Ltr' as const,
      };
```

Return `lang` and `dir` on the root Document. Render English and Arabic as ordinary buttons in a labelled group, dispatch `SelectedLocale` from `OnClick`, and expose selection with `aria-pressed`. Keep Reset as a separate command button. Use the supplied `h` for all elements and handlers.

In `greeting.css.ts`, add a stable two-button control row and selected state. Keep card radii at 8px or less, ensure both labels fit at mobile width, and use the existing neutral black/white treatment rather than introducing a new dominant palette.

- [ ] **Step 5: Make Astro's first paint explicit**

In `Layout.astro`, change the document root to:

```astro
<html lang="en" dir="ltr">
```

In `greeting.astro`, retain the validated branded name prop, change the page heading from `Props POC` to `Greeting`, and keep:

```astro
<GreetingApp client:load name={name} />
```

Do not add `noMeta`: this standalone route deliberately lets the hydrated FoldKit application own title, language, and direction.

- [ ] **Step 6: Run focused tests to verify green**

Run:

```sh
bun run --filter @opsydyn/web test -- src/apps/greeting/main.story.test.ts src/apps/greeting/main.scene.test.ts src/apps/greeting/main.runtime.test.ts
```

Expected: PASS. Scene proves the Message-to-view interaction; the runtime test proves FoldKit maps `Rtl` to the browser's lowercase `dir="rtl"` attribute.

- [ ] **Step 7: Document the reference behaviour and update the roadmap**

In `apps/web/README.md`, add Greeting to the app list and state:

- Astro serves `lang="en" dir="ltr"` for first paint.
- The hydrated FoldKit Document switches language and direction after `SelectedLocale`.
- The app owns this metadata because it is standalone; embedded chart islands keep `noMeta`.

In `docs/roadmap.md`, add a completed FoldKit 0.136 compatibility slice covering:

- render-scoped HtmlBuilder propagation;
- object-form interruptible Commands;
- `Scene.given` / `Story.given` and subscription-origin test coverage;
- the locale-aware Astro Greeting showcase.

Also update the completed interruptible-lifecycle wording from `Command.Interruptible.define` to `Command.define({ interrupt: true })`.

- [ ] **Step 8: Verify the hydrated Astro page interactively**

Start the app:

```sh
bun run --filter @opsydyn/web dev
```

Open `/greeting?name=astronaut` in a browser. Verify:

1. First paint has `<html lang="en" dir="ltr">`.
2. English is selected and the greeting reads `Hello, astronaut!`.
3. Clicking Arabic changes the root to `lang="ar" dir="rtl"` and renders `مرحبا، astronaut!`.
4. Clicking English restores `lang="en" dir="ltr"`.
5. Reset changes the name to `World` without changing the selected locale.
6. Controls do not overlap or overflow at desktop and mobile widths.

Stop only the dev server process started for this check.

- [ ] **Step 9: Run the complete release gate**

Run sequentially:

```sh
bun run check
bun run --filter @opsydyn/astro-foldkit build
bun run --filter @opsydyn/foldkit-viz build
bun typecheck
bun run test
bun run --filter @opsydyn/web build
bun run --filter @opsydyn/web build-storybook
bun run --filter @opsydyn/foldkit-viz docs
git diff --check
```

Expected: every command exits 0. Confirm the packed-consumer tests for both packages run inside `bun run test` and leave no tarballs or fixture directories behind.

- [ ] **Step 10: Review and commit the showcase**

Review `git diff` and confirm no package version or generated changelog was edited. Commit:

```sh
git add apps/web/src/apps/greeting apps/web/src/pages/greeting.astro apps/web/src/layouts/Layout.astro apps/web/README.md docs/roadmap.md
git commit -m "feat(web): showcase FoldKit document locale metadata"
```

Expected: a second green commit containing only the Greeting showcase, its tests, first-paint metadata, and roadmap documentation.
