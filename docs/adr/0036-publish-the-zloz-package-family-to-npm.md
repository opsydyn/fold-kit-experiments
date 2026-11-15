# ADR 0036: Publish the Zloz package family to npm

## Status

**Accepted; initial publication completed at 0.3.0**, verified 2026-11-11.
Supersedes the npm-publication clause of ADR 0014 and extends ADRs 0011, 0015
and 0016. The original 2026-11-10 proposal targeted 0.2.0; the linked release
advanced to 0.3.0 before publication. This record does not authorize another release.

At proposal time, ADR 0014 stated: "No npm publish workflow, release tag or package publication is
authorized." That clause was scoped to the website publication it governed, but
it was the repository's only standing statement on Zloz npm release. Reversing
it needed a decision of its own rather than a workflow dispatch.

ADR number 0036 was reserved while 0021–0035 were on unmerged branches. Those
decisions have since landed; this record retains its original number.

## Context

At proposal time, the four packages `@opsydyn/foldkit-zloz`, `-elk`, `-force` and
`-mermaid` were unpublished 0.2.0 candidates. Release PR #119 subsequently advanced
the linked family to 0.3.0. All four now have 0.3.0 as their npm `latest` version;
see the execution record below.

At proposal time, the delivery path already existed. The `publish` workflow lists
all four as `workflow_dispatch` choices, builds the core first, runs the family's
tests, then packs and publishes each tarball with `--access public --provenance`.
`docs/releases/foldkit-zloz.md` already specifies the package contract, the local
qualification sequence and the publication ordering. The original gap was authorization and
a qualification receipt, rather than missing release engineering.

The consumer pressure is concrete. A separate assessment of porting Płanetnik's
report site to FoldKit identified `@xyflow/react` (≈1,460 LOC in one component)
as the single largest dependency with no consumable FoldKit replacement, solely
because Zloz was unpublished. That was one consumer, not a market.

## Decision

Publish the four Zloz packages at **0.3.0** from a reviewed `main`
ref, using the existing `publish` workflow in the order
`foldkit-zloz` → `foldkit-zloz-elk` → `foldkit-zloz-force` → `foldkit-zloz-mermaid`,
verifying registry contents between each.

`@opsydyn/foldkit-zloz-cli` stays unpublished. It is absent from both the
release-please manifest and the workflow's choices, and ADR 0016 scoped it as a
standalone CLI rather than a published package.

The Mermaid rewrite was committed and merged in PR #118 before the 0.3.0 release.
Publication must continue to use committed, reviewed, CI-green refs only.

## Consequences

- Four package names are now publicly claimed and their 0.3.0 export maps are a
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

## Options considered (original 0.2.0 proposal)

1. **Publish all four at 0.2.0 (original proposal).** Matches the documented contract,
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

- Record a publication receipt (registry version, contents, provenance, and a
  registry-installed consumer check) as `docs/releases/foldkit-zloz.md` requires.
- Keep the CLI private (`"private": true`). Local tarballs qualify installation
  and types only; any future CLI publication requires a separate decision.

## Review date

At the first 1.0 candidate, or when the React Flow parity gaps close — whichever
comes first.

## Execution record

Verified on 2026-11-11: [release PR #119](https://github.com/opsydyn/fold-kit-experiments/pull/119)
merged the linked 0.3.0 release, and npm reports `latest: 0.3.0` for
[core](https://www.npmjs.com/package/@opsydyn/foldkit-zloz/v/0.3.0),
[ELK](https://www.npmjs.com/package/@opsydyn/foldkit-zloz-elk/v/0.3.0),
[force](https://www.npmjs.com/package/@opsydyn/foldkit-zloz-force/v/0.3.0) and
[Mermaid](https://www.npmjs.com/package/@opsydyn/foldkit-zloz-mermaid/v/0.3.0).
The 0.2.0 references in the original alternatives above describe the proposal,
not the shipped version. This registry-version check does not replace the
publication provenance and consumer receipt required by the release guide.
