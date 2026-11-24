# Zloz team staging and recovery

This runbook covers the approved M4 staging candidate at
`https://teams-staging.opsydyn.xyz`. Production and real pilot invitations need
separate authority. Existing `zloz.opsydyn.xyz` stays on its own stack.

For the invite-only Moonwell pilot, see [Questmancer on Teams staging](questmancer-staging.md).

## Quick staging deploy from GitHub

Run **Deploy Teams staging** from **Actions** on `main`. The workflow builds the
dispatched commit, runs focused Teams checks and applies the guarded Alchemy
plan. It supports code and asset updates to the Teams app and server Workers. Use the
[direct worktree workflow](#direct-staging-deploy-from-a-worktree) for changes to
bindings, migrations or other resources.

The first release with shared board renaming includes
`0006_board_name_revision.sql`. From the merged commit, use the direct workflow
below and inspect the plan for the existing Teams D1 database. The migration
adds `diagramDirectory.nameRevision` with a default of zero for existing boards.
Verify the migration history and hosted smoke after applying it. Subsequent
code-only board releases can use the quick deploy again.

The `teams-staging` environment restricts deployment to `main` and supplies the
staging Google client and operator token. The workflow uses the existing
Cloudflare deployment credentials and keeps bootstrap disabled and OPY enabled.
Keep these GitHub Actions variables in the `teams-staging` environment in
sync with the approved settings on the serving Workers.

| Variable                        | Staging setting                           |
| ------------------------------- | ----------------------------------------- |
| `ZLOZ_EMAIL_SIGN_IN_TEAM`       | Team allowed to sign in by email          |
| `ZLOZ_EMAIL_SIGN_IN_FROM`       | Approved sender for email sign-in         |
| `ZLOZ_QUESTMANCER_TEAM`         | Team with access to the Questmancer pilot |
| `ZLOZ_QUESTMANCER_PREVIEW_TEAM` | Team with access to the owner preview     |

For an intentional change, use the reviewed direct deployment first and then
update the matching GitHub variables. The quick guard rejects binding changes.

The run summary reports the verified commit and dispatch-to-smoke time. The
workflow's build marker contains the public commit and Actions run IDs. Hosted
smoke checks both Google and the configured email sign-in capability.

Teams Alchemy commands run from `apps/zloz-team`. The D1 migrations directory
is relative to this working directory so local and hosted checkouts agree on
the same persisted configuration.

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

## Direct staging deploy from a worktree

Use this path to put a reviewed candidate on Teams staging during development,
including changes to Worker bindings. Alchemy builds the files in the selected
worktree, including uncommitted and untracked source. Git history and PR review
are separate steps. Use an isolated worktree so the build cannot overwrite
another session’s workspace output.

### Prepare the candidate

1. Verify that the `tech-radar` profile targets the approved Cloudflare account
   and that its existing state store and `zloz-team-staging/staging` namespace
   are available. Check this before planning because Alchemy can provision a
   missing state store during plan setup.
2. Record the branch, base commit and changed files. For an uncommitted
   candidate, retain the exact reviewed files and record their SHA-256
   fingerprint. Include untracked source and artwork. Keep credentials and
   other ignored files out of the snapshot.
3. Use the existing Teams staging Google OAuth client and callback. See
   [the dotenv example](../.env.example) for the required settings. Load the
   approved staging values from an ignored dotenv file, including
   `ZLOZ_ORIGIN=https://teams-staging.opsydyn.xyz`, `GOOGLE_CLIENT_ID`, and
   `GOOGLE_CLIENT_SECRET`. Use the same file and values for plan and apply.
4. Create a temporary `apps/zloz-team/public/teams-staging-build.json` in the
   reviewed asset build. Set `commit` to the base commit and
   `candidateSha256` to the recorded fingerprint. Track the marker separately
   from the source snapshot it identifies. Remove the local marker after
   deploying. GitHub Actions generates its own marker for a commit deploy.

These commands check and build the candidate from the worktree root.

```sh
git branch --show-current
git rev-parse HEAD
git status --short --branch --untracked-files=all
bun install --frozen-lockfile
bun run check
bun typecheck
bun run test
bun run --filter @opsydyn/zloz-team build
```

### Plan and review

Set `staging_env` to the absolute path of the approved staging dotenv file,
then run from the worktree root.

```sh
staging_env=/absolute/path/to/approved/staging.env
cd apps/zloz-team
bun --env-file="$staging_env" run plan:staging
```

The CLI pins the entry, stage and profile. The staging entry validates the
Teams staging origin and Google credentials. Preserve the deployed feature
settings unless the release explicitly changes them. Keep
`ZLOZ_STAGING_BOOTSTRAP` and `ZLOZ_QUALIFICATION_PROBE` false for ordinary
releases. Keep fixture Workers in the localhost stack.

Review every resource and binding action and record the plan with the candidate
fingerprint, adapter and core package digests, and previous serving Worker
version. Keep any state backups
encrypted and retain the existing D1 migration history. Stop on unexpected
replacements, deletions, state-store changes or changes outside Teams staging.

### Apply and verify

Once the plan is approved, use the same worktree and dotenv file.

```sh
bun --env-file="$staging_env" run deploy:staging --yes
```

The apply command computes a fresh plan. Keep the candidate and staging inputs
fixed between review and apply. If the source, configuration or baseline
deployment changes, regenerate and review the plan before applying. The
[guarded staging runner](../tools/staging-quick.ts) shows the single-process
pattern used for Moonwell. Call `Alchemist.plan`, compare the resource and
binding actions to the approved list, and call `Alchemist.apply` on that
same plan while the staging lease is held.

After apply, fetch the public marker and verify the staged app.

```sh
origin=https://teams-staging.opsydyn.xyz
curl --fail --silent --show-error "$origin/teams-staging-build.json"
curl --fail --silent --show-error "$origin/api/zloz/session"
curl --fail --silent --show-error "$origin/api/zloz/capabilities"
```

Compare the marker to the reviewed fingerprint, check for an empty anonymous
session and verify Google sign-in is configured. Read serving Worker version
IDs from Cloudflare and retain them with the plan, D1 migration record and
browser evidence. Use the feature’s hosted checks to confirm the signed-in
flow. For Moonwell, the [pilot and owner preview checks](questmancer-staging.md)
depend on which team flag is enabled.

## Invited email sign-in

Teams staging can offer **Continue with email** alongside Google. To enable it,
set both `ZLOZ_EMAIL_SIGN_IN_TEAM` to the staging test team's ID and
`ZLOZ_EMAIL_SIGN_IN_FROM` to a sender on a domain already enabled for
[Cloudflare Email Sending](https://developers.cloudflare.com/email-service/configuration/send-bindings/).
Review the backend Worker plan for the `ZLOZ_SIGN_IN_EMAIL` binding and its
allowed sender address. Keep both settings empty to roll back the email option.
The regular Teams invitation, member records and Google sign-in remain available.

The owner creates a separate viewer invitation for each QA address. For Gmail
plus aliases, use the full address, such as `qa+moonwell-1@gmail.com` and
`qa+moonwell-2@gmail.com`. Each player opens their own link in a separate browser
profile, types the exact invited address, enters the six-digit code, and
accepts the invitation. Each alias creates its own Teams identity and role.
Returning verified members of the configured team can sign in directly by email.
First-owner bootstrap still requires the existing verified Google account.

Codes expire after five minutes and are single-use. A code has three verification
attempts. Requests and verifications are rate-limited. Keep codes, live
invitation URLs, and session cookies out of screenshots, logs, and playtest notes.

Use the Questmancer browser test for simulated delivery on localhost. For a
manual local run use `ZLOZ_EMAIL_SIGN_IN_TEAM=*` and
`ZLOZ_EMAIL_SIGN_IN_FROM=qa@example.test`. Alchemy writes local message bodies
to `.alchemy/local/email/text/` under this workspace. The wildcard is accepted
only on HTTP localhost. Qualify mailbox receipt and invitation acceptance
with the approved QA aliases before relying on staging email for the playtest.

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
