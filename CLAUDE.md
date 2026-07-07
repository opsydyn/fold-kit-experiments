# CLAUDE.md — fold-kit-experiments

Project conventions and agent guidance for this monorepo.

## Quick orientation

Bun workspace monorepo. Three workspaces in active use:

| Workspace | Path | Purpose |
|---|---|---|
| `@opsydyn/astro-foldkit` | `packages/astro-foldkit/` | Astro integration for Foldkit apps |
| `@opsydyn/foldkit-viz` | `packages/foldkit-viz/` | D3-quality chart primitives (no D3 dep) |
| `@opsydyn/web` | `apps/web/` | Demo app — 33 chart types, the integration test surface |

**Stack:** Foldkit (Elm Architecture on Effect-TS) · Astro · TypeScript · bun · oxlint · oxfmt

## Dev commands

```sh
bun dev                               # demo app → localhost:4321
bun storybook                         # chart storybook → localhost:6006
bun test                              # all workspaces
bun typecheck                         # all workspaces
bun run check                         # oxlint + oxfmt --check (both must pass)
bun run check:fix                     # oxfmt then oxlint --fix
bun run --filter @opsydyn/web dev     # single workspace
```

## Linting — oxlint + oxfmt

Biome was removed. The project uses oxlint (linter) and oxfmt (formatter).

**Running oxlint directly requires `NODE_OPTIONS`** because `oxlint.config.ts` is a TypeScript config file:

```sh
NODE_OPTIONS="--experimental-strip-types" bunx oxlint .
```

The `bun run check` script already includes this flag — prefer `bun run check` over calling oxlint directly.

Config files:
- `oxlint.config.ts` — lint rules (recommended `@opsydyn/oxlint-effect` + `@foldkit/oxlint-plugin` + biome equivalents)
- `.oxfmtrc.json` — formatter (100-char width, 2-space indent, single quotes, trailing commas, semicolons, import sorting)

## Foldkit import style guide

Foldkit 0.125.0 exports submodule functions as **named exports**, not namespace objects.

### foldkit/update

```typescript
// ✅ correct — named imports
import { combine, refresh, noOp } from 'foldkit/update';
import type { Return, Step, Refreshable, Commands } from 'foldkit/update';

// ❌ wrong — Update is not an exported namespace
import { Update } from 'foldkit/update';
```

Common patterns:

```typescript
// Type alias — pin once per update module
type AppReturn = Return<Model, Message>;

// Step — a function (model) => [model, commands]
const myStep: Step<Model, Message> = (model) => [{ ...model, foo: 'bar' }, []];

// combine — data-first (run now) or data-last (build a Step)
combine(model, [stepA, stepB(args)])          // data-first: returns AppReturn
combine([stepA, stepB(args)])                 // data-last: returns a Step

// refresh — builds a Step from a Refreshable descriptor
const loadFoo: Step<Model, Message> = refresh<Model, Message, FooData, string>({
  read: (model) => Option.some(model.foo),    // Option because keyed caches use HashMap.get
  revalidate: revalidateOrLoad,               // Idle/Failure→Loading, Success→Refreshing
  write: (model, next) => ({ ...model, foo: next }),
  load: LoadFoo(),
});
```

### foldkit/asyncData

```typescript
// ✅ correct — named imports
import { settle, revalidateOrLoad, revalidate, matchData, match, succeed, fail } from 'foldkit/asyncData';
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
import type { Document, Html } from 'foldkit/html';   // Html (not Html<Message>, not Node)
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
}
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
// init returns [Model with Loading state, [LoadData()]] — shell runs LoadData
```

**`Route.isEntering`** — when a Foldkit app has internal sub-routes, use this to share load-on-entry logic between `init` (cold load, `maybePreviousRoute = None`) and `ChangedUrl` navigation:

```typescript
import { Route } from 'foldkit';
const isEntering = Route.isEntering<AppRoute>;  // pin your union once

// In ChangedUrl handler and init, same predicate:
if (isEntering('DetailRoute')({ maybePreviousRoute, nextRoute })) {
  return combine(model, [loadDataOnEntry]);
}
```

## Message naming conventions

From the Foldkit style guide (adapted):

| Prefix | Use case | Example |
|---|---|---|
| `Clicked*` | Button/interactive press | `ClickedNext` |
| `Got*` | Submodel result via Submodel pattern | `GotCarouselMessage` |
| `Settled*` | AsyncData Command result (carries `Result`) | `SettledSlides` |
| `Succeeded*` / `Failed*` | Two-message Command result | `SucceededFetchUser` |
| `Completed*` | Fire-and-forget acknowledgment | `CompletedNavigate` |

`Settled*` messages always carry `result: Result.Result<A, E>` via `Schema.Unknown` + type override, settled with `AsyncData.settle` in the update arm.

## foldkit-viz conventions

**D3 parity rule:** All math and shape implementations in `packages/foldkit-viz/` must reference `/Users/alan/Projects/astro-fold-kit/d3-main` as the source of truth. Never invent chart math from scratch — trace the D3 implementation.

## Foldkit version

Currently on `foldkit@0.125.0`. New in this version:
- `foldkit/update` — `combine`, `refresh`, `noOp`, `Step`, `Return`, `Refreshable` types
- `foldkit/asyncData` — `fromOptionOrIdle`, `revalidateOrLoad`, `settle`, `matchData`
- `Route.isEntering`, `RouteTransition` type
- `preserveScroll: true` on `makeApplication` (already wired in `packages/astro-foldkit/src/client.ts`)
