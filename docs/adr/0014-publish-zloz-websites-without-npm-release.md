# ADR 0014: Publish Zloz websites without an npm release

## Status

Accepted for the user's approved website publication and verified PR merge,
2026-11-08. Extends ADRs 0001, 0011–0013.

## Decision

Publish the promo through the existing GitHub Pages artifact at
`https://opsydyn.github.io/fold-kit-experiments/zloz/`. Bake the workbench link
`https://zloz.opsydyn.xyz/` into that production build. Preserve the existing Viz,
Three, Storybook, API and docs destinations in the Pages assembly.

Deploy the workbench with an independent `infra/zloz` Alchemy stack using the
same pinned beta.85 infrastructure catalog and Cloudflare account as Tech Radar.
Unlike the request-rendered radar, this Astro application is static: deploy its
build through `Website.StaticSite` and Workers Static Assets, with no server
handler, session KV or graph storage. Include workspace sources and the lockfile
in the build memo so package changes invalidate the deployed asset build.

Only the `prod` stage attaches `zloz.opsydyn.xyz`; review stages use workers.dev.
Use a new stack and Worker identity, never adopt or mutate the radar resource.
Keep Cloudflare state-store v8 and the existing authenticated profile/account.
CI reuses the existing account/zone hosting secrets, not npm credentials. Configure
the new compatibility date, logs and traces through the pinned Worker API.

Keep GitHub protections intact: Pages accepts only `main`, and merging to main
requires an up-to-date verified PR. The user explicitly authorized opening and
merging this work. Do not bypass required checks or merge release-please release
PRs. No npm publish workflow, release tag or package publication is authorized.

## Review and verification

Boundary review: **safe with noted deployment risk**. New Zloz infrastructure is
isolated; package runtime APIs, old storage keys and saved graph formats remain
unchanged. Moving the board to a public origin does not transfer local drafts;
users can export/import their JSON. Assets remain public client code with no
hosting credentials or server-side model persistence.

Self-review roles: architecture review checks static ownership and independent
state; delivery review checks account/domain scope, PR protections and rollback;
test review checks the Mini map's stored choice/global masks, published paths,
production links, native island behavior and HTTPS/asset routing after deployment.
Keep local checks, CI, provider plan and hosted acceptance as separate evidence.

Rollback is a revert of the hosting/configuration commit followed by the same
verified main workflow, or redeployment of the prior Zloz asset revision. Do not
destroy production or alter Tech Radar state to recover this site. Never modify
branch protections or the Pages environment policy to accelerate publication.
