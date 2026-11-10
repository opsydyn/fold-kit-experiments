# fold-kit-experiments

A monorepo for [Foldkit](https://foldkit.dev) packages and applications: Astro integration, Viz charts, Three scenes, and Zloz graph and system modelling.

FoldKit is an Elm Architecture runtime for the browser built on [Effect](https://effect.website). This repo explores what it looks like to bring that model into Astro, build D3-quality charts without D3, render Three.js scenes as plain data derived from the Model, and ship the results as reusable primitives.

## Packages

The six packages below are the existing npm releases. The four effect-three packages are released together at one version. Zloz's release-candidate packages are listed separately and remain unpublished.

| Package                                                           | npm                                                                                                                               | Description                                                                                    |
| :---------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------- |
| [`@opsydyn/astro-foldkit`](packages/astro-foldkit/)               | [![npm](https://img.shields.io/npm/v/@opsydyn/astro-foldkit)](https://www.npmjs.com/package/@opsydyn/astro-foldkit)               | Astro integration — client islands plus opt-in FoldKit SSR/SSG page owners                     |
| [`@opsydyn/foldkit-viz`](packages/foldkit-viz/)                   | [![npm](https://img.shields.io/npm/v/@opsydyn/foldkit-viz)](https://www.npmjs.com/package/@opsydyn/foldkit-viz)                   | D3-quality visualisation primitives for FoldKit — no D3 dependency                             |
| [`@opsydyn/effect-three`](packages/effect-three/)                 | [![npm](https://img.shields.io/npm/v/@opsydyn/effect-three)](https://www.npmjs.com/package/@opsydyn/effect-three)                 | Effect-native declarative Three.js: keyed scene updates, scoped GPU resources, headless kernel |
| [`@opsydyn/effect-three-foldkit`](packages/effect-three-foldkit/) | [![npm](https://img.shields.io/npm/v/@opsydyn/effect-three-foldkit)](https://www.npmjs.com/package/@opsydyn/effect-three-foldkit) | FoldKit adapter for effect-three: scene element, typed scene Messages, WebGL2 or WebGPU, WebXR |
| [`@opsydyn/effect-three-rapier`](packages/effect-three-rapier/)   | [![npm](https://img.shields.io/npm/v/@opsydyn/effect-three-rapier)](https://www.npmjs.com/package/@opsydyn/effect-three-rapier)   | Rapier physics for effect-three: bodies, colliders, joints and motors described as data        |
| [`@opsydyn/effect-three-troika`](packages/effect-three-troika/)   | [![npm](https://img.shields.io/npm/v/@opsydyn/effect-three-troika)](https://www.npmjs.com/package/@opsydyn/effect-three-troika)   | troika distance-field labels for effect-three: crisp text at any size, described as data       |

## Foldkit Zloz

**Compose systems. Connect ideas.**

Zloz is Foldkit's functional, extensible graph toolkit for interactive node
editors, C4 architecture modelling and Mermaid export. Compose graphs and ports,
model system boundaries, and communicate through portable diagrams. The selected
Nested frame identity and light/dark styling follow the Viz and Three family.

- **Explore:** [Zloz promo](https://opsydyn.github.io/fold-kit-experiments/zloz/)
  and [Zloz workbench](https://zloz.opsydyn.xyz/).
- **Try locally:** `bun run dev:zloz-promo` (4329) and
  `bun run dev:zloz-demo` (4327). The promo includes a native Foldkit Compose
  example with selection, connection creation and Undo/Redo; the workbench adds
  C4, groups, layouts, policy controls and Mermaid review in a persistent canvas.
- **Read:** [API/type contracts](https://opsydyn.github.io/fold-kit-experiments/zloz/api/),
  [workbench guide](apps/zloz-demo/README.md),
  [promo guide](apps/zloz-promo/README.md) and [hosting](infra/zloz/README.md).

The package family is `@opsydyn/foldkit-zloz*`. Preferred public types and views use
`Zloz*` and `zloz*`; deprecated aliases preserve existing code.
These five packages are **0.1.0 workspace/release candidates, not npm releases**.
Website publication does not publish packages to npm.
See [naming and compatibility](docs/zloz-migration.md) for retained saved-data and integration contracts.

| Package                                                           | Responsibility                                                                                       |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [`@opsydyn/foldkit-zloz`](packages/foldkit-zloz/)                 | Pure graph/editor/geometry contracts, C4/DDD semantics, and optional native views through `/foldkit` |
| [`@opsydyn/foldkit-zloz-elk`](packages/foldkit-zloz-elk/)         | Optional ELK layout adapter                                                                          |
| [`@opsydyn/foldkit-zloz-force`](packages/foldkit-zloz-force/)     | Optional force layout and card-avoiding routing using Foldkit Viz                                    |
| [`@opsydyn/foldkit-zloz-mermaid`](packages/foldkit-zloz-mermaid/) | Pure Mermaid projections, portable review packets and conversion-loss reporting                      |
| [`@opsydyn/foldkit-zloz-cli`](packages/foldkit-zloz-cli/)         | Effect CLI: model validation, causal audits, review packets, Mermaid bundles and JSON diagnostics    |

Canonical JSON preserves the editable model. Mermaid is a projection with explicit
losses; general Mermaid import and npm publication remain separate work. See the
[release preparation guide](docs/releases/foldkit-zloz.md) for packed-consumer checks.
The name comes from Polish **Złóż**: fold, assemble, put together; use **Zloz** externally.

## effect-three

effect-three describes a Three.js scene as plain data derived from your Model. Keyed
updates keep every object in place, Effect owns every lifetime (renderers, GPU
resources, frame loops, listeners), and pointer input comes back as typed FoldKit
Messages. Animation runs in the frame loop and never reaches `update`.

- **Try it:** the [effect-three promo site](https://opsydyn.github.io/fold-kit-experiments/three/), the [tech radar](https://techradar.opsydyn.xyz/), or `/effect-three` in the demo app (the sculpture sample has FoldKit DevTools time travel).
- **Read it:** the package READMEs ([core](packages/effect-three/README.md), [FoldKit adapter](packages/effect-three-foldkit/README.md), [Rapier](packages/effect-three-rapier/README.md), [troika](packages/effect-three-troika/README.md)), and the [plan, decisions and benchmarks](docs/effect-three/).
- **Samples:** [`packages/effect-three-samples`](packages/effect-three-samples/) is shared by the demo app and the promo site.

The four effect-three packages run a stricter, package-local lint policy (every
`@opsydyn/oxlint-effect` rule, TypeScript 7, no disables) and have their own
browser and visual tests (`bun run --filter @opsydyn/effect-three-foldkit test:e2e`).

## Agent Skills

Three independent consumer skills are maintained alongside the packages:

- [astro-foldkit](skills/astro-foldkit/SKILL.md): Astro islands, typed props,
  server-rendered pages, hydration and lifecycle boundaries.
- [foldkit-viz](skills/foldkit-viz/SKILL.md): pure geometry, optional FoldKit
  rendering, chart interaction and accessibility; no Astro dependency.
- [effect-three](skills/effect-three/SKILL.md): 3D scenes derived from the Model,
  the FoldKit adapter, Rapier physics and troika labels, Model-owned cameras and XR,
  WebGL or WebGPU, and headless tests; no Astro dependency.

One skill is for this repository's own app:

- [tech-radar](skills/tech-radar/SKILL.md): adding and moving entries on the tech radar,
  editions, keeping its test fixture in step, previews and deploys.

In Claude Code, this repository is a plugin marketplace: the package skills install as
one plugin, wherever you build with the packages.

```sh
/plugin marketplace add opsydyn/fold-kit-experiments
/plugin install foldkit-packages@opsydyn
```

`tech-radar@opsydyn` is the tech radar's skill, for working in this repository. Other
agents can copy a skill's folder: each is self-contained (`agents/openai.yaml` is Codex's
metadata).

Install any complete skill folder through your agent host's skill installer,
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
│   ├── three-promo/       — effect-three promo site: same layout and themes, live 3D examples
│   ├── zloz-promo/        — Zloz promo: shared family identity, native Compose example, highlighted source
│   ├── zloz-demo/       — Zloz architecture workbench: persistent canvas and left controls
│   ├── tech-radar/        — standalone tech radar: the 3D radar and full pages, from markdown
│   └── docs/              — docs/ as a Starlight site: decisions, spikes, releases, working notes
├── infra/
│   ├── tech-radar/        — Alchemy stack deploying the tech radar to Cloudflare
│   └── zloz/              — independent Alchemy stack for zloz.opsydyn.xyz; no npm release
└── packages/
    ├── astro-foldkit/     — @opsydyn/astro-foldkit  (published to npm; client islands + opt-in SSR/SSG)
    ├── foldkit-viz/       — @opsydyn/foldkit-viz    (published to npm)
    ├── dataset-explorer/ — private shared KeyedQuery example for both apps
    ├── foldkit-zloz/      — Zloz graph core and optional Foldkit views (unpublished)
    ├── foldkit-zloz-elk/  — Zloz ELK layout adapter (unpublished)
    ├── foldkit-zloz-force/ — Zloz force layout/routing adapter (unpublished)
    ├── foldkit-zloz-mermaid/ — Zloz loss-aware Mermaid export (unpublished)
    ├── foldkit-zloz-cli/  — Standalone Effect CLI and agent JSON contracts (unpublished)
    ├── effect-three/      — @opsydyn/effect-three   (for npm, 0.x; Effect-native declarative Three.js core)
    ├── effect-three-foldkit/ — @opsydyn/effect-three-foldkit (for npm; Foldkit adapter)
    ├── effect-three-rapier/  — @opsydyn/effect-three-rapier  (for npm; Rapier physics engine)
    ├── effect-three-troika/  — @opsydyn/effect-three-troika  (for npm; troika label engine)
    └── effect-three-samples/ — private effect-three samples shared by apps/web and three-promo
```

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.4
- Node ≥ 22.22 (Astro 7.4's minimum; also used by Vite and integration tests)

## Getting started

```sh
bun install
bun dev          # demo app at http://localhost:4321
bun run dev:promo # promo site at http://localhost:4322
bun run dev:zloz-promo # Zloz promo at http://localhost:4329
bun run dev:zloz-demo # Zloz workbench at http://localhost:4327
bun run dev:three-promo # effect-three promo site at http://localhost:4323
bun run dev:tech-radar # tech radar at http://localhost:4326
bun run dev:docs # docs site at http://localhost:4327
bun storybook    # chart storybook at http://localhost:6006
```

The demo's `/greeting` route proves request SSR and `/greeting-static` proves
SSG through `definePage`. Existing chart routes remain `lazyApp` / `defineApp`
client islands.

The workspace targets FoldKit `0.169.0`, Effect `4.0.0` and Astro `7.4.0`. Shared dependency
versions are declared once, in the root `package.json` catalogs (see [Dependencies](#dependencies)).
See the [migration guide](docs/migrations/foldkit-0.167.md) before upgrading an
existing consumer from before 0.167 (0.168 and 0.169 need no changes; see the
[0.169 notes](docs/releases/foldkit-0.169.md)); the optional FoldKit peers in Viz remain optional for pure
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

## Dependencies

Versions used by more than one workspace are declared once, in the root `package.json`:
`workspaces.catalog` for everything shared, and `workspaces.catalogs.strict` for the
TypeScript 7 and oxlint versions only the effect-three packages use. Private workspaces
refer to them as `"catalog:"` or `"catalog:strict"`; to upgrade a shared dependency,
change the catalog and run `bun install`.

The packages published to npm (`astro-foldkit`, `foldkit-viz` and the four effect-three
packages) keep literal versions, because CI publishes with `npm publish`, which does not
resolve `catalog:`.
`bun run check` runs `tools/check-catalog.ts`, which fails if a shared dependency is
declared outside the catalog or a published package's version drifts from it.

## Commands

| Command                   | Action                                                |
| :------------------------ | :---------------------------------------------------- |
| `bun dev`                 | Start the demo app at `localhost:4321`                |
| `bun storybook`           | Start Storybook at `localhost:6006`                   |
| `bun build`               | Build the packages, demo app and both promo sites     |
| `bun run dev:promo`       | Start the promo site at `localhost:4322`              |
| `bun run dev:three-promo` | Start the effect-three promo site at `localhost:4323` |
| `bun run dev:tech-radar`  | Start the tech radar at `localhost:4326`              |
| `bun run dev:docs`        | Start the docs site at `localhost:4327`               |
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
- **[Tech radar](https://techradar.opsydyn.xyz/)** — the 3D tech radar and its full pages, from markdown (Cloudflare Workers)
- **[Docs](https://opsydyn.github.io/fold-kit-experiments/docs/)** — decisions, spikes, releases and working notes, from `docs/` (GitHub Pages)
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
