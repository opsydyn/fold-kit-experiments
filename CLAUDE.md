# CLAUDE.md — fold-kit-experiments

Project conventions and agent guidance for this monorepo.

## Quick orientation

Bun workspace monorepo. Thirteen workspaces in active use:

| Workspace                       | Path                             | Purpose                                                    |
| ------------------------------- | -------------------------------- | ---------------------------------------------------------- |
| `@opsydyn/astro-foldkit`        | `packages/astro-foldkit/`        | Astro integration for Foldkit apps                         |
| `@opsydyn/foldkit-viz`          | `packages/foldkit-viz/`          | D3-quality chart primitives (no D3 dep)                    |
| `@opsydyn/web`                  | `apps/web/`                      | Chart demos and reference workbenches                      |
| `@opsydyn/dataset-explorer`     | `packages/dataset-explorer/`     | Private shared KeyedQuery example                          |
| `@opsydyn/promo`                | `apps/promo/`                    | Static chart examples and downloadable projects            |
| `@opsydyn/effect-three`         | `packages/effect-three/`         | Effect-native declarative Three.js core (npm, 0.x)         |
| `@opsydyn/effect-three-foldkit` | `packages/effect-three-foldkit/` | Foldkit adapter for effect-three (npm, 0.x)                |
| `@opsydyn/effect-three-rapier`  | `packages/effect-three-rapier/`  | Rapier physics engine for effect-three (npm, 0.x)          |
| `@opsydyn/effect-three-troika`  | `packages/effect-three-troika/`  | Troika distance-field text for effect-three (npm, 0.x)     |
| `@opsydyn/effect-three-samples` | `packages/effect-three-samples/` | Private effect-three samples for apps/web and three-promo  |
| `@opsydyn/three-promo`          | `apps/three-promo/`              | effect-three promo site (same layout and styling as promo) |
| `@opsydyn/tech-radar`           | `apps/tech-radar/`               | Standalone tech radar: the 3D radar, markdown content      |
| `@opsydyn/tech-radar-infra`     | `infra/tech-radar/`              | Alchemy stack deploying the tech radar to Cloudflare       |

The effect-three packages (core, Foldkit adapter, Rapier, troika) run a **stricter, package-local lint policy** (`oxlint.strict.ts`, `@opsydyn/oxlint-effect@2.0.1`, all rules, TypeScript 7). Read `docs/effect-three/PLAN.md` and `docs/effect-three/adr/` before changing them.

**Stack:** Foldkit (Elm Architecture on Effect-TS) · Astro · TypeScript · bun · oxlint · oxfmt

## Dev commands

Package consumer guidance lives in independent skills:
`skills/astro-foldkit/SKILL.md`, `skills/foldkit-viz/SKILL.md` and
`skills/effect-three/SKILL.md` (3D scenes: core, FoldKit adapter, Rapier, troika).
Read the one relevant to the task; none requires another or an upstream checkout.
Combine them only for tasks that span those packages.

```sh
bun dev                               # demo app → localhost:4321
bun storybook                         # chart storybook → localhost:6006
bun run test                          # all workspace scripts, sequentially
bun typecheck                         # all workspaces
bun run check                         # oxlint + oxfmt --check (both must pass)
bun run check:fix                     # oxfmt then oxlint --fix
bun run --filter @opsydyn/web dev     # single workspace
bun dev:three-promo                   # effect-three promo → localhost:4323
bun dev:tech-radar                    # tech radar → localhost:4326
bun run relay                         # editor relay → ws://localhost:4325/<room>
```

Astro 7 runs `astro dev` in the background when an agent starts it: stop it with
`bunx astro dev stop` in the app's directory (`status` and `logs` also work). A test that
starts a dev server should pass `--ignore-lock` to keep it in the foreground.

`.mcp.json` registers the Foldkit DevTools MCP server (`@foldkit/devtools-mcp`, a root
dev dependency): with a dev server running, an agent can read a Foldkit app's Model and
dispatch Messages to apps that export `devTools = { Message }` (the XR room does). It
joins the newest dev server under the repository, so set `FOLDKIT_PROJECT_ROOT` to the
app's directory, and pass `runtime_id` on each tool call. Known problems and their
workarounds: `docs/effect-three/devtools-mcp-notes.md`.

## Dependencies

Shared dependency versions live once, in the root `package.json` catalogs
(`workspaces.catalog`, plus `workspaces.catalogs.strict` for the effect-three packages'
TypeScript 7 and oxlint). In private workspaces write `"catalog:"` (or
`"catalog:strict"`), never a version. The npm-published packages (`astro-foldkit`,
`foldkit-viz`, and the four effect-three packages) keep literal versions equal to the
catalog's (`npm publish` cannot resolve `catalog:`). `bun run check` enforces both via `tools/check-catalog.ts`.

`infra/*` workspaces are separate programs (Alchemy CLIs). They share the apps' Effect from
the default catalog (`"catalog:"`): Alchemy accepts `effect ^4.0.5` and FoldKit 0.170
accepts `~4.1.0`. Alchemy itself and its Effect platform packages come from
`workspaces.catalogs.infra` (`"catalog:infra"`).
`packages/effect-three/scripts/check-single-effect.ts` checks that the apps, packages and
infra load one Effect.

