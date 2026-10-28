# @opsydyn/tech-radar-infra

The Alchemy stack that builds `apps/tech-radar` and deploys it to Cloudflare as one Worker
with static assets. See `docs/superpowers/plans/2026-10-28-tech-radar-app.md`.

## Its own Effect

Alchemy needs `effect ^4.0.5`; FoldKit pins exactly `4.0.0`. This workspace takes its
versions from the root's `infra` catalog (`effect`, `@effect/platform-node` and
`@effect/platform-bun` at 4.0.7, and the Alchemy packages), so the CLI runs on one Effect
and the site it builds keeps the app's. `packages/effect-three`'s single-Effect check walks
the apps and packages, not this workspace.

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
