# Zloz team staging and recovery

This runbook covers the approved M4 staging candidate at
`https://teams-staging.opsydyn.xyz`. Production and real pilot invitations need
separate authority. Existing `zloz.opsydyn.xyz` stays on its own stack.

## Identity, state and release boundary

| Item                          | Staging candidate                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------- |
| Alchemy entry / stack / stage | `staging.alchemy.ts` / `zloz-team-staging` / `staging`                            |
| Alchemy profile               | `tech-radar`                                                                      |
| Public origin                 | `https://teams-staging.opsydyn.xyz`                                               |
| Google callback               | `https://teams-staging.opsydyn.xyz/api/auth/callback/google`                      |
| Public Worker                 | `ZlozTeamStagingApp`, custom domain only                                          |
| Backend                       | `ZlozTeamServer`, private Astro service binding, workers.dev disabled             |
| Persistent resources          | `ZlozTeamAuth` D1, `ZlozTeamSigningSecret`, Domain aggregate/view Durable Objects |
| Transient resources           | Diagram presence Durable Object; no durable presence content                      |
| Infrastructure state          | Cloudflare state store, separate stack/stage namespace; shared store service      |

Verify the profile is bound to the intended staging account. Retain the generated plan's actual Worker/database/namespace
IDs before activation. Stop if it changes the static workbench, another stack's
resources, an existing database's ownership, or the intended staging account. Do not adopt,
destroy, rename or replace existing resources to make a plan pass.

The state-store service is shared with existing stacks; this candidate uses a
separate stack/stage namespace. Preserve its credentials/encryption key. Alchemy
state includes signing-secret material: keep backups encrypted, outside Git and
outside review packets. Never include OAuth credentials, cookies, bearer tokens
or invitations in diagnostic evidence.

## Prepare and inspect

Use a separate staging Google OAuth client. The operator configures the approved
Google test accounts and the exact callback above. Put credentials only in ignored
`apps/zloz-team/.env`:

```dotenv
ZLOZ_ORIGIN=https://teams-staging.opsydyn.xyz
GOOGLE_CLIENT_ID=<staging client ID>
GOOGLE_CLIENT_SECRET=<staging client secret>
ZLOZ_STAGING_BOOTSTRAP=false
ZLOZ_OPERATOR_TOKEN=<64 lowercase hex characters, generated locally>
```

From the repository root, run the checks sequentially:

```sh
bun install --frozen-lockfile
bun run check
bun typecheck
bun run test
bun run --filter @opsydyn/zloz-team build
bun run --filter @opsydyn/zloz-team plan:staging
```

The staging entry refuses another stage, another origin or empty Google
credentials. The default `alchemy.run.ts` still permits local development only.
Plan output is a review artifact, not deployment evidence. Review actual resource
names, account, public domain, private service binding, migration additions,
secret handling and state-store scope. No test fixture Worker belongs in staging. `ZLOZ_QUALIFICATION_PROBE` must remain
false/absent; staging rejects it, and the backend defaults its old probe API off.
Record the source commit/tree hash, adapter/core tarball digests and plan output.

After that concrete review, run `bun run deploy:staging --yes` from the app
directory. The wrapper fixes the approved entry, stage and profile. It accepts
only this confirmation flag for deployment; without it Alchemy refuses a
non-interactive change. Never use
`--adopt` or destroy to bypass a mismatch. Capture the deployed Worker version IDs,
D1 migration history and custom-domain response. A successful build is not proof
of a successful deployment.

## First owner and provider acceptance

1. The approved first owner signs in through the real staging Astro origin using
   Google. Bootstrap refuses nonexistent, unverified or non-Google identities.
2. Temporarily set `ZLOZ_STAGING_BOOTSTRAP=true`, retain a freshly generated
   operator token, review the plan and deploy that staging configuration.
3. Run the bootstrap task in preview mode, replacing examples with the approved
   operator-selected identity/team. This does not send invitations:

   ```sh
   bun run --filter @opsydyn/zloz-team bootstrap --staging --owner-email owner@example.com --name 'Staging qualification' --slug staging-qualification
   ```

   Review the returned exact email/name/slug, then repeat with `--apply`. Matching
   retries return the existing team; changed ownership/name for a slug conflicts.

4. Disable the bridge (`ZLOZ_STAGING_BOOTSTRAP=false`), remove/rotate the operator
   token, review/redeploy and verify the public bootstrap path returns 404.
5. Using only approved test accounts, qualify fresh Google login, invitation
   acceptance, wrong-account recovery, expired/cancelled invitation rejection,
   private team navigation and logout. Owners create/copy links themselves; no
   automated email or external outreach is part of this work.
6. In browser network tools, inspect cookie **attributes without recording values**:
   Secure, HttpOnly, SameSite=Lax and Path=/; confirm the Astro proxy preserves all
   Set-Cookie headers and OAuth state/callback cookies. Confirm logout invalidates
   server sessions, then retry the private page/API/feed. Record observed outcomes.
7. Repeat sign-in, team navigation, invite acceptance and recovery preview/apply
   using the keyboard. Record desktop/mobile, focus visibility, errors and any
   unobserved screen-reader evidence separately. Synthetic signed sessions do not
   satisfy these provider checks.

## Logical checkpoint recovery

