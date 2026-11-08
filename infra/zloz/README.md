# Zloz workbench hosting

Independent Alchemy stack deploying `apps/zloz-demo` as a Cloudflare Worker
with static assets. Production hostname: **https://zloz.opsydyn.xyz/**. Promo:
**https://opsydyn.github.io/fold-kit-experiments/zloz/** through existing Pages.

## Ownership

Stack `zloz`, resource `ZlozWorkbench`; only stage `prod` owns the custom domain.
Other stages use their workers.dev URL. No radar resource, graph persistence,
session namespace or server handler. The frontend's existing local-storage keys
remain unchanged, but browser storage is origin-specific: export/import canonical
JSON to carry a draft from localhost to the public workbench.

The pinned infrastructure catalog is Alchemy beta.85 on Effect 4.1, matching
Tech Radar and its state-store v8. Read `docs/releases/alchemy-beta-85.md` before
changing that version. Do not copy another stack's local/remote state or deploy
with an older CLI. Build memo includes app and package sources, logo assets and
the lockfile.

## Local provider plan

The existing `tech-radar` profile authenticates this same Cloudflare account.
Its name identifies credentials, not stack ownership. From this folder:

```sh
bun run plan --stage prod --profile tech-radar --no-input
```

Inspect the resource/account/hostname diff before deploying. Do not use `--adopt`
to replace unknown resources. An explicitly requested review deployment can use
`bun run deploy --stage review --profile tech-radar --yes --no-input`; it does not
attach the production hostname. No secrets are written into the frontend.

## Main deployment

`.github/workflows/deploy-zloz.yml` runs after relevant pushes to `main`, or by
manual dispatch on `main`. It uses the already configured
`TECH_RADAR_CLOUDFLARE_ACCOUNT_ID` and `TECH_RADAR_CLOUDFLARE_API_TOKEN` as the
account/zone hosting credentials. The Worker and stack state are separate from
Tech Radar. No new secret values or npm credentials are needed. Do not print or
copy credential values into commands, evidence, PRs or source.

The promo's Pages build sets its `/fold-kit-experiments/zloz/` base and public
workbench target. Both deployments follow a verified PR merge; keep main/Pages
protections unchanged. A website deploy does not publish packages to npm.

## Verification and recovery

Run the repository checks and app builds before opening the PR. After merge,
confirm both workflows succeeded, HTTPS and static assets respond, the promo's
workbench link is the public URL, Compose connects/undoes, and the hosted board's
Mini map control is in Navigation. Unknown workbench paths should return 404.
Keep browser screenshots and workflow links in the hosting evidence record.

Recover by reverting/redeploying the last Zloz asset/config revision through the
same protected workflow. Do not destroy production resources or alter Tech Radar
to recover Zloz. Changes to custom domains/DNS require a scoped plan/readback.
