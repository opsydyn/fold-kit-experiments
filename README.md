# fold-kit-experiments

A monorepo for ongoing [FoldKit](https://foldkit.dev) experiments — packages, integrations, and a growing library of data visualisation demos.

FoldKit is an Elm Architecture runtime for the browser built on [Effect](https://effect.website). This repo explores what it looks like to bring that model into Astro, build D3-quality charts without D3, and ship the results as reusable primitives.

## Packages

| Package                                             | Description                                                                  |
| :-------------------------------------------------- | :--------------------------------------------------------------------------- |
| [`@opsydyn/astro-foldkit`](packages/astro-foldkit/) | Astro integration — drop FoldKit apps into `.astro` pages with `client:load` |
| [`@opsydyn/foldkit-viz`](packages/foldkit-viz/)     | D3-quality visualisation primitives for FoldKit — no D3 dependency           |

## Structure

```text
fold-kit-experiments/
├── apps/
│   └── web/               — demo Astro app: 49 chart types, interactive storybook
└── packages/
    ├── astro-foldkit/     — @opsydyn/astro-foldkit  (published to npm)
    └── foldkit-viz/       — @opsydyn/foldkit-viz    (published to npm)
```

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.3
- Node ≥ 22 (for integration tests)

## Getting started

```sh
bun install
bun dev          # demo app at http://localhost:4321
bun storybook    # chart storybook at http://localhost:6006
```

## Commands

| Command         | Action                                      |
| :-------------- | :------------------------------------------ |
| `bun dev`       | Start the demo app at `localhost:4321`      |
| `bun storybook` | Start Storybook at `localhost:6006`         |
| `bun build`     | Build all packages, then build the demo app |
| `bun test`      | Run all tests across every workspace        |
| `bun typecheck` | Typecheck all workspaces                    |
| `bun check`     | oxlint + oxfmt format check                 |

To work within a single workspace, pass `--filter`:

```sh
bun run --filter @opsydyn/astro-foldkit test
bun run --filter @opsydyn/foldkit-viz docs   # build TypeDoc API reference
bun run --filter @opsydyn/web dev
```

## Published docs

- **[Charts](https://opsydyn-web.opsydyn.workers.dev/charts)** — live demo app (Cloudflare Workers)
- **[Storybook](https://opsydyn.github.io/fold-kit-experiments/)** — interactive chart explorer (GitHub Pages)
- **[API reference](https://opsydyn.github.io/fold-kit-experiments/api/)** — foldkit-viz TypeDoc (GitHub Pages)

## Contributing

See the individual package READMEs for usage and changelog:

- [`packages/astro-foldkit/`](packages/astro-foldkit/) — integration source and tests
- [`packages/foldkit-viz/`](packages/foldkit-viz/) — chart primitives source and tests

The demo app in [`apps/web/`](apps/web/) is the primary integration test environment and serves as the reference implementation for both packages.
