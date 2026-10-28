# @opsydyn/tech-radar

A standalone tech radar: the effect-three radar in 3D, with full pages for each
entry. The plan is `docs/superpowers/plans/2026-10-28-tech-radar-app.md`.

```sh
bun dev:tech-radar   # → localhost:4326
bun run --filter @opsydyn/tech-radar test
bun run --filter @opsydyn/tech-radar typecheck
```

## Pages

| Page                         | Rendered    | What it is                                                   |
| ---------------------------- | ----------- | ------------------------------------------------------------ |
| `/`                          | per request | The 3D radar. Its query string is a deep link                |
| `/blip/<id>/`                | at build    | An entry's full page in the current edition                  |
| `/edition/<date>/blip/<id>/` | at build    | An entry's full page as it stood in an earlier edition       |
| `/edition/<date>/`           | at build    | An edition: its notes, what changed, its entries by category |
| `/category/<id>/`            | at build    | A category's entries in the current edition, by ring         |
| `404`                        | at build    | Unknown addresses                                            |

- **Deep links:** `/?entry=futhark&theme=paragon`, with `&edition=2026-02-14` for an
  earlier edition, or `/?view=cluster:tools`.
- **"Open full page"** on the 3D radar's card opens the entry's page for the edition
  being viewed.
- **The full pages need no JavaScript.** The movement chart is an SVG drawn at build time,
  with a table of the same values.
- `src/radar/pages.ts` works out what each page shows, and is tested in
  `test/pages.test.ts`.

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
markdown is the same radar as the original's fixture, which the tests keep as stable test
data in `src/test/fixture.ts`.

## The radar is a copy

- `src/radar/three` is a copy of `packages/effect-three-samples/src/radar`, with the two
  helpers it imported (`labelledEnvironment.ts`, `renderer.ts`), `lighten` and the samples'
  stylesheet. Its tests are in `test/three` and run with `bun test`.
- The copy takes the radar's data, title and full-page addresses as props, and drops the
  original's demo notice. Otherwise it is as copied.
- The original is not changed by this app. They share libraries only (effect-three, its
  FoldKit adapter, troika and foldkit-viz), so a library fix reaches both, but a radar
  fix, such as a new theme, has to be ported by hand in either direction.

## Hosting

Cloudflare, built and deployed by the Alchemy stack in `infra/tech-radar` (see its README).
The config declares no adapter because Alchemy supplies Cloudflare's, so this app has no
`build` script of its own: `astro dev` serves every page locally, and Alchemy builds it for
deploys.
