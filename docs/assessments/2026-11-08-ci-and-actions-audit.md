# CI failures and GitHub Actions audit — 2026-11-08

Scope: repair recent failures and modernize all seven workflows before release.
No npm publication, release merge, or deployment was performed for this audit.
Architecture, delivery and test review are self-review. Decision: [ADR 0020](../adr/0020-pin-supported-ci-runtimes-and-actions.md).

## Observed failures

- [Release CI 42517025949](https://github.com/opsydyn/fold-kit-experiments/actions/runs/42517025949)
  failed changelog formatting and the offline force-adapter consumer. Its Viz
  manifest was 0.16.0. Bun 1.4.3 packed the workspace dependency as 0.15.0.
  A minimal release-only manifest-bump fixture reproduces that mismatch and fails
  on 1.4.3 with expected 1.1.0 / received 1.0.0. The same fixture passes on 1.4.4.
  A full force test with Viz temporarily bumped to 0.16.0 also passes on 1.4.4.
- The latest release PR #112 head was `0a683240969b8483884330be58a6699c65801074`
  at inspection. Its changelog already passes Oxfmt after the trusted formatter;
  [its CI run](https://github.com/opsydyn/fold-kit-experiments/actions/runs/42517061808)
  was cancelled. A failed predecessor is not evidence about this head.
- [Main CI 42516805891](https://github.com/opsydyn/fold-kit-experiments/actions/runs/42516805891)
  passed at `680d413` before these changes.
- [Dependabot 42516915601](https://github.com/opsydyn/fold-kit-experiments/actions/runs/42516915601)
  and [42516818719](https://github.com/opsydyn/fold-kit-experiments/actions/runs/42516818719)
  referenced the obsolete foldkit-flow path. Open alert indexing now points to
  Zloz. The independent fidelity experiment still had a stale Flow tarball and
  pinned vulnerable lodash-es transitives. Repair its harness and lock without
  downgrading the qualified mermaid-ast parser or rewriting historical evidence.

## Action inventory

All action references now use full release commit SHAs, with readable version
comments. SHA and action.yml runtime were checked against each upstream release.

| Action                           | Previous | Pinned release | Runtime                                 |
| -------------------------------- | -------- | -------------- | --------------------------------------- |
| actions/checkout                 | v4       | v7.0.1         | Node 24                                 |
| actions/setup-node               | v4       | v7.1.0         | Node 24                                 |
| actions/upload-artifact          | v4       | v7.0.2         | Node 24                                 |
| actions/upload-pages-artifact    | v3       | v5.0.0         | Composite, upload-artifact v7 / Node 24 |
| actions/deploy-pages             | v4       | v5.0.1         | Node 24                                 |
| oven-sh/setup-bun                | v2       | v2.2.0         | Node 24                                 |
| cloudflare/wrangler-action       | v3       | v4.1.3         | Node 24                                 |
| googleapis/release-please-action | v4       | v5.0.0         | Node 24                                 |

Upload-pages-artifact's upstream v5.0.0 composite pins upload-artifact v7.0.0
internally. It is upstream-owned and uses Node 24; the direct upload-artifact
steps use v7.0.2. Weekly grouped Actions Dependabot is enabled.

## Compatibility and review

- Action runtime and project executable are separate. Both now use Node 24 in
  these jobs. Public Node >=22 engine declarations are unchanged.
- Bun is consistently read from packageManager, now bun@1.4.4, rather than using
  an unbounded latest binary in some jobs.
- setup-node v7 removes the dummy NODE_AUTH_TOKEN fallback. Existing publish
  steps provide NODE_AUTH_TOKEN explicitly; registry-url and provenance remain.
  Automatic npm caching is disabled for this Bun workspace.
- Wrangler action v4 defaults to Wrangler v4; the application already has a
  locked Wrangler v4 dependency. Existing deploy command and destination remain.
- Pages upload/deploy actions are upgraded together. Artifact names and paths
  remain unchanged. Hosted permissions and deployment acceptance remain separate.
- No pull_request_target workflow is introduced. The trusted normalizer still
  checks repository, branch, file allowlist and exact head before its atomic
  Markdown-only commit. Its allowlist now includes all ten release components.
- Happy DOM and its registrator are updated to ^21.0.4 to address the current
  advisory. The private fidelity experiment overrides lodash-es to 4.18.1;
  mermaid-ast remains 0.8.2.

## Validation

- Packing regression: fails for wrong dependency version on Bun 1.4.3; passes
  on 1.4.4. Force packed consumer now uses its own empty npm cache and asserts
  the packed Viz dependency equals the source manifest version.
- actionlint 1.7.12: all seven workflows pass.
- `bun run check`, `bun typecheck`, `bun run test`, and `bun run build`: exit 0.
  The formatter suite was rerun after its final allowlist parity assertion:
  34 passed / 91 assertions. Existing intentional skips remain visible in the
  workspace receipts; none are described here as passes.
- Isolated experiment: fresh `npm ci --ignore-scripts --workspaces=false`,
  TypeScript build, 21 Node tests and 21 Bun tests pass. `npm audit` reports
  zero vulnerabilities for its refreshed lock. Original evidence files remain
  unchanged; the independent browser oracle was not rerun for this repair.
- CI browser editing journey: 2 passed (desktop and mobile).
- Hosted CI for the repair revision and release PR: pending. Do not treat local
  tests or historical main success as release approval.

## Sources

- [GitHub: Node 20 removal](https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/).
- [setup-node v7 migration](https://github.com/actions/setup-node/blob/v7.1.0/README.md).
- [Wrangler action v4 migration](https://github.com/cloudflare/wrangler-action/releases/tag/v4.0.0).
- [Bun 1.4.4](https://bun.com/blog/bun-v1.4.4); the packing conclusion above is
  established by the local two-version fixture, not inferred from release notes.
- [Happy DOM advisory](https://github.com/advisories/GHSA-834v-8h66-3h79).
- [lodash advisory](https://github.com/advisories/GHSA-r5fr-rjxr-66jc).
