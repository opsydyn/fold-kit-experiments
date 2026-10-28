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
