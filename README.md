# astro-foldkit

Monorepo for [`@opsydyn/astro-foldkit`](packages/astro-foldkit/) — an Astro integration for [FoldKit](https://foldkit.dev) — and its demo app.

FoldKit is an Elm Architecture runtime for the browser built on [Effect](https://effect.website). This repo wires it into Astro as a first-class renderer so FoldKit apps can be dropped into `.astro` pages as components with `client:load`.

## Structure

```text
astro-foldkit/
├── apps/
│   └── web/               — demo Astro app (counter, health dashboard)
└── packages/
    └── astro-foldkit/     — @opsydyn/astro-foldkit (published to npm)
```

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.3
- Node ≥ 22 (for the smoke tests)

## Getting started

```sh
bun install
bun dev        # http://localhost:4321
```

## Commands

| Command          | Action                                               |
| :--------------- | :--------------------------------------------------- |
| `bun dev`        | Start the demo app at `localhost:4321`               |
| `bun build`      | Build the package, then build the demo app           |
| `bun test`       | Run all tests across every workspace                 |
| `bun typecheck`  | Typecheck all workspaces                             |

To work within a single workspace, pass `--filter`:

```sh
bun run --filter @opsydyn/astro-foldkit test
bun run --filter @opsydyn/web dev
```

## Contributing

See [`packages/astro-foldkit/`](packages/astro-foldkit/) for the integration source, tests, and changelog. The demo app in [`apps/web/`](apps/web/) is the primary integration test environment.
