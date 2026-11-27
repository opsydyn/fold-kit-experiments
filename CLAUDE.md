# CLAUDE.md — fold-kit-experiments

Project conventions and agent guidance for this monorepo.

## Quick orientation

Bun workspace monorepo (`packages/*`, `apps/*`, `infra/*`, `tools/testing`).

**Published to npm** — these keep literal dependency versions, never `catalog:`:

| Workspace                       | Path                             | Purpose                                                 |
| ------------------------------- | -------------------------------- | ------------------------------------------------------- |
| `@opsydyn/astro-foldkit`        | `packages/astro-foldkit/`        | Astro integration forwarding to the standalone renderer |
| `@opsydyn/foldkit-viz`          | `packages/foldkit-viz/`          | D3-quality chart primitives (no D3 dep)                 |
| `@opsydyn/effect-three`         | `packages/effect-three/`         | Effect-native declarative Three.js core (0.x)           |
| `@opsydyn/effect-three-foldkit` | `packages/effect-three-foldkit/` | Effect UI adapter for effect-three                      |
| `@opsydyn/effect-three-rapier`  | `packages/effect-three-rapier/`  | Rapier physics for effect-three (0.x)                   |
| `@opsydyn/effect-three-troika`  | `packages/effect-three-troika/`  | Troika distance-field text for effect-three (0.x)       |
| `@opsydyn/foldkit-zloz`         | `packages/foldkit-zloz/`         | Model-owned graph editing and native Effect UI views    |
| `@opsydyn/foldkit-zloz-elk`     | `packages/foldkit-zloz-elk/`     | Optional ELK layout adapter for Zloz                    |
| `@opsydyn/foldkit-zloz-force`   | `packages/foldkit-zloz-force/`   | Optional force layout and card-avoiding routing         |
| `@opsydyn/foldkit-zloz-mermaid` | `packages/foldkit-zloz-mermaid/` | Optional, loss-aware Mermaid export for Zloz            |

The effect-three four release together, and the foldkit-zloz four release together: each
group is a `linked-versions` group in `release-please-config.json`, so one bump moves all
four and rewrites the adapters' peer on the core. Only `astro-foldkit` and `foldkit-viz`
publish automatically; the other eight need a `publish.yml` dispatch or the zloz release
train. See the [migration guide](docs/assessments/2026-11-26-effect-ui-1.0-migration.md) for the private candidate and the release status.

**Private packages:**

The standalone Astro renderer lives in [`packages/astro-effect-ui`](packages/astro-effect-ui/README.md).

| Workspace                       | Path                             | Purpose                                                   |
| ------------------------------- | -------------------------------- | --------------------------------------------------------- |
| `@opsydyn/effect-three-samples` | `packages/effect-three-samples/` | effect-three samples shared by `apps/web` and three-promo |
| `@opsydyn/dataset-explorer`     | `packages/dataset-explorer/`     | Shared KeyedQuery example                                 |
| `@opsydyn/foldkit-dash`         | `packages/foldkit-dash/`         | Agent-first static dashboards CLI (ADR 0109)              |
| `@opsydyn/foldkit-phosphor`     | `packages/foldkit-phosphor/`     | Parent-builder Phosphor SVG rendering, static compiler    |
| `@opsydyn/foldkit-viz-py`       | `packages/foldkit-viz-py/`       | foldkit-viz as a Jupyter anywidget                        |
| `@opsydyn/foldkit-zloz-cli`     | `packages/foldkit-zloz-cli/`     | Effect CLI: Zloz validation, audits, Mermaid export       |
| `@opsydyn/foldkit-zloz-alchemy` | `packages/foldkit-zloz-alchemy/` | Read-only Alchemy declaration inspection and projection   |

**Apps:**

| Workspace                 | Path                   | Purpose                                                    |
| ------------------------- | ---------------------- | ---------------------------------------------------------- |
| `@opsydyn/web`            | `apps/web/`            | Chart demos and reference workbenches                      |
| `@opsydyn/promo`          | `apps/promo/`          | Static chart examples and downloadable projects            |
| `@opsydyn/three-promo`    | `apps/three-promo/`    | effect-three promo site (same layout and styling as promo) |
| `@opsydyn/zloz-promo`     | `apps/zloz-promo/`     | Zloz promo site                                            |
| `@opsydyn/zloz-demo`      | `apps/zloz-demo/`      | Zloz workbench demo                                        |
| `@opsydyn/zloz-team`      | `apps/zloz-team/`      | Teams: collaborative Zloz board, the most active app       |
| `@opsydyn/zloz-server`    | `apps/zloz-server/`    | Teams' server: Better Auth, D1, WebSocket rooms            |
| `@opsydyn/tech-radar`     | `apps/tech-radar/`     | Standalone tech radar: the 3D radar, markdown content      |
| `@opsydyn/polars-summary` | `apps/polars-summary/` | Server-summarised million-row Polars frame beside /explore |
| `@opsydyn/docs`           | `apps/docs/`           | `docs/` as a Starlight site (GitHub Pages `/docs/`)        |

