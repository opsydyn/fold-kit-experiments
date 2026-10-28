# @opsydyn/tech-radar

A standalone tech radar: the effect-three radar in 3D and 2D, with full pages for each
entry. The plan is `docs/superpowers/plans/2026-10-28-tech-radar-app.md`.

```sh
bun dev:tech-radar   # → localhost:4326
bun run --filter @opsydyn/tech-radar test
bun run --filter @opsydyn/tech-radar typecheck
```

## Pages

- `/` is the 3D radar. It renders per request, so its query string is a deep link
  (`/?entry=futhark&theme=paragon`, `&edition=2026-02-14`).
- `/2d/` is the 2D radar.

## Content

The radar is markdown in `src/content`:

- `radar.md`: the title, and an introduction as its body.
- `editions/<date>.md`: one per edition, named by its date, with a `label`. The newest is
  the current edition.
- `entries/<id>.md`: one per entry, named by its id. The body is its full-page write-up.

```markdown
---
name: FoldKit
category: languages-frameworks # techniques, tools, platforms or languages-frameworks
ring: adopt # in the current edition: adopt, trial, assess or caution
summary: Model, Message and update-driven interfaces built on TypeScript and Effect.
source: https://foldkit.dev/
history: # the earlier editions it was on, and its ring then
  - edition: '2025-10-14'
    ring: assess
related: # relationships it starts
  - to: elm
    type: inspired-by # builds-on, complements, inspired-by, guards-against or alternative-to
    note: "FoldKit's Model, Message and update loop follow the Elm Architecture."
---
```

`src/radar/content.ts` assembles the files into the radar's dataset at build time. A bad
edit stops the build with the file that caused it. `test/content.test.ts` proves the
markdown is the same radar as the original's fixture.

## The radars are copies

- `src/radar/three` is a copy of `packages/effect-three-samples/src/radar`, with the two
  helpers it imported (`labelledEnvironment.ts`, `renderer.ts`), `lighten` and the samples'
  stylesheet. Its tests are in `test/three` and run with `bun test`.
- `src/radar/flat` is a copy of `apps/web/src/apps/functional-ai-radar`. Its tests sit
  beside it and run with vitest, as in apps/web.
- The originals are not changed by this app. They share libraries only (effect-three, its
  FoldKit adapter, troika and foldkit-viz), so a library fix reaches both, but a radar
  fix, such as a new theme, has to be ported by hand in either direction.

## Hosting

Cloudflare, deployed with Alchemy, once the site is complete locally. The config declares
no adapter because Alchemy supplies Cloudflare's. Until then, `astro dev` serves every page,
and a production build waits for that adapter.
