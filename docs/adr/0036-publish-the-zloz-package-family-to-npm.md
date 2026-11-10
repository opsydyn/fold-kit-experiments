# ADR 0036: Publish the Zloz package family to npm

## Status

**Proposed**, 2026-11-10. Supersedes the npm-publication clause of ADR 0014.
Extends ADRs 0011, 0015 and 0016. Not authorized until the user accepts it.

ADR 0014 states: "No npm publish workflow, release tag or package publication is
authorized." That clause was scoped to the website publication it governed, but
it is the repository's only standing statement on Zloz npm release, so reversing
it needs a decision of its own rather than a workflow dispatch.

ADR number 0036 is used because 0021–0035 already exist on unmerged branches
while `main` carries up to 0020. Renumber if those land first.

## Context

The four packages `@opsydyn/foldkit-zloz`, `-elk`, `-force` and `-mermaid` are at
0.2.0 in `.release-please-manifest.json` and in their manifests, and are absent
from the npm registry. The package README describes them as release candidates.

Nothing is missing from the delivery path. The `publish` workflow already lists
all four as `workflow_dispatch` choices, builds the core first, runs the family's
tests, then packs and publishes each tarball with `--access public --provenance`.
`docs/releases/foldkit-zloz.md` already specifies the package contract, the local
qualification sequence and the publication ordering. The gap is authorization and
a qualification receipt, not engineering.

The consumer pressure is concrete. A separate assessment of porting Płanetnik's
report site to FoldKit identifies `@xyflow/react` (≈1,460 LOC in one component)
as the single largest dependency with no consumable FoldKit replacement, solely
because Zloz is unpublished. That is one consumer, not a market.

## Decision

Authorize publication of the four Zloz packages at 0.2.0 from a reviewed `main`
ref, using the existing `publish` workflow in the order
`foldkit-zloz` → `foldkit-zloz-elk` → `foldkit-zloz-force` → `foldkit-zloz-mermaid`,
verifying registry contents between each.

`@opsydyn/foldkit-zloz-cli` stays unpublished. It is absent from both the
release-please manifest and the workflow's choices, and ADR 0016 scoped it as a
standalone CLI rather than a published package.

Do not publish while `packages/foldkit-zloz-mermaid` has uncommitted work. At the
time of writing its `src/index.ts` is mid-rewrite (−367 lines) with two untracked
new source files. Publish from committed, reviewed, CI-green commits only.

## Consequences

- Four package names become publicly claimed and their 0.2.0 export maps become a
  public contract. Pre-1.0 allows breaking changes in a minor bump, which
  `docs/releases/foldkit-zloz.md` already states, but npm consumers will pin
  anyway and deprecation is cheaper than unpublication. npm unpublish is
  restricted after 72 hours; this decision is effectively irreversible.
- The React Flow parity review of 2026-11-05 remains accurate and public: no
  per-item deletion flags, no viewport culling, no partial-overlap marquee, and
  world-relative rather than parent-relative child coordinates. Publishing does
  not close those gaps and invites issues about them.
- Release-please's linked-versions plugin keeps the family on one version, so any
  one package's release bumps all four from here on.
- Provenance attestation ties the tarballs to this repository and to the workflow
  run, which is desirable and also makes the publishing identity public.
- The promo and workbench deployments are untouched; ADR 0014's website decisions
  stand in full apart from the publication clause.

## Options considered

1. **Publish all four at 0.2.0 (proposed).** Matches the documented contract,
   the linked-versions grouping and the adapters' peer pins. Costs an
   irreversible public commitment at a pre-1.0 maturity.
2. **Publish only `@opsydyn/foldkit-zloz`.** Smaller surface, but the force
   adapter is what a graph consumer actually needs, and linked versions mean the
   others follow on the next release anyway. Rejected as a half-measure.
3. **Publish under a `next` dist-tag at 0.2.0.** Keeps `latest` unclaimed and
   signals candidate status honestly. The workflow publishes without `--tag`, so
   this needs a workflow change. **This is the strongest alternative** and the
   one to take if the pre-1.0 exposure is the main worry.
4. **Keep them unpublished (status quo, ADR 0014).** Costs nothing and blocks the
   one known consumer. Defensible while parity gaps are open.

## Trade-offs

Publishing trades an irreversible public API commitment, made at a maturity the
repo's own review calls incomplete, for unblocking one identified consumer and
making the family installable outside the workspace. If the parity gaps are
expected to change the public shape, option 3 or 4 is better than option 1.

## Follow-up work

- Land the in-flight `foldkit-zloz-mermaid` rewrite and re-run qualification
  before any publish — owner: whoever owns `codex/zloz-relationship-audit`.
- Record a publication receipt (registry version, contents, provenance, and a
  registry-installed consumer check) as `docs/releases/foldkit-zloz.md` requires.
- Reconcile the package README's "0.1.0 release candidates" wording with the
  actual 0.2.0 version.
- Decide whether `foldkit-zloz-cli` is ever published; if not, say so in its
  manifest with `"private": true`.

## Review date

At the first 1.0 candidate, or when the React Flow parity gaps close — whichever
comes first.
