# AGENTS.md — fold-kit-experiments

Agent guidance for this monorepo. Read this before writing any code.

## Repo at a glance

Bun workspace monorepo. The [README](README.md) lists the package families and apps.

Common entry points:

| Workspace                   | Path                         | Purpose                                 |
| --------------------------- | ---------------------------- | --------------------------------------- |
| `@opsydyn/astro-effect-ui`  | `packages/astro-effect-ui/`  | Standalone Astro renderer and hydration |
| `@opsydyn/astro-foldkit`    | `packages/astro-foldkit/`    | Astro integration forwarding package    |
| `@opsydyn/foldkit-viz`      | `packages/foldkit-viz/`      | Chart primitives (no D3 dependency)     |
| `@opsydyn/web`              | `apps/web/`                  | Chart demos and reference workbenches   |
| `@opsydyn/dataset-explorer` | `packages/dataset-explorer/` | Private shared dataset example          |
| `@opsydyn/promo`            | `apps/promo/`                | Static Astro promo site for Viz         |
| `@opsydyn/foldkit-viz-py`   | `packages/foldkit-viz-py/`   | Python anywidget for plot specs (uv)    |

**Stack:** Pinned Effect UI snapshot · Effect 4.1.6 · Astro 7.4.11 · TypeScript · bun · oxlint · oxfmt

**Python:** `packages/foldkit-viz-py` is a Python package as well as a workspace.
Its `test` script runs pytest through `uv run --frozen`, so `ci:check` and the
pre-push hook need [uv](https://docs.astral.sh/uv/) installed; uv installs the
locked environment itself.

**Dependencies:** shared versions are declared once, in the root `package.json`
catalogs. Private workspaces use `"catalog:"` (or `"catalog:strict"` for the
effect-three packages' TypeScript 7 and oxlint); the npm-published packages
(`astro-foldkit`, `foldkit-viz`, and the effect-three and ZLOZ families)
keep literal versions equal to the catalog's. `bun run check` enforces
this with `tools/check-catalog.ts`.

## Before you write code

For consumer-facing package work, read the relevant independent skill:
`skills/astro-foldkit/SKILL.md` for Astro integration,
`skills/foldkit-viz/SKILL.md` for chart geometry and rendering, or
`skills/effect-three/SKILL.md` for 3D scenes (core, Effect UI adapter, Rapier,
troika). Load more than one only when the task uses those packages together. Their bundled examples work outside this repo.
For the tech radar's content, editions or deploys, read `skills/tech-radar/SKILL.md`.

1. Run `bun typecheck` — understand baseline errors before touching anything
2. Run `bun run check` — understand baseline lint/format state
3. Read the exemplar files for the area you're working in:
   - New chart app: look at `apps/web/src/apps/carousel/` (typed component, update and scoped input)
   - New chart primitive: look at `packages/foldkit-viz/src/` and match D3 source at `d3-main/`
   - Astro integration: look at `packages/astro-effect-ui/src/client.ts`

## Commands

```sh
bun run test                          # workspace tests; excludes vendored upstream tests
bun typecheck                         # all workspaces
bun run check                         # oxlint + oxfmt --check (both must pass before committing)
bun run check:fix                     # oxfmt then oxlint --fix
bun run ci:check                      # the CI check job through moon, cached: only what changed reruns
bun run ci:clean                      # the same in a fresh checkout of HEAD from an empty cache, as CI
bun moon run <project>:<task>         # one task and its dependencies, e.g. web:typecheck
bun run --filter @opsydyn/web dev     # single-workspace dev
bun run dev:promo                    # promo site at localhost:4322
```

## Linting

The project uses **oxlint** (not ESLint, not Biome). Config is `oxlint.config.ts`.

Running oxlint directly requires a Node flag because the config is TypeScript:

```sh
NODE_OPTIONS="--experimental-strip-types" bunx oxlint .
```

Prefer `bun run check` — the flag is already included. Never add `biome` commands; Biome was removed.

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

## Message naming

| Prefix                   | When                                 | Example              |
| ------------------------ | ------------------------------------ | -------------------- |
| `Clicked*`               | User interaction                     | `ClickedNext`        |
| `Got*`                   | Submodel result                      | `GotCarouselMessage` |
| `Settled*`               | Asynchronous result (Result-wrapped) | `SettledSlides`      |
| `Succeeded*` / `Failed*` | Two-branch Command result            | `SucceededFetch`     |
| `Completed*`             | Fire-and-forget                      | `CompletedNavigate`  |

Messages are **past-tense facts** about what happened. Never imperative.

## Effect UI architecture rules

Never violate these — push back if asked to:

- **Unidirectional data flow** — Model → view → Message → update → Model
- **Messages are facts** — `ClickedSubmit`, not `Submit`. They describe what happened, not what to do.
- **Model is single source of truth** — no external state, no refs, no direct DOM mutation
- **Side effects in Commands only** — Effects run by the runtime after `update` returns
- **Impossible states unrepresentable** — use discriminated unions (`Idle | Loading | Success`), not `isLoading: boolean`

## foldkit-viz D3 parity

When implementing chart math or shapes in `packages/foldkit-viz/`, always reference `d3-main/` in this repo as the source of truth. Never invent chart math from scratch.

## Verification before claiming done

Always run before reporting work complete:

```sh
bun run check      # lint + format — must exit 0
bun typecheck      # must exit 0
bun run test       # all workspace tests must pass
```

A checkout you have worked in can pass where CI fails, for example when a
typecheck reads a `dist/` you built earlier. Before pushing, or when a CI check
fails that passed here, run `bun run ci:clean`: it runs the CI `check` job in a
fresh checkout of HEAD from an empty cache, as CI does. Commit first, since it
checks HEAD and not uncommitted changes. The pre-push hook runs `ci:check` on
HEAD, cached when the checkout matches HEAD; do not skip hooks with
`--no-verify` unless asked.

moon caches each task by its inputs, so a task must not read or rewrite files
another task produces unless it declares that task in `deps`. A test that
rebuilds or packs packages belongs in that package's `test:integration` or
`test:package` script, which runs alone after the parallel checks.
`tools/ci-parity.test.ts` checks each moon task against its package script.

## Commit types and releases

release-please reads Conventional Commits to release each package: a `feat` or
`fix` commit that touches a package's folder releases that package. Choose the
type by what changes for the package's users, not by what the change fixes:

- **`feat` / `fix`:** behaviour or types that ship in the package.
- **`build` / `ci` / `chore` / `test` / `docs`:** moon config (a package's
  `moon.yml`), CI, tooling, tests and docs. These never release a package.

A `fix(moon)` commit that only edited `packages/effect-three/moon.yml` once
proposed an effect-three release with nothing in it. release-please's
`exclude-paths` cannot prevent that: it excludes folders, not single files. If
a merged PR's commits are typed wrongly, correct them with a
`BEGIN_COMMIT_OVERRIDE` … `END_COMMIT_OVERRIDE` block in its description.
