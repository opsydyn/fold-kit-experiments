# fold-kit-experiments

A monorepo for ongoing [FoldKit](https://foldkit.dev) experiments — packages, integrations, and a growing library of data visualisation demos.

FoldKit is an Elm Architecture runtime for the browser built on [Effect](https://effect.website). This repo explores what it looks like to bring that model into Astro, build D3-quality charts without D3, and ship the results as reusable primitives.

## Packages

| Package                                             | Description                                                                |
| :-------------------------------------------------- | :------------------------------------------------------------------------- |
| [`@opsydyn/astro-foldkit`](packages/astro-foldkit/) | Astro integration — client islands plus opt-in FoldKit SSR/SSG page owners |
| [`@opsydyn/foldkit-viz`](packages/foldkit-viz/)     | D3-quality visualisation primitives for FoldKit — no D3 dependency         |

## Structure

```text
fold-kit-experiments/
├── apps/
│   ├── web/               — demo Astro app, chart workbenches and interactive Storybook
│   └── promo/             — Foldkit Viz promo site: Astro, light/dark themes
└── packages/
    ├── astro-foldkit/     — @opsydyn/astro-foldkit  (published to npm; client islands + opt-in SSR/SSG)
    ├── foldkit-viz/       — @opsydyn/foldkit-viz    (published to npm)
    └── dataset-explorer/ — private shared KeyedQuery example for both apps
```

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.3
- Node ≥ 22.12 (for Astro, Vite and integration tests)

## Getting started

```sh
bun install
bun dev          # demo app at http://localhost:4321
bun run dev:promo # promo site at http://localhost:4322
bun storybook    # chart storybook at http://localhost:6006
```

The demo's `/greeting` route proves request SSR and `/greeting-static` proves
SSG through `definePage`. Existing chart routes remain `lazyApp` / `defineApp`
client islands.

The workspace targets FoldKit `0.167.0`, Effect `4.0.0` and Astro `7.2.8`.
See the [migration guide](docs/migrations/foldkit-0.167.md) before upgrading an
existing consumer; the optional FoldKit peers in Viz remain optional for pure
geometry imports.

## Reference Workflows

- `/comparison`: add, remove and reorder up to four scatter/histogram panels.
  Stable IDs preserve child state; a parent-owned selection links every matching
  point without replacing each chart's local inspection. Also available as
  `Charts/Comparison` in Storybook and `/examples/comparison/` in the promo.
- `/dataset-explorer`: app-owned KeyedQuery caches, retained data during refresh,
  and stale-response handling. The promo hosts the same private shared app at
  `/examples/datasets/`.
- `/request-diagnostics`: interruptible HTTP work and route-exit cancellation;
  Query stale-response handling does not replace request interruption.

Promo examples include maintained source and standalone project exports.
Comparison exports capture panel kinds, IDs, order, linking and the next ID
counter, not transient measurements or inspection. See the
[qualification record](docs/superpowers/specs/2026-10-08-keyed-chart-comparison-qualification.md)
for automated coverage and outstanding browser acceptance.

## Commands

| Command             | Action                                      |
| :------------------ | :------------------------------------------ |
| `bun dev`           | Start the demo app at `localhost:4321`      |
| `bun storybook`     | Start Storybook at `localhost:6006`         |
| `bun build`         | Build the packages, demo app and promo site |
| `bun run dev:promo` | Start the promo site at `localhost:4322`    |
| `bun run test`      | Run all workspace test scripts sequentially |
| `bun typecheck`     | Typecheck all workspaces                    |
| `bun run check`     | oxlint + oxfmt format check                 |

Use `bun run test` at the root: bare `bun test` bypasses the workspace script
and can traverse vendored reference repositories. To work within a single
workspace, pass `--filter`:

```sh
bun run --filter @opsydyn/astro-foldkit test
bun run --filter @opsydyn/foldkit-viz docs   # build TypeDoc API reference
bun run --filter @opsydyn/web dev
```

## Published docs

- **[Viz examples](https://opsydyn.github.io/fold-kit-experiments/viz/)** — chart examples, maintained source and standalone downloads
- **[Charts](https://opsydyn-web.opsydyn.workers.dev/charts)** — live demo app (Cloudflare Workers)
- **[Storybook](https://opsydyn.github.io/fold-kit-experiments/)** — interactive chart explorer (GitHub Pages)
- **[API reference](https://opsydyn.github.io/fold-kit-experiments/api/)** — foldkit-viz TypeDoc (GitHub Pages)

## Contributing

See the individual package READMEs for usage and changelog:

- [`packages/astro-foldkit/`](packages/astro-foldkit/) — integration source and tests
- [`packages/foldkit-viz/`](packages/foldkit-viz/) — chart primitives source and tests

The demo app in [`apps/web/`](apps/web/) is the primary integration test environment and serves as the reference implementation for both packages.