The tech radar (`apps/tech-radar`) works from a copy of the effect-three sample radar, and
leaves the original unchanged. Its content is markdown in
`apps/tech-radar/src/content`. `.github/workflows/deploy-tech-radar.yml` deploys it with
Alchemy: production on `main`, previews for PRs labelled `preview`. See the app's and the
infra workspace's READMEs.

## Linting — oxlint + oxfmt

Biome was removed. The project uses oxlint (linter) and oxfmt (formatter).

**Running oxlint directly requires `NODE_OPTIONS`** because `oxlint.config.ts` is a TypeScript config file:

```sh
NODE_OPTIONS="--experimental-strip-types" bunx oxlint .
```

The `bun run check` script already includes this flag — prefer `bun run check` over calling oxlint directly.

Config files:

- `oxlint.config.ts` — lint rules (recommended `@opsydyn/oxlint-effect` 2.x with Effect 4 policy + `@foldkit/oxlint-plugin` + biome equivalents). Rules new in the 2.x preset that still have findings are switched off near the top as an adoption backlog, with counts; fix their findings and remove the line rather than adding disables.
- `.oxfmtrc.json` — formatter (100-char width, 2-space indent, single quotes, trailing commas, semicolons, import sorting)

## Foldkit import style guide

Foldkit 0.170.0 exports submodule functions as **named exports**, not namespace objects.

### foldkit/update

```typescript
// ✅ correct — named imports
import { combine, refresh } from 'foldkit/update';
import type { Return, Step, Refreshable, Commands } from 'foldkit/update';

// ❌ wrong — Update is not an exported namespace
import { Update } from 'foldkit/update';
```

Common patterns:

```typescript
// Type alias — pin once per update module
type AppReturn = Return<Model, Message>;

// Step — a function that returns the current record contract
const myStep: Step<Model, Message> = (model) => ({
  model: { ...model, foo: 'bar' },
});

// combine — data-first (run now) or data-last (build a Step)
combine(model, [stepA, stepB(args)]); // data-first: returns AppReturn
combine([stepA, stepB(args)]); // data-last: returns a Step

// refresh — builds a Step from a Refreshable descriptor
const loadFoo: Step<Model, Message> = refresh<Model, Message, FooData, string>({
  read: (model) => Option.some(model.foo), // Option because keyed caches use HashMap.get
  revalidate: revalidateOrLoad, // Idle/Failure→Loading, Success→Refreshing
  write: (model, next) => ({ ...model, foo: next }),
  load: LoadFoo(),
});
```

### foldkit/asyncData

```typescript
// ✅ correct — named imports
import {
  settle,
  revalidateOrLoad,
  revalidate,
  matchData,
  match,
  succeed,
  fail,
} from 'foldkit/asyncData';
import type { AsyncData } from 'foldkit/asyncData';

// ❌ wrong — AsyncData is not an exported value namespace
import { AsyncData } from 'foldkit/asyncData';
```

The six states: `Idle | Loading | Refreshing(data) | Failure(error) | Stale(error, data) | Success(data)`

```typescript
// View — matchData collapses to 3 practical channels
matchData(model.slides, {
  onEmpty: () => spinner(),                    // Idle + Loading
  onFailure: (error) => errorBanner(error),   // Failure only (Stale goes to onData)
  onData: (slides) => slideList(slides),      // Success + Refreshing + Stale
});

// Update — settle a field from a Command result
import { Result } from 'effect';
const next = settle(model.foo, result);        // dual: also settle(result)(model.foo)

// Model field initial value
slides: { _tag: 'Idle' } as AsyncData<ReadonlyArray<Slide>, string>

// Keyed cache read (HashMap)
const current = fromOptionOrIdle(HashMap.get(model.cache, key));
```

### foldkit/html

```typescript
import type { Document, Html } from 'foldkit/html'; // Html (not Html<Message>, not Node)
import { html } from 'foldkit/html';
```

### Schema.Unknown + type override pattern

When a message field carries a type that can't be expressed in Schema (e.g. `Result`, `Carousel.Message`), use `Schema.Unknown` and override the TypeScript type:

```typescript
// message.ts
export const SettledSlides = m('SettledSlides', { result: Schema.Unknown });
export type SettledSlides = Omit<typeof SettledSlides.Type, 'result'> & {
  readonly result: Result.Result<ReadonlyArray<Slide>, string>;
};
```

Inside the update handler, cast the field — the Schema type loses the override:

```typescript
SettledSlides: ({ result: rawResult }) => {
  const result = rawResult as Result.Result<ReadonlyArray<Slide>, string>;
  // use result ...
};
```

## Imperative shell / functional core with Astro

Astro pages are the imperative shell (SSR, props, hydration). Foldkit apps are the functional core (pure Model → view, update, Commands as descriptions).

**`loadSlidesOnEntry` pattern** — a `Step` that works identically for cold loads and future navigation re-entries:

