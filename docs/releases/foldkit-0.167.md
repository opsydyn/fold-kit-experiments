# FoldKit 0.167 release notes

## Published (2026-10-09)

[PR #15](https://github.com/opsydyn/fold-kit-experiments/pull/15) and
[release PR #16](https://github.com/opsydyn/fold-kit-experiments/pull/16) are merged.
The release commit is `26e4dea`. Both PRs passed hosted lint, typechecks,
workspace tests and production builds.

- [`@opsydyn/astro-foldkit@0.8.0`](https://www.npmjs.com/package/@opsydyn/astro-foldkit/v/0.8.0):
  [GitHub release](https://github.com/opsydyn/fold-kit-experiments/releases/tag/astro-foldkit-v0.8.0).
- [`@opsydyn/foldkit-viz@0.11.0`](https://www.npmjs.com/package/@opsydyn/foldkit-viz/v/0.11.0):
  [GitHub release](https://github.com/opsydyn/fold-kit-experiments/releases/tag/foldkit-viz-v0.11.0).

Both versions and their `latest` tags were independently verified through npm,
including registry integrity metadata. The
[publication workflow](https://github.com/opsydyn/fold-kit-experiments/actions/runs/37902785257)
completed both upload steps successfully.

Cloudflare and GitHub Pages deployments succeeded for the release commit.
The [web comparison](https://opsydyn-web.opsydyn.workers.dev/comparison),
[promo comparison](https://opsydyn.github.io/fold-kit-experiments/viz/examples/comparison/),
Storybook and API documentation returned HTTP 200. The hosted comparison
template contains Viz `0.11.0` and FoldKit `0.167.0`. These checks establish
deployment and artifact availability, not the outstanding browser acceptance below.
GitHub marks all six Astro security alerts as fixed.

## Security patch (2026-10-09)

The merged [PR #15](https://github.com/opsydyn/fold-kit-experiments/pull/15)
upgraded all three Astro pins from 7.1.1 to 7.2.8 after security-patch approval.
This addresses GitHub's
[AVIF processing RCE](https://github.com/advisories/GHSA-26w7-cxv4-gfx2)
and [base-path authorisation bypass](https://github.com/advisories/GHSA-376h-93r7-7g6f).
The former requires untrusted AVIF processing; the latter requires a non-root
base and pathname-based authorisation middleware. These alerts do not alone
establish exploitability of the demo. Astro 7.2.8 requires Sharp 0.35.4 or newer.
All three local consumers resolve Sharp 0.35.5. Frozen-lockfile install,
lint/typecheck, all 565 tests, both app builds and the Pages-prefix check passed
again on the patched dependency tree. Publication is verified separately.

## Compatibility

Both published packages now target FoldKit `>=0.167.0 <0.168.0` and stable
Effect `4.0.0`. Upgrade FoldKit alongside these packages: the previous
0.165/0.166 peer range is no longer supported by this release. Astro is
7.2.8 in the release qualification environment. Viz's pure geometry entry points still
work without installing either optional peer.

Astro uses `@foldkit/vite-plugin` 0.27.x and FoldKit's generated build identity
for coordinated client/server builds. Explicit deployment IDs remain supported.
The public `lazyApp`, `defineApp`, `definePage` and `resolvePageDocument`
contracts are unchanged. See the [migration guide](../migrations/foldkit-0.167.md)
for subscription renames, lifted lifecycle readers and SSR deployment guidance.

## Examples

- The new comparison workbench composes up to four keyed histogram/scatter
  panels. Reorder preserves child state, removed IDs ignore late messages,
  and linked ranges highlight every matching datum while preserving local
  inspection. It is available at `/comparison`, in `Charts/Comparison`, and
  at the promo's `/examples/comparison/`.
- Comparison source, copy, ZIP and external StackBlitz use maintained app
  sources. Exports snapshot panel IDs, kinds, order, linking and the next ID,
  not transient measurements or inspection. Vendoring checks canonical paths
  and rejects traversal and escaping symlinks.
- The existing shared KeyedQuery dataset explorer and its standalone starter
  are aligned with FoldKit 0.167. Stale-result rejection remains distinct from
  the request-diagnostics example's explicit route-exit interruption.
- Chart fixes cover range boundaries, responsive brush preservation, current
  pointer bounds, reverse keyboard entry and visible native focus outlines.

These are application examples, not new public chart-controller APIs. Astro
retains lifecycle/rendering ownership and Viz retains pure chart primitives.

## Qualification boundary

The source review and automated checks do not imply complete browser acceptance.
Desktop/390px visual rechecks, complete pointer/focus journeys, real export
delivery and assistive-technology/device checks remain tracked in the
[comparison qualification record](../superpowers/specs/2026-10-08-keyed-chart-comparison-qualification.md).
Storybook's large-chunk advisory and TypeDoc's missing-reference warnings are
tracked separately from lint/typecheck failures. GitHub Actions also reports
deprecated Node 20 action runtimes being forced to Node 24; updating those
actions is follow-up maintenance, not part of the Astro security patch.

The repository releases via a reviewed feature PR, then release-please's
version/changelog PR. GitHub release creation, npm publication and app/docs
deployment are separate outcomes and must each be verified.

### Integrated local checks (2026-10-09)

- Frozen-lockfile install, lint/format and all five workspace typechecks passed.
- 565 tests passed: Astro 78, Viz 168, promo 78 and web 241. The Pages-only
  test is skipped in the default suite and passed separately against a
  base-path production build (229 assertions).
- Both production apps, Storybook and TypeDoc built. Storybook retains its
  large-chunk advisory; TypeDoc retains 11 missing-reference warnings.
- Regression checks caught and fixed comparison links/download paths under
  the Pages prefix and the dataset starter's mismatched dependency pins.
  Comparison filesystem tests now use the OS temporary directory rather than
  macOS-only paths, so they can run on the Linux CI host.
- The first hosted run exposed a leaked `FOLDKIT_BUILD_ID` between test files.
  Client and integration tests now scope and restore the environment per test;
  the inherited-ID/randomised regression, full suite and typecheck pass locally.

These are local automated results, not hosted publication or browser acceptance.
