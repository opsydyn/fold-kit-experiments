# Questmancer on Teams staging

Questmancer opens from the signed-in workspace home. For this pilot, one Teams
owner can host one Moonwell Observatory table per enabled team. They assign
Mira, Brasswick and Wicket to three different existing teammates. Those
teammates get a **Join party** link on the workspace home and **Resume session**
after joining. A new teammate can first join through the existing Teams
invitation flow.

The DM can use the existing Google session and invite QA players by their full
Gmail plus aliases. Each player opens their own invitation and chooses
**Continue with email**, then enters the code and accepts the invite in a
separate browser profile. Follow the
[Teams email sign-in runbook](staging-runbook.md#invited-email-sign-in) to
enable and qualify delivery before the playtest.

## Local qualification

Run from the repository root after building the Teams workspace dependencies.

```sh
bun run --filter @opsydyn/zloz-team typecheck
bun test apps/zloz-team/test/questmancer.test.ts
```

The test creates an isolated local Alchemy stage. It uses D1-backed fixture
sessions, real Teams provisioning, distinct Chrome contexts, and a local
email outbox to exercise invited sign-in for two QA aliases. It opens the
dashboard, creates the table, joins three players,
moves their assigned tokens, previews sample art, reveals the room, applies
Pip's sprite and publishes the recap. It also checks that outsiders, removed
members and other player seats cannot read or write beyond their permissions.
Use `ZLOZ_QUESTMANCER_EVIDENCE` with a local directory to save dashboard and
published Ledger captures. The fixture app and browser test submit no provider
inference.

## Reviewed staging plan

Follow the existing [Teams staging runbook](staging-runbook.md) for the
configured account, stage, origin and credentials. Leave
`ZLOZ_QUESTMANCER_TEAM` unset or empty to keep the feature closed. Set it to the
ID of the single staging test team when qualifying the invite-only experience.

The first deployment needs a reviewed full Alchemy plan. Review the new private
Worker, its service binding from Astro, the SQLite room namespace, the sample
art Workflow and the private R2 bucket. The Worker has no custom domain or
Workers.dev or preview URL. Existing Teams resources should continue to target
the same database and bindings. The quick code-only deploy guard should reject
the resource changes for this first plan.

After authorized activation, use the four approved signed-in identities in
separate browsers and repeat the local walkthrough. Confirm that a player gets
no job payload or draft through either the preview or asset route, and that the
same links fail after team membership is removed. Record the plan, deployed
Worker versions and actual browser outcomes. Disable the pilot by clearing its
team ID in the reviewed staging configuration. The room Worker and its data are
retained so the team can resume if the flag is re-enabled.

## Current art path

The Workflow saves the preserved Moonwell backdrop and Pip sprite to the room's
private R2 prefix. This qualifies the hosted asset and review architecture with
deterministic input. The separately verified live FLUX prototype still uses a
Mac-specific image normalizer. Live hosted inference and portable normalization
need their own qualification.

## Local evidence

- Result — complete
- Claim — A Teams owner hosted Moonwell from the dashboard, and three invited teammates joined and moved their own tokens. Each player reconnected and decoded the archived backdrop in the published Ledger.
- Evidence — The focused Questmancer test passed in four Chrome contexts. It exercised signed fixture sessions, membership, two Workflow art jobs, R2 retrieval, DM-only notes, publication and access denial after removal. Repository lint, typecheck and the local production-style Teams build passed.
- Remaining uncertainty — Live hosted inference and the Cloudflare account plan remain unqualified. The Teams retry reported 185 passing tests, three skipped, and two failures in Diagram Evolution and shared Undo on this checkout.
- Next — Review the full staging plan and resolve the diagram regression gate before activation. Recommendation — hold staging activation.

## Owner preview

Set `ZLOZ_QUESTMANCER_PREVIEW_TEAM` to the ID of the single staging team.
A current owner of that team can open **Preview Moonwell** from the dashboard or
go straight to `/app/<teamId>/questmancer/preview`. The preview uses sample art
and the tabletop renderer. Panning, zooming and fitting the scene operate in
the browser and create no room data. Clear the preview team ID to close it.

The preview has its own team setting. The live pilot remains controlled by
`ZLOZ_QUESTMANCER_TEAM`. A hosted smoke check should confirm that a signed-out
visitor is sent to sign-in with the preview as their return destination.