**Infra** — separate Alchemy CLI programs, see [Dependencies](#dependencies):

| Workspace                   | Path                | Purpose                                              |
| --------------------------- | ------------------- | ---------------------------------------------------- |
| `@opsydyn/tech-radar-infra` | `infra/tech-radar/` | Alchemy stack deploying the tech radar to Cloudflare |
| `@opsydyn/zloz-infra`       | `infra/zloz/`       | Alchemy stack for the Zloz workbench on Workers      |

The effect-three packages (core, Effect UI adapter, Rapier, troika) run a **stricter, package-local lint policy** (`oxlint.strict.ts`, `@opsydyn/oxlint-effect@2.0.1`, all rules, TypeScript 7). Read `docs/effect-three/PLAN.md` and `docs/effect-three/adr/` before changing them.

**Stack:** Effect UI · Effect 4.1.6 · Astro · TypeScript · bun · oxlint · oxfmt

## Dev commands

Package consumer guidance lives in independent skills:
`skills/astro-foldkit/SKILL.md`, `skills/foldkit-viz/SKILL.md` and
`skills/effect-three/SKILL.md` (3D scenes: core, Effect UI adapter, Rapier, troika).
Read the one relevant to the task; none requires another or an upstream checkout.
Combine them only for tasks that span those packages. Their examples pin the catalog's
versions (`tools/check-skills.ts`, part of `bun run check`): upgrading Effect UI, Effect or
Astro means re-qualifying them (`docs/examples/package-skills.md`).
`skills/tech-radar/SKILL.md` covers the tech radar's content, editions and deploys.
`skills/foldkit-dash/SKILL.md` covers static dashboards built with `foldkit-dash`.

```sh
bun dev                               # demo app → localhost:4321
bun storybook                         # chart storybook → localhost:6006
bun run test                          # workspace tests, then package integrations
bun typecheck                         # all workspaces
bun run check                         # oxlint + oxfmt --check (both must pass)
bun run check:fix                     # oxfmt then oxlint --fix
bun run --filter @opsydyn/web dev     # single workspace
bun dev:three-promo                   # effect-three promo → localhost:4323
bun dev:tech-radar                    # tech radar → localhost:4326
bun dev:docs                          # docs site → localhost:4327
bun run relay                         # editor relay → ws://localhost:4325/<room>
```

Astro 7 runs `astro dev` in the background when an agent starts it: stop it with
`bunx astro dev stop` in the app's directory (`status` and `logs` also work). A test that
starts a dev server should pass `--ignore-lock` to keep it in the foreground.

`.mcp.json` registers the local Effect UI DevTools endpoint and the scene MCP
server. Run `bun run dev:effect-ui-tools`, then
`PUBLIC_EFFECT_UI_DEVTOOLS=1 bun run dev:three-promo` and open an editor,
sculpture, or room example. The overlay and socket are development-only.
`scene_runtimes` lists sessions. Pass its session ID as `runtime_id` to inspect a
scene. The tools read the root component by default and accept an explicit
`instance` from `list_instances`. Dispatch is disabled by default.

## Dependencies

Shared dependency versions live once, in the root `package.json` catalogs
(`workspaces.catalog`, plus `workspaces.catalogs.strict` for the effect-three packages'
TypeScript 7 and oxlint). In private workspaces write `"catalog:"` (or
`"catalog:strict"`), never a version. The npm-published packages (`astro-foldkit`,
`foldkit-viz`, the effect-three family and the ZLOZ family) keep literal dependency
versions equal to the catalog where they share dependencies. The catalog pins
Effect, Effect UI and the Effect platform packages together. `bun run check`
verifies the declarations through `tools/check-catalog.ts`.

`infra/*` workspaces are separate programs (Alchemy CLIs) on the apps' Effect 4.1 from the
main catalog, with the Alchemy packages from `workspaces.catalogs.infra` (`"catalog:infra"`).
Alchemy `2.0.0-beta.85` is the first release on Effect 4.1 (see
`docs/releases/alchemy-beta-85.md`); `packages/effect-three/scripts/check-single-effect.ts`
checks that the apps, packages and infra load one Effect. Its Cloudflare state store is v8:
never deploy with an older Alchemy (a branch from before beta.85) against it.

The tech radar (`apps/tech-radar`) works from a copy of the effect-three sample radar, and
leaves the original unchanged. Its content is markdown in
`apps/tech-radar/src/content`. `.github/workflows/deploy-tech-radar.yml` deploys it with
Alchemy: production on `main`, previews for PRs labelled `preview`. See the app's and the
infra workspace's READMEs.

## Docs, decisions and spikes

`docs/` is the record of what was decided, tried and shipped; `apps/docs` publishes it
unchanged as a Starlight site. Decisions go in `docs/adr/` (or a package's own `adr/`),
spike findings in `docs/spikes/`, upgrade notes in `docs/releases/`. Every file starts
with a `#` heading, which becomes its page title; relative links work on GitHub and on the
site. A new folder needs a sidebar entry in `apps/docs/astro.config.ts`.

## Linting — oxlint + oxfmt

Biome was removed. The project uses oxlint (linter) and oxfmt (formatter).

**Running oxlint directly requires `NODE_OPTIONS`** because `oxlint.config.ts` is a TypeScript config file:

```sh
NODE_OPTIONS="--experimental-strip-types" bunx oxlint .
```

The `bun run check` script already includes this flag — prefer `bun run check` over calling oxlint directly.

Config files:

- `oxlint.config.ts` — lint rules (recommended `@opsydyn/oxlint-effect` 2.x with Effect 4 policy + local anti-slop rules + biome equivalents). Rules new in the 2.x preset that still have findings are switched off near the top as an adoption backlog, with counts; fix their findings and remove the line rather than adding disables.
- `.oxfmtrc.json` — formatter (100-char width, 2-space indent, single quotes, trailing commas, semicolons, import sorting)

## Effect UI components

Astro owns request data, page metadata and hydration. An Effect UI component
owns its model, message schema, view and update. Wrap it with `astroComponent`
at the Astro boundary and pass only public, schema-typed props.

Follow the [Carousel component](apps/web/src/apps/carousel/main.ts) for
`Html.component`, [its update](apps/web/src/apps/carousel/update.ts) for pure
state transitions and command descriptions, and [its subscriptions](apps/web/src/apps/carousel/subscription.ts)
for scoped browser input. Component messages use `UiSchema.TaggedEnum`. Keep
commands and mounts owned by the component, and scope listeners and resources
to the mounted lifetime. Use the current examples when choosing lifecycle APIs.

See the [Effect UI migration guide](docs/assessments/2026-11-26-effect-ui-1.0-migration.md)
for previous package and import mappings.

## Message naming conventions

| Prefix                   | Use case                                       | Example              |
| ------------------------ | ---------------------------------------------- | -------------------- |
| `Clicked*`               | Button/interactive press                       | `ClickedNext`        |
| `Got*`                   | Submodel result via Submodel pattern           | `GotCarouselMessage` |
| `Settled*`               | Asynchronous command result (carries `Result`) | `SettledSlides`      |
| `Succeeded*` / `Failed*` | Two-message Command result                     | `SucceededFetchUser` |
| `Completed*`             | Fire-and-forget acknowledgment                 | `CompletedNavigate`  |

Keep result handling in the update and use a discriminated state for loading,
success, and failure. See the [shared architecture rules](AGENTS.md#effect-ui-architecture-rules).

## foldkit-viz conventions

**D3 parity rule:** All math and shape implementations in `packages/foldkit-viz/` must reference `d3-main/` in this repository as the source of truth. Never invent chart math from scratch — trace the D3 implementation.

## effect-three conventions

**R3F reference rule:** when adding a capability that React Three Fiber, Drei or three.js already has, trace their implementation first and use it as the behavioural reference. The pinned checkouts live at the root of the main checkout (`react-three-fiber-main/`, `drei-main/`, `three-effect-main/`, all git-ignored); three.js itself is `node_modules/three` at the pinned version, including `examples/jsm`. Cite the file and pinned commit in the ADR or PR. Reference, don't copy: our API stays a typed, closed, Model-driven catalogue. If code is ever ported, keep its licence notice (R3F, Drei and three are MIT; three-effect is Apache-2.0). Pins and refresh steps: `docs/effect-three/references.md`. Sequencing: `docs/effect-three/ROADMAP.md`.

## Runtime versions

The root catalog pins the Effect UI snapshot, Effect, and Astro. Keep browser
subscriptions in the owning app and prefer stable Effect subpaths such as
`effect/http`. Historical FoldKit release notes remain in `docs/releases/`.
