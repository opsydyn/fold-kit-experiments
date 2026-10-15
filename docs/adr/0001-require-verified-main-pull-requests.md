# ADR 0001: Require verified pull requests on main

## Status

Accepted on 2026-10-14 after user approval and independent API readback of active [ruleset 25102356](https://github.com/opsydyn/fold-kit-experiments/rules/25102356).

## Context

Release PR #20 regenerated two changelogs incompatible with the existing Oxfmt configuration. Its CI run [38590685931](https://github.com/opsydyn/fold-kit-experiments/actions/runs/38590685931) expired awaiting workflow approval, without running jobs. Main had no effective ruleset rules, so the PR could merge without executed CI. The formatting-only correction is local commit `d906890`.

## Decision

Use one active GitHub branch ruleset matching only `refs/heads/main`:

- Require changes through pull requests.
- Require status `check` from GitHub Actions (integration ID `15368`).
- Require testing against an up-to-date base.
- Configure no bypass actors, including administrators and bots.
- Preserve existing merge methods and require no additional code-review approvals.

Keep the existing human approval of bot-triggered workflows, formatter coverage, CI workflow, credentials and release workflow unchanged. No push, publication or release is part of this change.

## Consequences

Unchecked merges and direct pushes to main are disallowed by the configured policy. Bot release PRs may remain blocked until a human approves their workflows. Administrators retain permission to edit rulesets; an empty bypass list is not an immutable security boundary.

## Options Considered

Native enforcement is smaller than a custom merge service. A reminder alone does not prevent unchecked merges. Adding a PAT or GitHub App solely to avoid manual workflow approval is unnecessary for this slice. Excluding generated changelogs from formatting would weaken the checks and is rejected.

## Trade-Offs

Strict base freshness may require branch updates and repeated CI. Binding a check to GitHub Actions does not pin its workflow path; future duplicate `check` job names or changes that skip the check require review.

## Implementation (Completed)

The only operational change is GitHub repository ruleset `25102356`. No dependency, environment variable or workflow file changed. Read the live rules before proposing an update; do not blindly replace the ruleset, add bypass actors or remove existing protections. `.github/workflows/ci.yml` retains its existing `check` job. This ADR is the only local file added.

## Verification

- [x] `gh api repos/opsydyn/fold-kit-experiments/rulesets/25102356`: active enforcement, only `refs/heads/main`, empty bypass actors and exactly the two approved rules.
- [x] `gh api repos/opsydyn/fold-kit-experiments/rules/branches/main`: both rules apply, with GitHub Actions `check` and strict base freshness.
- [x] `gh api repos/opsydyn/fold-kit-experiments/rules/branches/master`: no rules apply.

Independent API reads of the saved ruleset and effective main-branch rules confirmed active enforcement, the exact main ref, both required rules, check identity, strict base freshness and an empty bypass list. No merge, direct push or release was attempted to test rejection. Configuration readback is not a behavioral rejection trial.

GitHub also returned its default additional-approval parameter for unattributed Copilot PRs. It remains unchanged: [GitHub documents that it has no effect when zero approvals are required](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets#additional-approval-for-unattributed-copilot-pull-requests).

## Follow-Up Work

Propose guarded formatting of only the two generated changelogs after each release-PR generation/update. This gate prevents unchecked merges but does not change the generator's output. Qualification of an actual blocked release PR remains a separate authorized exercise.

## Review Date

2026-10-21, or the next release PR if earlier.
