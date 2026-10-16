# fold-kit-experiments

A monorepo for ongoing [FoldKit](https://foldkit.dev) experiments — packages, integrations, a growing library of data visualisation demos, and declarative 3D scenes.

FoldKit is an Elm Architecture runtime for the browser built on [Effect](https://effect.website). This repo explores what it looks like to bring that model into Astro, build D3-quality charts without D3, render Three.js scenes as plain data derived from the Model, and ship the results as reusable primitives.

## Packages

| Package                                                           | Description                                                                                            |
| :---------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------- |
| [`@opsydyn/astro-foldkit`](packages/astro-foldkit/)               | Astro integration — client islands plus opt-in FoldKit SSR/SSG page owners                             |
| [`@opsydyn/foldkit-viz`](packages/foldkit-viz/)                   | D3-quality visualisation primitives for FoldKit — no D3 dependency                                     |
| [`@opsydyn/effect-three`](packages/effect-three/)                 | Effect-native declarative Three.js: keyed scene updates, scoped GPU resources (private, pre-release)   |
| [`@opsydyn/effect-three-foldkit`](packages/effect-three-foldkit/) | FoldKit adapter for effect-three: scene element, typed pointer Messages, WebGL2 (private, pre-release) |

## effect-three

effect-three describes a Three.js scene as plain data derived from your Model. Keyed
updates keep every object in place, Effect owns every lifetime (renderers, GPU
resources, frame loops, listeners), and pointer input comes back as typed FoldKit
Messages. Animation runs in the frame loop and never reaches `update`.

- **Try it:** the [effect-three promo site](https://opsydyn.github.io/fold-kit-experiments/three/), or `/effect-three` in the demo app (the sculpture sample has FoldKit DevTools time travel).
- **Read it:** the package READMEs ([core](packages/effect-three/README.md), [FoldKit adapter](packages/effect-three-foldkit/README.md)), and the [plan, decisions and benchmarks](docs/effect-three/).
- **Samples:** [`packages/effect-three-samples`](packages/effect-three-samples/) is shared by the demo app and the promo site.

Both library packages run a stricter, package-local lint policy (every
`@opsydyn/oxlint-effect` rule, TypeScript 7, no disables) and have their own
browser and visual tests (`bun run --filter @opsydyn/effect-three-foldkit test:e2e`).

## Agent Skills

Two independent consumer skills are maintained alongside the packages:

- [astro-foldkit](skills/astro-foldkit/SKILL.md): Astro islands, typed props,
  server-rendered pages, hydration and lifecycle boundaries.
- [foldkit-viz](skills/foldkit-viz/SKILL.md): pure geometry, optional FoldKit
  rendering, chart interaction and accessibility; no Astro dependency.

Install either complete skill folder through your agent host's skill installer,
preserving its `SKILL.md`, `agents`, `references` and `assets`. They are not
installed by the npm packages and do not require each other. Each includes a
standalone pinned example; see the [qualification notes](docs/examples/package-skills.md)
for checks and limitations.

## Structure

```text
fold-kit-experiments/
├── apps/
│   ├── web/               — demo Astro app, chart workbenches and interactive Storybook
│   ├── promo/             — Foldkit Viz promo site: Astro, light/dark themes
│   └── three-promo/       — effect-three promo site: same layout and themes, live 3D examples
└── packages/
    ├── astro-foldkit/     — @opsydyn/astro-foldkit  (published to npm; client islands + opt-in SSR/SSG)
    ├── foldkit-viz/       — @opsydyn/foldkit-viz    (published to npm)
    ├── dataset-explorer/ — private shared KeyedQuery example for both apps
    ├── effect-three/      — @opsydyn/effect-three   (private; Effect-native declarative Three.js core)
    ├── effect-three-foldkit/ — @opsydyn/effect-three-foldkit (private; Foldkit adapter)
    └── effect-three-samples/ — private effect-three samples shared by apps/web and three-promo
```

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.4
- Node ≥ 22.12 (for Astro, Vite and integration tests)

## Getting started

```sh
bun install
bun dev          # demo app at http://localhost:4321
bun run dev:promo # promo site at http://localhost:4322
bun run dev:three-promo # effect-three promo site at http://localhost:4323
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
- `/effect-three`: seven effect-three samples. The reconciliation playground
  reports every update's operations and live GPU resources; the sculpture rewinds
  with FoldKit DevTools time travel; shared resources shows reference-counted
  geometry and materials, and releasing a scene's WebGL context on unmount; the 3D bar
  chart places bars with foldkit-viz scales and eases them as the data changes; the
  studio drags pieces in five material kinds under point, spot and hemisphere lights with
  soft shadows; the city draws 10,000 buildings in one instanced mesh, on demand; the workshop loads a
  glTF robot and a texture through Commands and plays its clips.

Promo examples include maintained source and standalone project exports.
Comparison exports capture panel kinds, IDs, order, linking and the next ID
counter, not transient measurements or inspection. See the
[qualification record](docs/superpowers/specs/2026-10-08-keyed-chart-comparison-qualification.md)
for automated coverage and outstanding browser acceptance.

## Commands

| Command                   | Action                                                |
| :------------------------ | :---------------------------------------------------- |
| `bun dev`                 | Start the demo app at `localhost:4321`                |
| `bun storybook`           | Start Storybook at `localhost:6006`                   |
| `bun build`               | Build the packages, demo app and both promo sites     |
| `bun run dev:promo`       | Start the promo site at `localhost:4322`              |
| `bun run dev:three-promo` | Start the effect-three promo site at `localhost:4323` |
| `bun run test`            | Run all workspace test scripts sequentially           |
| `bun typecheck`           | Typecheck all workspaces                              |
| `bun run check`           | oxlint + oxfmt format check                           |

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
- **[effect-three](https://opsydyn.github.io/fold-kit-experiments/three/)** — live 3D examples, their source and a guide
- **[Charts](https://opsydyn-web.opsydyn.workers.dev/charts)** — live demo app (Cloudflare Workers)
- **[Storybook](https://opsydyn.github.io/fold-kit-experiments/)** — interactive chart explorer (GitHub Pages)
- **[API reference](https://opsydyn.github.io/fold-kit-experiments/api/)** — foldkit-viz TypeDoc (GitHub Pages)

## Contributing

See the individual package READMEs for usage and changelog:

- [`packages/astro-foldkit/`](packages/astro-foldkit/) — integration source and tests
- [`packages/foldkit-viz/`](packages/foldkit-viz/) — chart primitives source and tests
- [`packages/effect-three/`](packages/effect-three/) and [`packages/effect-three-foldkit/`](packages/effect-three-foldkit/) — 3D core and FoldKit adapter; read [`docs/effect-three/`](docs/effect-three/) before changing them

The demo app in [`apps/web/`](apps/web/) is the primary integration test environment and serves as the reference implementation for the packages.

The root lint uses `@opsydyn/oxlint-effect` 2.x (Effect 4 policy). Twelve rules new
in its 2.x preset already have findings in this repo, so they start off; they are
listed with their finding counts in [`oxlint.config.ts`](oxlint.config.ts) as an
adoption backlog.

The promo Signal desk at `/examples/signals/` composes quality-aware observations, an independent captured baseline and caller-owned instant events. Exact event guides retain separate source provenance without treating temporal proximity as causation. See the [event-lane qualification](docs/superpowers/specs/2026-10-05-signal-event-lane-qualification.md) for local evidence and remaining device/accessibility gates.
