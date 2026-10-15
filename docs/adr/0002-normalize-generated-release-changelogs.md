# ADR 0002: Normalize generated release changelogs

## Status

Accepted for bounded local implementation on 2026-10-14 following user approval. Not deployed or live-write qualified.

## Context and Challenge

Release-please has twice generated changelogs incompatible with strict Oxfmt checks. ADR 0001 now requires PRs and verified CI before merge, including release PRs. This protects main but leaves repeated manual formatting work.

The strongest counterargument is that the native gate and manual formatting are already sufficient; a general auto-fix service would introduce unnecessary write authority. The minimum useful addition is a single-purpose hook using existing Bash, jq, gh and locked Oxfmt tools. GitHub owns branch concurrency and merge enforcement; this repo owns only normalization of its two Markdown files. Challenge verdict: proceed. Boundary verdict: safe with noted risk.

## Decision

Use a separate downstream normalization job after release-please creates or updates its PR. Do not put normalization ahead of existing npm publication steps. The release job exposes its PR outputs; its tagging and publishing steps remain unchanged. Explicit status conditions let normalization run when PR outputs exist even if later publication fails, but not after workflow cancellation.

Run `.github/scripts/format-release-changelogs.sh` from a checkout of the workflow's trusted `github.sha`, with persisted checkout credentials disabled and dependencies installed from its frozen lockfile with install scripts disabled. Never check out or execute release-PR code. Use the same existing release token choice; add no token, bypass or permission beyond existing contents-write authority. The new job requests only contents-write and pull-requests-read permissions.

Accept only the one same-repository, open, pending release-please PR targeting main and its current fixed release branch. Accept only the five existing generator paths: the release manifest, two package manifests and two changelogs. Read the two Markdown blobs at a pinned head plus directory metadata; reject symlinks, binary/truncated/oversized content and unexpected changes.

Run the trusted formatter with the existing configuration, without GitHub/npm tokens in its child environment. Commit only changed changelog contents in one GitHub `createCommitOnBranch` mutation with `expectedHeadOid`. A normalized snapshot causes no write. Head races, malformed inputs and errors stop without retries or force-pushes. Strict CI and human workflow approval remain required on the final revision.

## Consequences and Limits

This avoids executing PR-controlled scripts with a write token and prevents overwriting a concurrent head update. Existing publication must not depend on normalization success. A changed release layout deliberately fails closed until its allowlist is reviewed.

PR state is checked before writing, but GitHub's branch commit operation does not atomically bind PR open/label state. A concurrent PR closure could leave a formatting-only commit on that branch; it cannot merge main through this hook. On an ambiguous API response, inspect the branch before any manual recovery rather than blindly retrying.

Local tests substitute only the external GitHub CLI transport and exercise the real Bash hook, jq and formatter. They do not prove live token permissions, Actions output wiring or bot-triggered CI approval. No live writes, dispatch, push, release or publication are authorized by this implementation pass.

## Options and Trade-Offs

Manual formatting is simpler but repeatedly required. A generic PR auto-formatter would have excessive scope. Post-merge formatting is too late. A custom release generator/plugin would add dependencies and maintenance. The narrow existing-tool hook preserves strict checks, with a conservative allowlist and one additional CI job.

## Implementation and Verification

Affected paths: the release workflow, the Bash hook, its Bun boundary tests, root test command and this ADR. No package exports, versions, lockfile, formatter/linter configuration or CI check workflow change.

Require a failing regression before implementation; verify normalized content, one two-file head-pinned commit, no-op behavior, one-file updates, malformed/fork/closed/stale inputs, unexpected paths, unsafe blobs and rejected concurrent updates without retries. Include the hook tests in `bun run test`. Verify the separate job uses trusted source and does not alter existing publication conditions. Run lint/format, typecheck and all workspace tests.

Local verification on 2026-10-14: the initial regression failed on zero normalization commits; workflow tests also rejected missing wiring, incorrect publisher placement, the implicit success dependency and silent acceptance of empty action output. The final 28 boundary/wiring tests pass with real Bash/jq/Oxfmt and fake GitHub transport. Full root tests pass: 918 tests, one existing built-artifact skip. Lint/format and workspace typechecks pass with no reported warnings/errors. Read-only GitHub metadata confirmed the expected regular-file mode and Blob fields. A scoped read-only review found no actionable issues before the final failure-isolation and missing-output guards were tightened and retested. No live write qualification is claimed.

## Recovery and Follow-Up

If the hook fails, keep the final-revision CI gate strict and inspect the release branch. Formatting-only commits are reviewable; never reset the branch or bypass checks as recovery. A later approved change can remove the normalization job without removing the native gate or changing publication steps.

Commit/push/PR and a single live release-PR observation need separate approval. Review this decision after that observation or on 2026-10-21.
