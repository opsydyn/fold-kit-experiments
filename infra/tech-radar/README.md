# @opsydyn/tech-radar-infra

The Alchemy stack that builds `apps/tech-radar` and deploys it to Cloudflare as one Worker
with static assets. See `docs/superpowers/plans/2026-10-28-tech-radar-app.md`.

## The apps' Effect

Alchemy accepts `effect ^4.0.5` and FoldKit 0.170 accepts `~4.1.0`, so this workspace runs
on the apps' Effect 4.1.0 from the root's default catalog (`"catalog:"`). The `infra`
catalog holds only what the apps don't use: the Alchemy packages and `@effect/platform-node`
and `@effect/platform-bun`, at 4.1.0. `packages/effect-three`'s single-Effect check walks
this workspace too, so the CLI and the apps can't drift onto two Effects.

## The build integration lives in the app too

`Website.Astro` resolves Alchemy's Worker entry point
(`@alchemy.run/frontend-frameworks/astro/entrypoints/server`) from the app it builds, so
`apps/tech-radar` lists `@alchemy.run/frontend-frameworks` as a dev dependency. In the app it
resolves Effect 4.1.0, like everything else there, and the entry point bundled into the
Worker imports only Astro.

## Use

Your Alchemy profile needs Cloudflare. Once:

```sh
bunx alchemy profile create tech-radar
bunx alchemy profile edit --profile tech-radar --add Cloudflare
bunx alchemy state bootstrap --backend cloudflare --profile tech-radar
```

Then, from this folder, with `ALCHEMY_PROFILE=tech-radar`:

```sh
bun run plan      # what a deploy would change, for your live_$USER stage
bun run deploy    # build apps/tech-radar and deploy it
bun run destroy   # remove the stage
```

## From CI

`.github/workflows/deploy-tech-radar.yml` deploys with two repo secrets:

- `TECH_RADAR_CLOUDFLARE_ACCOUNT_ID`
- `TECH_RADAR_CLOUDFLARE_API_TOKEN`, a token scoped to Workers Scripts and Secrets Store
  (edit). Make one with your Global API Key, then paste it into `gh`:

```sh
bunx alchemy provider cloudflare token --name tech-radar-ci --account-id <account id>
gh secret set TECH_RADAR_CLOUDFLARE_API_TOKEN --repo opsydyn/fold-kit-experiments
```

The stages:

- **`prod`** deploys on pushes to `main` that change the site, its stack or the packages
  it uses, and by hand from the Actions tab.
- **`pr-<number>`** deploys a preview for a PR labelled `preview`, and comments its address.
  Removing the label or closing the PR destroys it; the job refuses any other stage.
