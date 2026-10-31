# A standalone FoldKit tech radar, from markdown

This is a plan only. It describes a complete tech radar site, `apps/tech-radar`, built the
way this monorepo builds apps: Astro as the imperative shell and FoldKit apps as the
functional core. It is hosted on Cloudflare, with the infrastructure in
[Alchemy](https://alchemy.run).

- **The data** is today's radar dataset (32 entries, 4 editions, 16 relationships), written
  as markdown instead of `fixture.ts`.
- **The radar** is the effect-three radar, with time travel and deep links.
- **Each blip** opens a full page, like the React and Astro radar's blip page in
  tech-radar-web.

This supersedes `tech-radar-web/docs/plans/2026-10-28-astro-3d.md`, which planned a 3D app
inside tech-radar-web, reading that repo's data.

## The assessment

**This repo is the right home.** Every dependency is already a workspace package here
(effect-three, effect-three-foldkit, astro-foldkit, foldkit-viz and the radar), with one
version of Astro, Effect and FoldKit. There's no package to publish and no release.

- **Standalone means its own app, its own content and its own deploy,** not its own
  repository. It can be lifted out later, because it depends only on workspace packages.

**Most of the radar already exists.** The 3D radar has the timeline, deep links, tours,
six themes, relationships, the minimap, search, filters, touch handling and the eggs. The
2D FoldKit radar (`apps/web/src/apps/functional-ai-radar`) reads the same `RadarDataset`.

**The original 3D radar is not changed.** Its code in `packages/effect-three-samples`,
`/effect-three/radar`, `/functional-ai-radar` and three-promo all stay as they are.

- The new app starts from a **copy** of the 3D and 2D radars, which it then owns and
  changes.
- It reads the original only to prove its data matches: the round-trip test imports
  `fixture.ts`.

**Server rendering on Cloudflare keeps deep links exact.**

- The radar page renders on each request and reads the query string on the server, as
  `/effect-three/radar` already does. A shared link opens exactly there on first paint.
- The copy keeps its `link` prop and needs no client-side link reading.
- The full pages, edition pages and category pages come from build-time markdown, so they
  are prerendered and served as static assets from the same Worker.

The work divides into four parts:

1. **Content:** the dataset as markdown, decoded at build time into the same `RadarDataset`,
   and proved identical to today's.
2. **The app's own radar:** a copy that takes the dataset and the full-page address as
   props.
3. **The site:** the radar, the full blip pages, edition pages and category pages.
4. **The infrastructure:** an Alchemy stack that builds and deploys the Astro app to a
   Cloudflare Worker, with remote state and a deploy workflow.

**The dataset needs no new fields, and the eggs keep working.** It is the same dataset, so
the Futhark saucer, the CAP moons, the constellations, the Monolith, the magic words and
the invaders all stay.

## The infrastructure: Alchemy on Cloudflare

### What Alchemy v2 needs

These were read from alchemy.run and npm on 2026-10-28.

- **Alchemy v2 is Effect-based and still in beta** (`2.0.0-beta.84`). The stack is an
  `Alchemy.Stack` built in `Effect.gen`.
- **`Cloudflare.Website.Astro`** builds the Astro app and deploys it as a Worker with
  assets.
  - **Alchemy supplies the Cloudflare adapter.** `astro.config` must not declare one:
    declaring `@astrojs/cloudflare` fails the build. The output defaults to `server`.
  - A page that exports `prerender = true` is served as a static asset.
  - `alchemy dev` runs Astro's dev server with server rendering in workerd. Plain
    `astro dev` still works too, because the config has no adapter.
  - Astro sessions get a KV namespace by default. This site has no sessions, so pass
    `sessionKVBindingName: false`.
- **State:** `Cloudflare.state()` keeps it in a Worker on the Cloudflare account, backed by
  a Durable Object.
  - It's bootstrapped once with `alchemy state bootstrap --backend cloudflare`. CI fails if
    the store is missing.
  - The store's token lives in the account's Secrets Store, so the CI token needs
    `Secrets Store Write`.
- **Stages:** `prod` from `main`, `pr-<number>` previews, and `dev_$USER` locally. Each
  stage is an isolated Worker.

### The Effect version clash, and the fix

- **Alchemy's packages peer on `effect ^4.0.5`. FoldKit 0.167.0 peers on exactly
  `effect 4.0.0`,** which is the repo's catalog version.
- **So the stack can't share a workspace with the app.**
- **The fix is a workspace for the stack alone:** `infra/tech-radar`
  (`@opsydyn/tech-radar-infra`), pinned through a new `catalogs.infra` to:
  - `effect 4.0.7`
  - `alchemy`, `@alchemy.run/cloudflare` and `@alchemy.run/frontend-frameworks`, all at
    exactly `2.0.0-beta.84`
- **Each side keeps its own Effect.** `apps/tech-radar` stays on the main catalog
  (`effect 4.0.0`, FoldKit, Astro). The stack points at the app through `rootDir`.
- **Repo changes:** add `infra/*` to the workspaces, and make `tools/check-catalog.ts`
  accept the new catalog.
- **Phase 6 proves it.** It checks that Alchemy's Astro build runs with two Effect
  versions in the install, and that the app's bundle contains only 4.0.0.
  - If it doesn't, the fallback is to wait for a FoldKit release whose Effect peer is a
    range.
  - Alternatively, deploy with wrangler as apps/web does, which gives up Alchemy.

### The stack (sketch)

```ts
// infra/tech-radar/alchemy.run.ts
export const Website = Cloudflare.Website.Astro('TechRadar', {
  rootDir: '../../apps/tech-radar',
  sessionKVBindingName: false,
});

export default Alchemy.Stack(
  'tech-radar',
  { providers: Cloudflare.providers(), state: Cloudflare.state() },
  Effect.gen(function* () {
    const site = yield* Website;
    return { url: site.url };
  }),
);
```

- **No bindings in v1:** no KV, D1 or secrets. The site is the Worker and its assets.
- **The URL:** v1 uses the `workers.dev` URL. A custom domain is a later, one-resource
  change.
  Done 2026-10-31: production is <https://techradar.opsydyn.xyz/>.
- **Scripts in the infra workspace:**
  - `deploy`: `alchemy deploy`
  - `plan`: `alchemy plan`
  - `dev`: `alchemy dev`
  - `destroy`: `alchemy destroy`
  - The root gets `bun dev:tech-radar`.

### Deploying from CI (Actions minutes are limited)

- **`.github/workflows/deploy-tech-radar.yml`** deploys `prod` on pushes to `main`.
  - It runs only on changes to `apps/tech-radar/**`, `infra/tech-radar/**`, the workspace
    packages the app imports, or `bun.lock`, as `deploy-cf.yml` does.
  - It also has a `workflow_dispatch` trigger.
- **PR previews are opt-in, not on every push:**
  - A `preview` label or a manual dispatch deploys `pr-<number>` and comments the URL.
  - Closing the PR destroys the stage.
  - The destroy job refuses `prod`.
- **One-time setup by you,** since it needs your Cloudflare login:
  1. Run `alchemy state bootstrap --backend cloudflare`.
  2. Create a Cloudflare API token with Workers Scripts, Workers KV, Durable Objects and
     Secrets Store permissions.
  3. Store it as the repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, or as
     new `TECH_RADAR_*` secrets, so apps/web's token keeps its narrower scope.

## The markdown

### One file per entry, with its history in the frontmatter (settled)

```
apps/tech-radar/src/content/
  radar.md                         # title, current edition date and label; body: intro
  editions/2025-10-14.md           # label; body: what this edition was about
  editions/2026-02-14.md
  editions/2026-06-14.md
  entries/algebraic-data-types.md  # one per entry; body: the full-page write-up
```

An entry looks like this:

```markdown
---
name: Algebraic data types
category: techniques
ring: adopt # the current edition
summary: Build domain values from alternatives and products rather than unrelated flags.
source: https://www.haskell.org/onlinereport/haskell2010/haskellch4.html
history: # earlier editions this entry was on, and its ring then
  - { edition: 2025-10-14, ring: trial }
  - { edition: 2026-02-14, ring: adopt }
related:
  - { to: effect, type: complements, note: … }
---

The write-up shown on the full page.
```

**Why this shape:**

- **It matches `RadarDataset` one to one.** An entry is on an edition if that edition is
  in its `history` or is the current one.
  - `editions[].rings` is every listed ring that differs from the current ring.
  - `editions[].absent` is every edition the entry isn't listed in.
- **It's lossless,** so a round-trip test can prove the markdown _is_ today's data.
- **Authors write each entry once.** The full page is its body, the card shows its summary,
  and a new edition touches only what moved.

**The alternative, not chosen, was tech-radar-web's shape:** a folder per edition, with a snapshot file
for every blip.

- It suits the case where every edition is reviewed as one self-contained change.
- It costs about 110 files for 32 entries over 4 editions, with each write-up copied
  forward every edition.

### Decoding

- **A pure assembler** (`src/radar/dataset.ts`) turns the collections into a
  `RadarDataset`.
  - It derives `rings` and `absent` from each entry's `history`.
  - It collects `related` into `relationships`.
  - It then runs the existing `decodeRadarDataset`. A `Failure` stops the build with the
    reason and the entry file's name.
- **Schemas** are Effect Schema, matching the radar. To verify in Phase 2: Astro 7
  collections accept a Standard Schema, and Effect Schema produces one. If not, a custom
  loader decodes with Effect, and Astro's schema stays a thin pass-through.
- **The data reaches the Worker at build time.** The SSR radar page imports the assembled
  dataset, so a request never reads markdown.
- **The proof:** `assemble(markdown)` deep-equals `demoRadar` from `fixture.ts`.
  - That test is what makes it "the same data set".
  - `fixture.ts` stays for apps/web and three-promo, and the test stops the two drifting.

### Write-ups

The fixture has one-line summaries, not articles.

- **v1:** each full page shows the summary, the source and everything derived (movement,
  relationships, the radar position). The body slot is there, and empty bodies render
  nothing.
- **Write-ups as content work (Phase 8):** original prose, sources checked, a few at a time. I can
  draft them, or you can write them.

## The app's own radar (a copy; the original stays as it is)

- **The copy:**
  - Copy `packages/effect-three-samples/src/radar` into `apps/tech-radar/src/radar/three`.
  - Copy `apps/web/src/apps/functional-ai-radar` into `apps/tech-radar/src/radar/flat`.
  - Copy the radar's tests too. The first commit is the copy alone, with every copied test
    passing, so later diffs show only what changed.
- **What the copies share with the original:** only libraries (effect-three,
  effect-three-foldkit, foldkit-viz). Library fixes, such as the touch tolerance, reach
  both.
- **What they don't share:** radar-level fixes, such as a new theme or a sidebar fix, would
  have to be ported by hand in either direction. That's the price of keeping the original
  untouched. It's worth recording in both READMEs.
- **The guard:** every PR for this app shows no diff under
  `packages/effect-three-samples/` or `apps/web/src/`. Phase 1's PR states it. The original's
  own tests and the Chromium check of `/effect-three/radar` show it still behaves the same.

The changes to the copy follow. Astro serialises island props, so every new input is data,
not a function.

- **`dataset: RadarDataset`** for the 3D radar and the 2D radar, required. The copy drops
  its `fixture.ts`. Its data only ever comes from the markdown.
- **The full-page address as templates:**
  - `entryPage: '/blip/{id}/'`
  - `editionEntryPage: '/edition/{edition}/blip/{id}/'`
- **"Open full page"** in the details card, under the summary. It's a real link, so
  middle-click, keyboard and touch all work.
  - It opens the page for the edition being viewed: time travel to the second edition, and
    the link opens that edition's view of the blip.
  - The "Source" link stays beside it.
- **The demo notice goes,** since this is the radar's own data. A **`title`** prop is
  added.
- **Deep links are unchanged:** the page passes `Astro.url.searchParams` as the `link`
  prop, exactly as `radar.astro` does today.
- **Tests:**
  - A dataset prop renders the radar.
  - The page link follows the edition being viewed.
  - A link given to `init` opens pinned, in the right edition and theme, as in the
    original's tests.

## The site (`apps/tech-radar`)

Astro 7, `@opsydyn/astro-foldkit`, `trailingSlash: 'always'`, and no adapter in the config
(Alchemy supplies it). The layout and styling follow three-promo.

| Page                         | Rendered    | What it is                                                                         | FoldKit islands            |
| ---------------------------- | ----------- | ---------------------------------------------------------------------------------- | -------------------------- |
| `/`                          | per request | The 3D radar, opening on the query's deep link, with the intro from `radar.md`     | 3D radar                   |
| `/2d/`                       | per request | The same radar in 2D, with the same links. It's the fallback when WebGL is missing | 2D radar                   |
| `/blip/[id]/`                | prerendered | The full page at the current edition                                               | Movement chart, mini-radar |
| `/edition/[date]/`           | prerendered | The edition's notes, what changed, and its entries by category                     | —                          |
| `/edition/[date]/blip/[id]/` | prerendered | The full page as the blip stood in that edition                                    | Movement chart, mini-radar |
| `/category/[id]/`            | prerendered | Every entry in a category, by ring                                                 | —                          |
| `404`                        | prerendered | Served for unknown paths (`assets.notFoundHandling: '404-page'`)                   | —                          |

### The full blip page, matched to tech-radar-web's

- **Header:** the name, the ring and category as chips, and the edition ("Second edition ·
  2026-02-14") when it isn't the current one.
- **Body:** the markdown write-up, rendered by Astro.
- **Movement history:**
  - A small foldkit-viz step chart of the ring across the editions, with a gap where it was
    absent.
  - A table of the same values sits beside it, so colour is never alone.
  - This replaces the React app's `BlipHistory`.
- **Related technologies:** each relationship with its type label, note and a link to that
  entry's page, both directions.
- **Mini-radar:** the 2D radar, pinned on this entry and read-only, with "View on the 3D
  radar" linking to `/?entry=<id>` (plus `&edition=` for older editions).
- **Source** link.
- **Navigation:** previous and next within the category, and back to the category page.
- **Each page is complete without JavaScript.** The islands enhance the history and the
  mini-radar.

### Reused rather than rewritten

- The edition "what changed" list reuses the copied radar's timeline functions.
- The mini-radar on each full page is the copied 2D radar.

## Phases

**2D radar removed (2026-10-28):** the app shows the 3D radar only. `/2d/`, the 2D copy
(`src/radar/flat`), its Vitest tests and its vanilla-extract tooling are gone, and so are
the follow-ups that needed it (a mini 2D radar on each full page, deep links on `/2d/`).
The original 2D radar in apps/web is unchanged. The sections below describe the plan as
first written.

**Progress (2026-10-28):** Phases 1 to 7 are done and merged (#79, #80, and the docs
PR that follows them). Production is
<https://tech-radar-techradar-prod-p2g6lgx4bmhwwuk5.opsydyn.workers.dev/>, deployed from
`main` by `.github/workflows/deploy-tech-radar.yml` with the `TECH_RADAR_CLOUDFLARE_*`
secrets. three-promo links to it, and CLAUDE.md and the README list both new workspaces.
The personal stage is `live_alancurrie` (Alchemy's default stage name, not `dev_$USER`).
What the first deploy taught:

- Alchemy builds with `output: 'server'`, so every page but `/` declares
  `export const prerender = true`.
- `assets.notFoundHandling: '404-page'` answers browser navigations that match no file
  without running the Worker, which 404'd `/`. It is left out; Astro serves its 404 page.
- `@alchemy.run/frontend-frameworks` must also be a dev dependency of the app, where it
  resolves Effect 4.0.0.
- The Cloudflare account already had Alchemy's state store, which was adopted.
  Two changes from the plan below:

- `/2d/` was built ahead, not rendered per request, and the full pages link to the 3D
  radar rather than show a mini-radar. The 2D radar has since been removed.

Local development comes first. The Cloudflare and Alchemy work waits until the site runs
locally, so nothing needs your Cloudflare login until Phase 6.

1. **Scaffold and copy.**
   - Scaffold `apps/tech-radar` and copy both radars and their tests in, unchanged. All
     copied tests pass.
   - The original shows no diff.
2. **Content.**
   - Write the markdown from the fixture with a one-off script, checked in for audit and
     then deleted.
   - Add the assembler. The round-trip test passes.
3. **The copy's inputs.** The dataset, page-template and title props, "Open full page",
   and the demo notice removed.
4. **The radar pages:** `/` and `/2d/`, rendered per request with deep links.
   - Locally these run under `astro dev`, which needs no adapter. A production build of
     per-request pages waits for Alchemy's adapter in Phase 6.
5. **The full pages:** blip, edition-blip, edition and category pages, prerendered, with
   the movement chart and the mini-radar.
6. **Infra.**
   - Create `infra/tech-radar` with its own Effect through `catalogs.infra`, and deploy to
     a `dev_$USER` stage.
   - Check that the app's bundle has only `effect 4.0.0`, prerendered pages are served as
     assets, and `alchemy destroy` cleans up.
   - Needs: your Cloudflare login for `alchemy state bootstrap` and the first deploy, and
     the deploy token.
   - If Alchemy can't build it, the fallback is wrangler, as apps/web deploys.
7. **Ship.**
   - The deploy workflow (prod on `main`, previews by label), with the token and secrets
     set up by you.
   - A link from three-promo, the README, and the CLAUDE.md workspace and command tables.
8. **Final infra stage: review `@alchemy.run/domain`** (below). Done: not yet, with the
   conditions to revisit.
9. **Later:** write-ups; a custom domain; optional ADR, author and tag fields with a page
   section; a "Take the tour" per edition from a checked-in tour file.

Each phase is its own branch and PR, committed locally and pushed only when asked.

## Final infra stage: reviewing `@alchemy.run/domain`

Read on 2026-10-28 from alchemy.run/domain, /domain/foldkit and /domain/cloudflare.

**What it is.** Not custom domains: `@alchemy.run/domain` is Alchemy's domain-driven
design library.

- Commands request changes, aggregates decide them, and events record what happened.
- Views, projections, policies and sagas answer reads, feed stores and decide next steps.
- `Story` tests describe behaviour in business terms against an in-memory model.
- On Cloudflare each aggregate, view key and policy becomes a Durable Object, created when
  the Worker starts. A command's events, state and reply commit together.
- `bun alchemy dev` runs the same Worker and Durable Objects locally.

**How it meets FoldKit.**

- Its client sends commands over HTTP, mapped to FoldKit Commands that return
  `Succeeded*` or `Failed*` Messages with typed rejections.
- A view's `watch` opens a WebSocket, mapped to a FoldKit Subscription.
- Alchemy also has `Cloudflare.Website.Foldkit`, beside the `Website.Astro` this plan uses.
  The API Worker shares the site's origin through `assets.runWorkerFirst`.

**Where it could fit the radar.** v1 needs none of it: the radar is markdown, assembled at
build time, and read-only. It becomes relevant once the radar takes input, for example:

- proposals and votes on blips, or comments;
- an editorial workflow, where moving a blip is a command and an edition is the event
  history up to its date (the timeline would read events rather than markdown);
- live updates to an open radar through a watched view.

**What the review found** (2026-10-28, `@alchemy.run/domain` `2.0.0-beta.84`):

- **Maturity.** It was first published on 2026-10-21, and `2.0.0-beta.84` is its only real
  release. The example on Alchemy's `main` already uses a newer Story API than the published
  package (`call`/`succeed` against `expectCall`/`resolve`), so the API is still moving. It
  is Apache-2.0 and about 1 MB unpacked.
- **Peers.** `effect ^4.0.5` and `alchemy`, and `alchemy` is not optional. Alchemy's own
  FoldKit app (`examples/cloudflare-domain/packages/web`) lists `alchemy` as a dependency
  of the browser package.
- **Effect: the blocker.** The domain client is browser code that must share FoldKit's
  Effect, and FoldKit pins exactly `4.0.0`. Alchemy's repository makes FoldKit and the
  domain work together by overriding Effect for the whole workspace (`overrides: effect:
4.0.5`, with `foldkit ^0.169.0`), which runs FoldKit on an Effect it doesn't declare.
  - A spike installed the package with Effect forced to 4.0.0: its source typechecks
    against 4.0.0. The only errors were in `alchemy`'s own declarations, which want
    `@effect/platform-node` and Node's types.
  - Whether it runs on 4.0.0 is unproven. The example on `main` doesn't match the
    published API, and running the tagged example's tests was not done.
- **Testing.** Stories run in memory under Vitest with `@effect/vitest` (`it.effect`), not
  `bun test`. apps/web already uses Vitest, so this fits, as a second runner in the app.
- **Hosting.** The docs host a model in its own Worker class, with aggregates, views and
  policies as Durable Objects created at start-up and no bindings declared. The site's
  Worker binds the model and routes `/api` to it with `assets.runWorkerFirst`. Only
  `Website.Foldkit` is documented; using it beside `Website.Astro` is untested.
- **FoldKit integration.** Commands go over HTTP and become FoldKit Commands with typed
  rejections. `watch` and `events` are WebSockets to the owning Durable Object and become
  Subscriptions. The local-first guide adds an offline intent queue in `localStorage`,
  with deduplication by command id. All of this matches how this repo writes FoldKit apps.

**Where it would fit the radar.** Only once the radar takes input. The best first feature
keeps markdown as the source of truth:

- **Proposals and votes:** a `Proposal` aggregate (`ProposeEntry`, `ProposeMove`, `Vote`,
  `Accept`, `Reject`) and views per entry and per open edition, watched live on the radar.
- An accepted proposal becomes a markdown pull request through an `ExternalSystem`
  (GitHub), so editions are still reviewed and built from markdown.
- Every write needs sign-in first: the `cloudflare-domain-better-auth` example and the
  sessions guide cover it.

Making events the source of editions, in place of the markdown, is possible but reverses
the content decision, so it is not proposed.

**Decision: not yet.** Revisit when all three hold:

1. One Effect can serve both, either because FoldKit widens its `effect` peer to include
   `>=4.0.5`, or because this repository adopts a repo-wide override after the full test
   suite passes on it. An override would also remove the infra workspace's separate Effect.
2. `@alchemy.run/domain` has a few releases behind it, with a stable Story API.
3. The radar has a named write feature, starting with proposals and votes.

The cheapest next step, if wanted: a spike branch that overrides Effect to 4.0.7 across the
repository and runs every suite, to learn whether FoldKit already works on it.

**Correction, 2026-10-30: condition 1 is not met.** Alchemy `2.0.0-beta.84` declares
`effect ^4.0.5` but imports `effect/Crypto`, which Effect 4.1 removed, so the Alchemy CLI
cannot run on 4.1: the move below broke every tech radar deploy until infra went back to
its own Effect 4.0.7. One Effect for FoldKit and Alchemy needs an Alchemy release that works
on 4.1. The proposals spike's Stories passed on 4.1 only because they never load Alchemy's
CLI or auth code.

**Update, 2026-10-29: condition 1 is met.** FoldKit 0.170 peers on Effect `~4.1.0`, which
Alchemy's `^4.0.5` accepts, so the repository runs on one Effect 4.1.0, infra included, with
no override (`docs/releases/foldkit-0.170.md`). The overlap is 4.1.x only: if Alchemy needs
4.2 before FoldKit does, they split again. Conditions 2 and 3 still stand:
`@alchemy.run/domain` is still on its only release, `2.0.0-beta.84`, and the radar has no
write feature. One new cost: its Stories run under `@effect/vitest`, whose 4.1 release needs
Vitest 5, and the repository is on Vitest 4.

## Decisions

**Settled:**

1. `apps/tech-radar` in this monorepo, as a standalone app. The original 3D radar is not
   changed.
2. Cloudflare hosting, server-rendered where links need it, deployed with Alchemy v2.
3. **One markdown file per entry,** with its history and relationships in the
   frontmatter.
4. **Local development first.** The state bootstrap and the deploy token wait until
   Phase 6.

**Still to confirm:**

5. **Write-ups:** whether I draft them in Phase 8, or you write them.
6. **The Cloudflare token (Phase 6):** a new `TECH_RADAR_*` token (recommended), or
   widening apps/web's existing `CLOUDFLARE_API_TOKEN`.

## Verification

- **Tests:** the round-trip test (markdown equals the fixture), assembler failures named
  by file, and the radar-prop tests.
- **Checks:** `bun run check` (including the catalog check), the full test suites,
  `astro check`, and `alchemy plan` against `prod` showing only the expected resources.
- **A local Worker:** `alchemy dev`, so the SSR radar runs in workerd as it will in
  production.
- **Chromium pass on a `dev_$USER` stage, at 1440×820 and 375px:**
  - the radar, pinning a blip and opening its full page from the card
  - time travel to the first edition, then the full page shows that edition's ring
  - a `?entry=futhark&theme=blueprint` link opening exactly there on first paint
  - `/2d/`, and a full page with JavaScript disabled
- **The original is unchanged:**
  - `git diff main -- packages/effect-three-samples apps/web/src` is empty on every PR.
  - Phase 1 moved apps/web's vanilla-extract and vitest versions into the root catalog,
    unchanged, because the 2D copy uses them too. That is apps/web's only change.
  - The original's tests pass as before.
  - `/effect-three/radar` and `/functional-ai-radar` look and behave as before.
