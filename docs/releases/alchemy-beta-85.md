# Alchemy 2.0.0-beta.85 release notes

The tech radar's infra workspace moves from Alchemy `2.0.0-beta.84` to `2.0.0-beta.85`
(`alchemy`, `@alchemy.run/cloudflare` and `@alchemy.run/frontend-frameworks`), and from its
own Effect `4.0.7` to the apps' Effect `4.1.0`.

Source: [Alchemy 2.0.0-beta.85](https://alchemy.run/blog/2026-11-01-beta-85/).

## What changed upstream that matters here

- **Effect 4.1.** Alchemy runs on Effect 4.1, and Effect 4.1's `SecureRandom` and `Digest`
  replace the deleted `effect/Crypto`. beta.84 imported `effect/Crypto`, so its CLI failed
  on 4.1 and the infra workspace had to keep its own Effect 4.0.7.
- **Cloudflare state store v8.** The store is now deployed with direct API calls instead of
  a stack. The first beta.85 deploy upgrades it (CI passes `--yes`); a plan or deploy with
  `--no-input` and no `--yes` refuses until then ("expected v8, observed v7"). The upgrade
  keeps the store's token, encryption key and state, and deletes the `CloudflareStateStore`
  stack beta.84 used to manage it.
- **Fixes we use:** `alchemy destroy` plans from state without running the stack's
  program, which the preview teardown job relies on; a secret removed from a Worker's
  environment is unbound; the login picker lists every account.

Not used here: Alchemy Domain, GCP, AWS's DynamoDB state, DNS adapters (our domain is on
Cloudflare) and `@alchemy.run/test`.

## What changed here

- `effect`, `@effect/platform-node` and `@effect/platform-bun` come from the main catalog;
  the `infra` catalog keeps only the Alchemy packages.
- `check-single-effect.ts` walks `infra/*` too, so the CLI and the apps stay on one Effect.
- No stack changes: `Cloudflare.state()` takes no `name`, so the `workerName` rename does
  not apply.

## Never go back

After the upgrade, an older Alchemy can no longer manage the store and risks losing its
encryption key, which nothing can recover. Every place that deploys moved together in one
commit (the lockfile pins beta.85 for local runs, the `main` deploy and previews), but a
branch made before it still pins beta.84: rebase it before labelling its PR `preview`, and
don't deploy from an old checkout.
