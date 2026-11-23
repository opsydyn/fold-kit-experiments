# FoldKit 0.171 release notes

The workspace moves from FoldKit `0.170.0` to `0.171.0`. Effect stays on `4.1.0`.

- `foldkit`, `@foldkit/devtools` and `@foldkit/ui` `0.170.0` to `0.171.0`
- `@foldkit/vite-plugin` (`^0.29.0`) and `@foldkit/oxlint-plugin` were already satisfied by
  their carets; `@foldkit/devtools-mcp` `0.26.0` is current
- Node.js 22.19 or newer is still the floor, from 0.170. This repository requires 22.22 and
  CI runs Node 24.

## What changed upstream

`0.171.0` is a **breaking release despite an unchanged manifest**: both breaks are source
compatible until the compiler looks at them.

- **`Command.define`, `Mount.define` and `Mount.defineStream` narrowed `messages`** to a
  non-empty tuple. A define that declared no result Messages, or `Schema.Never`, no longer
  compiles. A generic factory that forwards its Messages needs
  `Command.ResultMessageSchemas<Messages>` or `Mount.ResultMessageSchemas<Messages>` rather
  than a bare array type.
- **`createKeyedLazy` inverted its default eviction.** `evict` now defaults to
  `AbsentFromRender`: entries unused by a completed render are released, which bounds the
  cache to the latest render. The old retain-everything behaviour is `{ evict: 'None' }`,
  for bounded sets only (an entity registry, a route table, fixed call sites) because every
  retained entry holds its VNode and its DOM element after that element leaves the document.

Three changes arrive without a source change, and are the reason to take this release:

- **Rendering is no longer postponed indefinitely under sustained Message traffic.** A
  stream of Messages arriving faster than frames could previously starve the render.
- **`Subscription.animationFrameEntry` dispatches in the same frame** it was scheduled in,
  instead of the next one. Nine subscription modules here use it, so every animation loop
  loses a frame of latency for free.
- **`EmbedHandle.disposeAsync`** lets a host await runtime shutdown and container
  restoration, rather than firing `dispose` and hoping. Mount finalizers may still finish
  after it resolves.

Source: [FoldKit 0.171.0](https://foldkit.dev/blog/foldkit-0-171-0).

## What changed here

- **No source changes** were needed in the apps or packages.
  - `createKeyedLazy` has no call sites, so the inverted default reaches nothing. One place
    hand-rolls exactly what it now does: `apps/zloz-team/src/editor/connections-view.ts`
    keys `createLazy` slots by edge id and deletes the keys absent from the render, which is
    the new `AbsentFromRender` default. That one is a direct replacement.
  - The other three `createLazy` registries are **not** candidates. `ports-view.ts`,
    `nodes-view.ts` and `packages/foldkit-zloz/src/node-body-cache.ts` key a `WeakMap` by
    node identity so slots die with their node, which `node-body-cache.ts` documents as
    deliberate: "weak node identities avoid retaining an ever-growing registry of deleted
    IDs". `createKeyedLazy` takes a `PropertyKey` and holds it strongly, so swapping one in
    would reintroduce the registry of deleted ids that the `WeakMap` exists to avoid.
  - All 176 `define` call sites already pass non-empty message lists, and nothing declares
    `Schema.Never` as a result.
- **`EmbedHandle.disposeAsync` was assessed for `astro-foldkit` and deliberately not
  adopted.** Its documented purpose is to await shutdown before embedding a _different_
  program in the same container. `packages/astro-foldkit/src/client.ts` keeps one program per
  island element in a `WeakMap` (`islandPrograms`) and re-embeds that same program on every
  re-hydration, with `container` derived from the same element, so a container never hosts a
  second program and that case cannot arise. Re-embedding the same program already waits for
  the prior fiber to exit and the mount to be restored, which the code comments at the
  `runtime.embed` call. Converting would also mean making `dispose` return a promise that its
  only callers — an `astro:unmount` listener and the render-failure path, both void — cannot
  await, trading a synchronous idempotent teardown for an unobserved rejection. Left as is.

- **The version is not only in manifests.** Besides the root catalog and the exact literals
  in package `devDependencies`, `0.170.0` was named in skill assets, in SKILL.md prose, in a
  documented peer range, and in the generated-starter templates under `apps/promo`, where a
  test asserts the generated manifest pins whatever the catalog pins. `check-skills.ts` and
  `promo:test` each caught a stale reference that a manifest-only edit left behind.
- **`foldkit-zloz-mermaid`'s `foldkit` peer became a range** rather than moving its exact pin
  to `0.171.0`. The exact pin conflicted with its own integration test, which installs a
  hard-coded FoldKit into a clean npm consumer; a range also matches `foldkit-zloz`. Its
  `devDependency` still pins `0.171.0`, so it builds against the new version while declaring
  both.
- **Earlier notes, migration guides and profiling evidence naming `0.170.0` are unchanged.**
  They record what was true then.

## The published packages

Every peer range widened to admit both lines, so an app can move FoldKit without waiting for
a package release:

| Package                         | Was                          | Now                          |
| ------------------------------- | ---------------------------- | ---------------------------- |
| `@opsydyn/astro-foldkit`        | FoldKit `>=0.170.0 <0.171.0` | FoldKit `>=0.170.0 <0.172.0` |
| `@opsydyn/foldkit-viz`          | FoldKit `>=0.167.0 <0.171.0` | FoldKit `>=0.167.0 <0.172.0` |
| `@opsydyn/effect-three-foldkit` | FoldKit `>=0.167.0 <0.171.0` | FoldKit `>=0.167.0 <0.172.0` |
| `@opsydyn/foldkit-zloz`         | FoldKit `>=0.170.0 <0.171.0` | FoldKit `>=0.170.0 <0.172.0` |
| `@opsydyn/foldkit-zloz-mermaid` | FoldKit `0.170.0` (exact)    | FoldKit `>=0.170.0 <0.172.0` |

`@opsydyn/foldkit-phosphor` widened the same way and is private, so it never reaches npm.

## Releasing

**A widened range in the repository is not a widened range on npm.** Each of these packages
is published at a version whose manifest is already on the registry and cannot be rewritten,
so until a new version ships, `npm install @opsydyn/<pkg> foldkit@0.171.0` still fails with
`ERESOLVE`:

| Package                         | On npm   | Its peer there               | How the fix ships                                                                            |
| ------------------------------- | -------- | ---------------------------- | -------------------------------------------------------------------------------------------- |
| `@opsydyn/astro-foldkit`        | `0.13.0` | FoldKit `>=0.170.0 <0.171.0` | release-please patch, then automatic `npm publish`                                           |
| `@opsydyn/foldkit-viz`          | `0.19.0` | FoldKit `>=0.167.0 <0.171.0` | release-please patch, then automatic `npm publish`                                           |
| `@opsydyn/effect-three-foldkit` | `0.6.4`  | FoldKit `>=0.167.0 <0.171.0` | linked release of all four effect-three packages, then four ordered `publish.yml` dispatches |
| `@opsydyn/foldkit-zloz`         | `0.7.0`  | FoldKit `>=0.170.0 <0.171.0` | `0.8.0` is already tagged; the release train must run at `058d3e53` or later                 |
| `@opsydyn/foldkit-zloz-mermaid` | `0.6.2`  | FoldKit `0.170.0` (exact)    | as above; this one is two minors behind and pins FoldKit exactly                             |

A `chore:` upgrade commit bumps nothing, so the two auto-published packages need a `fix:`
commit touching their own paths before release-please will cut a patch.