```typescript
// update.ts — pure Step, no shell knowledge
export const loadSlidesOnEntry: Step<Model, Message> = refresh<Model, Message, Data, Err>({
  read: (model) => Option.some(model.data),
  revalidate: revalidateOrLoad,
  write: (model, data) => ({ ...model, data }),
  load: LoadData(),
});

// main.ts — shell hands off to the core Step
export const init = (_props: unknown) => loadSlidesOnEntry(initModel);
// init returns { model: Model with Loading state, commands: [LoadData()] }
```

**`Route.isEntering`** — when a Foldkit app has internal sub-routes, use this to share load-on-entry logic between `init` (cold load, `maybePreviousRoute = None`) and `ChangedUrl` navigation:

```typescript
import { Route } from 'foldkit';
const isEntering = Route.isEntering<AppRoute>; // pin your union once

// In ChangedUrl handler and init, same predicate:
if (isEntering('DetailRoute')({ maybePreviousRoute, nextRoute })) {
  return combine(model, [loadDataOnEntry]);
}
```

## Message naming conventions

From the Foldkit style guide (adapted):

| Prefix                   | Use case                                    | Example              |
| ------------------------ | ------------------------------------------- | -------------------- |
| `Clicked*`               | Button/interactive press                    | `ClickedNext`        |
| `Got*`                   | Submodel result via Submodel pattern        | `GotCarouselMessage` |
| `Settled*`               | AsyncData Command result (carries `Result`) | `SettledSlides`      |
| `Succeeded*` / `Failed*` | Two-message Command result                  | `SucceededFetchUser` |
| `Completed*`             | Fire-and-forget acknowledgment              | `CompletedNavigate`  |

`Settled*` messages always carry `result: Result.Result<A, E>` via `Schema.Unknown` + type override, settled with `AsyncData.settle` in the update arm.

## foldkit-viz conventions

**D3 parity rule:** All math and shape implementations in `packages/foldkit-viz/` must reference `d3-main/` in this repository as the source of truth. Never invent chart math from scratch — trace the D3 implementation.

## effect-three conventions

**R3F reference rule:** when adding a capability that React Three Fiber, Drei or three.js already has, trace their implementation first and use it as the behavioural reference. The pinned checkouts live at the root of the main checkout (`react-three-fiber-main/`, `drei-main/`, `three-effect-main/`, all git-ignored); three.js itself is `node_modules/three` at the pinned version, including `examples/jsm`. Cite the file and pinned commit in the ADR or PR. Reference, don't copy: our API stays a typed, closed, Model-driven catalogue. If code is ever ported, keep its licence notice (R3F, Drei and three are MIT; three-effect is Apache-2.0). Pins and refresh steps: `docs/effect-three/references.md`. Sequencing: `docs/effect-three/ROADMAP.md`.

## Foldkit version

Currently on `foldkit@0.170.0` with stable Effect `4.1.0` and
`@foldkit/vite-plugin` `0.29.x`. FoldKit 0.170 peers on Effect `~4.1.0` (4.1 patches only);
see `docs/releases/foldkit-0.170.md`. It needed no source changes from 0.169. Effect minor
releases can change APIs: review each one, as FoldKit does.

FoldKit 0.167+ and stable Effect guidance:

- Prefer the renamed helpers `modifyFields`, `streamFromKeyBindings`, `mapEvent`, and
  `filterMapEvent` when migrating code that used their older names.
- Use `Subscription.animationFrameEntry`, `Subscription.persistentEntry`, and
  `Port.subscriptionEntry` inside `Subscription.make`. `toMessage` and
  `toParentMessage` remain the callback names.
- `Subscription.lift` and `ManagedResource.lift` take `read` returning an
  `Option`; wrap an always-present child with `Option.some`.
- `foldkit/update` uses record-shaped `Step` and `Return` values. Omit
  `commands` when no commands are produced.
- Use stable Effect module paths such as `effect/http`; do not reintroduce
  `effect/unstable/*` imports.
- Keep browser subscriptions in the owning app. `Dom.streamFromMediaQuery`
  provides an initial match and later change facts; the app maps those facts to
  Messages and owns the resulting Model policy.
- Astro owns document rendering. FoldKit's generated build identity coordinates
  hydration; `server.buildId` or `FOLDKIT_BUILD_ID` supplies an explicit deployment
  override. Do not hardcode `development` as a production build identity.

The current release includes:

- `foldkit/update` — `combine`, `refresh`, `Step`, `Return`, `Refreshable` types
- `foldkit/asyncData` — `fromOptionOrIdle`, `revalidateOrLoad`, `settle`, `matchData`
- `Route.isEntering`, `RouteTransition` type
- `Transition.match`, `Transition.matchOrElse`, `Transition.isExiting`, `Transition.isStaying` (0.169)
- `Lazy.expectAllReused` in `foldkit/test` to check lazy cache reuse (0.169)
- `preserveScroll: true` on `makeApplication` (already wired in `packages/astro-foldkit/src/client.ts`)
- `foldkit/http` — browser-safe `Http.layer` for Commands using Effect `HttpClient`
