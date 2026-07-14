# AGENTS.md — fold-kit-experiments

Agent guidance for this monorepo. Read this before writing any code.

## Repo at a glance

Bun workspace monorepo. Three active workspaces:

| Workspace                | Path                      | Purpose                             |
| ------------------------ | ------------------------- | ----------------------------------- |
| `@opsydyn/astro-foldkit` | `packages/astro-foldkit/` | Astro integration for Foldkit       |
| `@opsydyn/foldkit-viz`   | `packages/foldkit-viz/`   | Chart primitives (no D3 dependency) |
| `@opsydyn/web`           | `apps/web/`               | Demo app — 33 chart types           |

**Stack:** Foldkit 0.126.0 · Effect-TS · Astro · TypeScript · bun · oxlint · oxfmt

## Before you write code

1. Run `bun typecheck` — understand baseline errors before touching anything
2. Run `bun run check` — understand baseline lint/format state
3. Read the exemplar files for the area you're working in:
   - New chart app: look at `apps/web/src/apps/carousel/` (AsyncData + Update.combine pattern)
   - New chart primitive: look at `packages/foldkit-viz/src/` and match D3 source at `d3-main/`
   - Astro integration: look at `packages/astro-foldkit/src/client.ts`

## Commands

```sh
bun test                              # all workspaces
bun typecheck                         # all workspaces
bun run check                         # oxlint + oxfmt --check (both must pass before committing)
bun run check:fix                     # oxfmt then oxlint --fix
bun run --filter @opsydyn/web dev     # single-workspace dev
```

## Linting

The project uses **oxlint** (not ESLint, not Biome). Config is `oxlint.config.ts`.

Running oxlint directly requires a Node flag because the config is TypeScript:

```sh
NODE_OPTIONS="--experimental-strip-types" bunx oxlint .
```

Prefer `bun run check` — the flag is already included. Never add `biome` commands; Biome was removed.

## Foldkit module imports — critical

Foldkit exports functions as **named exports**, not namespace objects. Getting this wrong produces confusing TS errors.

### foldkit/update

```typescript
// ✅
import { combine, refresh, noOp } from 'foldkit/update';
import type { Return, Step, Refreshable } from 'foldkit/update';

// ❌ — Update is not a namespace
import { Update } from 'foldkit/update';
```

### foldkit/asyncData

```typescript
// ✅
import { settle, revalidateOrLoad, matchData, fromOptionOrIdle } from 'foldkit/asyncData';
import type { AsyncData } from 'foldkit/asyncData';

// ❌ — AsyncData is a type export only, not a value namespace
import { AsyncData } from 'foldkit/asyncData';
```

### foldkit/html

```typescript
import type { Document, Html } from 'foldkit/html'; // Html, not Html<Message>, not Node
import { html } from 'foldkit/html';
```

## AsyncData pattern

Six states: `Idle | Loading | Refreshing(data) | Failure(error) | Stale(error,data) | Success(data)`

```typescript
// Model field
slides: { _tag: 'Idle' } as AsyncData<ReadonlyArray<Slide>, string>

// View
matchData(model.slides, {
  onEmpty: () => spinner(),          // Idle + Loading
  onFailure: error => errorView(),   // Failure (no data)
  onData: slides => listView(slides),// Success + Refreshing + Stale (all have data)
});

// Update — settle from a Command result
SettledSlides: ({ result: raw }) => {
  const result = raw as Result.Result<ReadonlyArray<Slide>, string>;
  return combine(model, [
    (m) => [{ ...m, slides: settle(m.slides, result) }, []],
  ]);
}
```

## Update.combine + Update.refresh pattern

```typescript
// compose multiple steps — data-first (run now)
combine(model, [stepA, stepB(someArg), stepC])

// refresh — builds a revalidation Step from a Refreshable descriptor
const loadOnEntry: Step<Model, Message> = refresh<Model, Message, Data, Err>({
  read: (model) => Option.some(model.data),   // wrap in Option.some for single fields
  revalidate: revalidateOrLoad,               // cold-start semantics
  write: (model, next) => ({ ...model, data: next }),
  load: LoadData(),
});

// Use the same Step in both init and navigation:
// main.ts
export const init = (_props: unknown) => loadOnEntry(initModel);
// update.ts ChangedUrl handler
ChangedUrl: ({ url }) => combine(model, [loadOnEntry, ...]);
```

## Schema.Unknown + type override pattern

Use when a message field has a type that can't be expressed in Schema (e.g. `Result`, a child `Message` type):

```typescript
// message.ts
export const SettledFoo = m('SettledFoo', { result: Schema.Unknown });
export type SettledFoo = Omit<typeof SettledFoo.Type, 'result'> & {
  readonly result: Result.Result<FooData, string>;
};
```

Always cast inside the update handler — the union type carries the Schema type, not the override:

```typescript
SettledFoo: ({ result: raw }) => {
  const result = raw as Result.Result<FooData, string>;
  // ...
};
```

## Message naming

| Prefix                   | When                              | Example              |
| ------------------------ | --------------------------------- | -------------------- |
| `Clicked*`               | User interaction                  | `ClickedNext`        |
| `Got*`                   | Submodel result                   | `GotCarouselMessage` |
| `Settled*`               | AsyncData result (Result-wrapped) | `SettledSlides`      |
| `Succeeded*` / `Failed*` | Two-branch Command result         | `SucceededFetch`     |
| `Completed*`             | Fire-and-forget                   | `CompletedNavigate`  |

Messages are **past-tense facts** about what happened. Never imperative.

## Foldkit architecture rules

Never violate these — push back if asked to:

- **Unidirectional data flow** — Model → view → Message → update → Model
- **Messages are facts** — `ClickedSubmit`, not `Submit`. They describe what happened, not what to do.
- **Model is single source of truth** — no external state, no refs, no direct DOM mutation
- **Side effects in Commands only** — Effects run by the runtime after `update` returns
- **Impossible states unrepresentable** — use discriminated unions (`Idle | Loading | Success`), not `isLoading: boolean`

## foldkit-viz D3 parity

When implementing chart math or shapes in `packages/foldkit-viz/`, always reference `d3-main/` in this repo as the source of truth. Never invent chart math from scratch.

## Verification before claiming done

Always run before reporting work complete:

```sh
bun run check      # lint + format — must exit 0
bun typecheck      # must exit 0
bun test           # 179 tests must pass (119 foldkit-viz + 34 astro-foldkit + 26 web)
```
