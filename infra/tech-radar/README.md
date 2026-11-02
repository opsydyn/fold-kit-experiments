# @opsydyn/tech-radar-infra

The Alchemy stack that builds `apps/tech-radar` and deploys it to Cloudflare as one Worker
with static assets. See `docs/superpowers/plans/2026-10-28-tech-radar-app.md`.

## One Effect with the apps

Alchemy `2.0.0-beta.85` runs on Effect 4.1, so this workspace takes `effect`,
`@effect/platform-node` and `@effect/platform-bun` from the main catalog like the apps, and
only the Alchemy packages from the root's `infra` catalog. `packages/effect-three`'s
single-Effect check walks this workspace too. (Up to beta.84 it kept its own Effect 4.0.7:
that release imports `effect/Crypto`, which 4.1 removed.)

The state store is v8 from the first beta.85 deploy. An older Alchemy can no longer manage
it and risks losing its encryption key, so never deploy from a branch made before the
upgrade: rebase it first. See `docs/releases/alchemy-beta-85.md`.

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
  (edit), and, for production's custom domain, on the `opsydyn.xyz` zone: Zone (read),
  DNS (edit) and Workers Routes (edit). Make one with your Global API Key, then paste it
  into `gh`:

```sh
bunx alchemy provider cloudflare token --name tech-radar-ci --account-id <account id>
gh secret set TECH_RADAR_CLOUDFLARE_API_TOKEN --repo opsydyn/fold-kit-experiments
```

The stages:

- **`prod`** deploys on pushes to `main` that change the site, its stack or the packages
  it uses, and by hand from the Actions tab. It answers at <https://techradar.opsydyn.xyz/>:
  the stack attaches the hostname as a Workers custom domain, and Cloudflare creates its DNS
  record (which outranks the zone's `*.opsydyn.xyz` wildcard) and certificate. The
  `workers.dev` address keeps working.
- **`pr-<number>`** deploys a preview for a PR labelled `preview`, and comments its address.
  Removing the label or closing the PR destroys it; the job refuses any other stage.
