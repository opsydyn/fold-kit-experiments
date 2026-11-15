# Upgrading to FoldKit 0.170 and Effect 4.1

For applications using `@opsydyn/astro-foldkit` or `@opsydyn/foldkit-viz` on the
FoldKit 0.167 line. It follows the [0.167 guide](foldkit-0.167.md); the
workspace's own notes are in
[releases/foldkit-0.169.md](../releases/foldkit-0.169.md) and
[releases/foldkit-0.170.md](../releases/foldkit-0.170.md).

## What to install

| Package                                  | Supports                                                                     | What it needs from you                                                                       |
| ---------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `@opsydyn/astro-foldkit` 0.9.3 and later | FoldKit `>=0.170.0 <0.171.0`; Astro 5 and later, checked in CI on 5, 6 and 7 | FoldKit 0.170, and Effect `~4.1.0` installed by the app                                      |
| `@opsydyn/foldkit-viz` 0.14.1 and later  | FoldKit `>=0.167.0 <0.171.0`, both optional                                  | Nothing for the pure geometry entry points; the `foldkit/*` adapters need FoldKit and Effect |

- **Effect is now a peer of `astro-foldkit`, not a dependency.** It shares
  Effect values with FoldKit, so it must use the app's single copy: add
  `effect@~4.1.0` to the app's dependencies.
- **Node.js 22.19 or newer** is needed by FoldKit's Vite plugin, which
  `astro-foldkit` depends on (`@foldkit/vite-plugin` `^0.29.0`).
- **`astro-foldkit` supports FoldKit 0.170 only**, because that Vite plugin
  needs Effect 4.1. Upgrade FoldKit and `astro-foldkit` together.
- **foldkit-viz accepts either line**, so it can move first or after.

```sh
bun add foldkit@~0.170.0 effect@~4.1.0 @opsydyn/astro-foldkit@latest @opsydyn/foldkit-viz@latest
```

## Breaking changes that can reach application code

### Mounts that wait before they acquire

Effect 4.1 starts `Stream.callback` setup immediately. A Mount whose
acquisition waits for something asynchronous (a socket opening, a module
loading) and must stop if the element unmounts during the wait should acquire
synchronously and wait afterwards, or pass `{ interruptible: true }` to
`Effect.acquireRelease`. Mounts that acquire synchronously, such as event
listeners, need no change.

### Effect's `Crypto` service

Effect 4.1 replaces `Crypto.Crypto` with services in `effect/crypto`
(`SecureRandom`, `Digest` and others), provided explicitly. Apps that only need
an id can use the platform's `crypto.randomUUID()`.

### Models must be JSON in development

FoldKit's DevTools bridge encodes the Model as JSON, and Effect 4.1 rejects
values that are not, with `SchemaError: Expected JSON value` in the console.
Nothing changes in production, but keep only data in the Model: an easing's
name rather than the easing function, for example.

## New APIs worth adopting

### Route `Transition`, with the navigation port

`astro-foldkit`'s navigation port delivers each Astro navigation as a
`NavigationEvent` of `phase` (`coldLoad`, `entered`, `exited` or `stayed`),
`path` and `previousPath`. FoldKit's `Transition`, from `foldkit/route`, turns
the parsed routes into one loading policy for `init` and navigation alike:

```ts
import { Transition } from 'foldkit/route';

// In update, for the port's message: parse both paths into your Route type.
const transition =
  event.phase === 'coldLoad'
    ? Transition.coldLoad(nextRoute)
    : Transition.make(previousRoute, nextRoute);

if (Transition.isEntering(transition, 'Document')) {
  // Load or revalidate the document's data.
}
```

- **Builders:**
  - `Transition.make(previous, next)` builds a transition for an in-app
    navigation.
  - `Transition.coldLoad(next)` builds one for a direct visit, which counts as
    an entry.
- **Queries for one named route:** `entered(transition, tag)` and `exited`
  return an `Option` of that route, narrowed to its tag.
- **Queries for every route at once:** `enteredAny` and `exitedAny`.
- **Since 0.169:** `Transition.match`, `matchOrElse`, `isExiting` and
  `isStaying` cover the remaining entry and exit policies.
- **Worked example:** `apps/web/src/apps/request-diagnostics/navigation.ts`
  combines the port and `Transition`.

Keep the policy in `update`: the integration only observes navigation and
delivers the event; it never starts, cancels or replaces Commands.

### `AsyncData.matchDataSplitEmpty`

`AsyncData.matchData` collapses the six states into three channels:

- `onEmpty` covers `Idle` and `Loading` together.
- `onFailure` receives the error.
- `onData` covers `Success`, `Refreshing` and `Stale`.

When a view shows "nothing requested yet" differently from "loading", use
`matchDataSplitEmpty`. It splits `onEmpty` into `onIdle` and `onLoading`, and
`onData` and `onFailure` behave exactly as in `matchData`:

```ts
import { AsyncData } from 'foldkit/asyncData';

AsyncData.matchDataSplitEmpty(model.results, {
  onIdle: () => 'Choose a dataset to begin.',
  onLoading: () => 'Loading…',
  onFailure: (error) => `Could not load: ${error}`,
  onData: (rows) => `${rows.length} rows`,
});
```

Use `AsyncData.match` when the stale error or the `Refreshing` signal matters.

## Checking an upgrade

- **Types:** run your type checker. Most renames from 0.167 fail at compile
  time; the [0.167 guide](foldkit-0.167.md) lists them.
- **Production build:** build the site. `astro-foldkit` checks the build
  identity and adds module preloads for islands at build time.
- **The packages' contracts:** both packages publish their API surface in
  `etc/api-surface.md`, so an upgrade's surface changes show in its diff.
