# FoldKit 0.170 release notes

The workspace moves from FoldKit `0.169.0` to `0.170.0`, and from Effect `4.0.0` to `4.1.0`,
along with:

- `@foldkit/vite-plugin` `0.28` to `0.29`
- `@foldkit/devtools-mcp` `0.25.0` to `0.26.0`
- `@foldkit/ui` and `@foldkit/devtools` `0.169.0` to `0.170.0`
- `@effect/platform-browser` `4.0.0` to `4.1.0`

## What changed upstream

- **FoldKit 0.170.0** moves FoldKit and its companions to Effect 4.1. They peer on
  `~4.1.0`: 4.1 patch releases are accepted, and the next Effect minor will need a FoldKit
  release, because Effect minors can change APIs.
  - The Node adapter, Vite plugin and DevTools MCP server need Node.js 22.19 or newer. This
    repository already requires 22.22 and CI runs Node 22.
  - Effect 4.1 starts `Stream.callback` setup immediately. A Mount whose acquisition waits
    on something asynchronous and must stop on unmount should pass `{ interruptible: true }`
    to `Effect.acquireRelease` and build its handle after the wait.
- **Effect 4.1.0** replaces `Crypto.Crypto` with services in `effect/crypto` (`SecureRandom`,
  `Digest` and others), provided explicitly. Its other breaking changes are in AI errors,
  `McpServer`, HTTP method typing, `KeyValueStore`, `FileSystem.make`, `ChildProcess` and SQL.

Sources: [FoldKit 0.170.0](https://github.com/foldkit/foldkit/releases/tag/foldkit%400.170.0)
and [Effect 4.1.0](https://github.com/Effect-TS/effect/releases/tag/effect%404.1.0).

## What changed here

- **No source changes** were needed in the apps or packages.
  - Nothing uses Effect's `Crypto` service; the four UUIDs here come from the platform's
    `crypto.randomUUID()`.
  - None of Effect 4.1's other breaking areas are used.
  - The Mounts and scene runtimes that wait on something asynchronous (effect-three's
    renderer and physics, the promo's editor embeds) acquire synchronously and wait
    afterwards, so an unmount during the wait interrupts it as before.
  - The effect-three samples' relay sockets wait for the socket to open inside their
    acquisition, so a teardown mid-connect waits for the connect. That is not new in 4.1
    (acquisitions were always uninterruptible). Fixing it means creating the socket first
    and waiting for it to open afterwards, and is left to the samples.
- **One test changed, for a stricter Effect.** In `apps/web`, the agent analysis stream is a
  Web `ReadableStream` with a one-event buffer. Effect 4.0's bridge produced one event beyond
  that buffer even with no reader; 4.1's waits for a read. The test "aborting after the
  snapshot clears every delayed event" never read the body, so it no longer saw
  `STATE_SNAPSHOT`. It now reads the stream as a client does. The server behaves the same
  for any client that reads.
- **A development-only warning.** FoldKit's DevTools bridge encodes the Model as JSON, and
  Effect 4.1 rejects values that are not JSON. The animated bar chart on `/charts` keeps
  foldkit-viz `Tween`s, which hold their easing function, so in development the console
  shows `SchemaError: Expected JSON value at ["tweens"]`. The chart works; nothing ships
  differently. Keeping only data in that Model (an easing name, not the function) would
  silence it.
- **One Effect for the whole repository, infra included.** Alchemy accepts `effect ^4.0.5`,
  which includes 4.1.0, so `infra/tech-radar` drops its own Effect 4.0.7 and takes the
  default catalog's. The `infra` catalog keeps the Alchemy packages and moves
  `@effect/platform-node` and `@effect/platform-bun` to 4.1.0. The single-Effect check now
  walks `infra/` too. This meets the first of the conditions the `@alchemy.run/domain`
  review set (`docs/superpowers/plans/2026-10-28-tech-radar-app.md`).
- **The published packages:**

  | Package                         | Was                                                                                          | Now                                                                                                 |
  | ------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
  | `@opsydyn/astro-foldkit`        | FoldKit `>=0.167.0 <0.170.0`; depends on Effect `4.0.0` and `@foldkit/vite-plugin` `^0.28.0` | FoldKit `>=0.170.0 <0.171.0`; peers on Effect `~4.1.0`; depends on `@foldkit/vite-plugin` `^0.29.0` |
  | `@opsydyn/foldkit-viz`          | FoldKit `>=0.167.0 <0.170.0`                                                                 | FoldKit `>=0.167.0 <0.171.0`                                                                        |
  | `@opsydyn/effect-three-foldkit` | FoldKit `>=0.167.0 <0.170.0`                                                                 | FoldKit `>=0.167.0 <0.171.0`                                                                        |
  - `astro-foldkit` moves to FoldKit 0.170 only, because the Vite plugin it depends on
    needs Effect 4.1.
  - Effect becomes a **peer** of `astro-foldkit`, not a dependency. It imports Effect at
    runtime and shares Effect values with FoldKit, so it must use the app's copy. With
    FoldKit on `~4.1.0`, an exact dependency would install a second Effect beside an app's
    4.1.x patch.
  - `foldkit-viz` and `effect-three-foldkit` accept both lines; their Effect peers
    (`>=4.0.0 <5.0.0` and `^4.0.0`) already include 4.1.

- **The promo's downloadable projects** pin FoldKit `0.170.0`, Effect `4.1.0` and the Vite
  plugin `0.29.0`.
- **Skills:** `skills/astro-foldkit`, `skills/foldkit-viz` and `skills/effect-three` describe
  the _published_ packages. They stay on their tested baselines until releases with the new
  ranges are on npm.

## Releasing

`astro-foldkit` and `foldkit-viz` release through release-please once this merges.
`effect-three-foldkit` is published by the manual workflow, which needs approval.