Only current owners may download checkpoints or open a diagram's **Backup and
recovery** page. Download a checkpoint before release or risky authored changes;
keep the file and SHA-256 digest in an operator-controlled, access-restricted
backup location. A checkpoint contains private graph content. Its digest detects
changed canonical checkpoint content; it is not a signature or a replacement for owner authorization.

To rehearse recovery: retain a checkpoint, make an acknowledged edit, upload the
checkpoint, inspect its target/version/counts/digest and choose Preview. Apply
creates a new canonical document version with advanced field clocks and cleared
Undo. It preserves consumed IDs/tombstones and the server event/receipt history.
It never rewinds SQLite or overwrites another version without checking it.

If the diagram changes after Preview, recovery conflicts: inspect the new graph
and create a fresh preview/operation ID. If the result is unknown, retain the exact
preview and retry Apply; never change a payload under the same operation ID.
Download the canonical export after recovery and compare it with the retained
graph. Reload another authorized browser and confirm the same recovered graph.
Retain hosted versions/digests and observed results; local restart proof is not
hosted restore proof. A full D1/DO disaster restore remains a separate incident
operation requiring exact provider resource and recovery-point review.

## Migration and rollback

Auth D1 migration files are unchanged by M4. Inspect Alchemy's intended additions
and the actual hosted migration history before deployment. Preserve existing
migration files and the generated signing secret. Record a D1 backup/recovery
point and representative authorized diagram checkpoints before release.

M4 adds the persisted `RecoveryDecided` event. After the first recovery, an old M3
backend may not decode that event. Roll back UI/routes while retaining the M4
aggregate/view decoder and existing DO class identities. Never downgrade the
backend across that compatibility boundary, delete DO namespaces/D1 rows or reset
state to force a rollback. Disable staging access for an unresolved incident and
retain data plus the failing Worker version for diagnosis. Verify current graph,
old exact retries and fresh auth after any compatible rollback.

## Cost qualification

Hosted cost has not been measured. Record pre/post workload deltas for public and
backend Worker requests/CPU/errors, Domain/Presence DO requests and billed active
duration, SQLite rows/storage, D1 rows/storage and logs. Include reconnection and
live membership checks: one authored edit is not one billed request. Measure an
idle connected browser too; the Domain transport's hibernation behavior has not
been established, so do not budget idle sockets as free.

Cloudflare's published paid Workers baseline is $5/month with included usage;
DO request and active-duration rates are additional after their allocations.
Price the **whole account's** usage and allocation contention, not each stack as
if it owns a new free allowance. Reference current
[Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/),
[DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
and [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/).
Pricing was checked during M4; recheck before activation.

Use measured deltas per editor-hour and per accepted edit, multiplied by the
operator's stated monthly active-editor hours/edits, plus observed idle-duration,
storage and log costs. Record all assumptions, regional latency and the accepted
monthly budget. No monthly traffic assumption or spending budget has been
approved, and no cap is automatically enforced by this application. Keep hosted
cost acceptance open until measured and accepted; pause expansion for unexplained
cost growth, isolation/revocation failures or accepted-edit loss.

## Repeat local artifact and load qualification

```sh
bun run --filter @opsydyn/foldkit-zloz-alchemy build
bun test packages/foldkit-zloz-alchemy/test/package.test.ts
bun run --filter @opsydyn/zloz-team qualify:packed
bun run --filter @opsydyn/zloz-team qualify:load
```

The packed test retains isolated consumer tarballs and a descriptor at
`zloz-m4-packed-consumer.json` in the operating system temporary directory. The native rehearsal uses those
installed tarballs, pinned beta.85 providers and real workerd, then kills/restarts
its own isolated process. It deploys nothing remotely.

The load test freezes five isolated Chromium sessions, 250 nodes/500 edges,
1,200 planned rename edits at aggregate 10/sec over 120 seconds, with one pending
write per writer. It uses each browser's authenticated HTTP boundary and checks
all five actual DOMs; the separate native UI suite covers gesture-to-command
translation. A single originating browser monotonic clock measures submission to
all-peer DOM acknowledgements. Missing/busy/rejected/timeout samples remain in the
population, with infinite latency for missing renders. Thresholds: p95 <1,000ms,
catch-up <10,000ms after a peer stalls beyond 128 receipts. Record every failed run.
Freeze source files and builds during this dev-server measurement: HMR navigation
invalidates a run. The report is local synthetic-session evidence, not a hosted
capacity, Google OAuth or market-acceptance claim.

## Shared assessment release gate

Shared authoring adds `AssessmentDecided` to the existing diagram event stream,
optional assessment state and a public frame field; it adds no D1 migration or
new DO identity. Deploy the compatible backend first, then frontend. Verify an
existing staging diagram before new authoring: legacy document-only snapshots
must still read. Exercise owner/editor concurrent revisions, viewer/outsider
refusal, exact retries after response loss, stale graph review and preservation
after recovery. Use approved accounts only. Local synthetic browser/restart
results do not replace these hosted gates or qualify assessment-heavy fanout.

Once an assessment event is durable, retain its decoder and aggregate state on
backend rollback. Do not deploy an older graph-only backend or delete provider
state to roll back this feature. Frontend rollback can leave assessment records
intact. Graph checkpoint downloads remain graph-only and are not an assessment
backup; do not promise them as full workspace recovery. Keep the deployment
forward-compatible until assessment archival/backup is separately implemented.
