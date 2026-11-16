# Foldkit Zloz npm publication

The four Zloz packages were initially published at 0.3.0. See the
[ADR 0036 execution record](../adr/0036-publish-the-zloz-package-family-to-npm.md#execution-record)
for verified registry versions. Keep registry publication evidence separate from
local package qualification for subsequent releases.

The [historical qualification receipt](foldkit-flow-qualification.md) records
the original artifacts. It does not qualify the renamed tarballs; rerun the
checks below for the Zloz package family.

## Package contract

- Scoped names include `@opsydyn/foldkit-zloz`, `@opsydyn/foldkit-zloz-elk`,
  `@opsydyn/foldkit-zloz-force`, and `@opsydyn/foldkit-zloz-mermaid`.
- ESM `.mjs` and `.d.mts`, explicit export maps and Node 22+ tooling.
- No source-only runtime export condition. Consumers use built files.
- Explicit package files: distribution, README, changelog, licence and notices.
  Tests, nested tarballs, workspace links and catalog specifiers must not ship.
- Core runtime imports work without FoldKit, Effect, ELK or browser globals.
  FoldKit and Effect are optional peers used by `/foldkit` only.
- Optional adapters pin the Zloz core peer at the same version.
- The Mermaid exporter has no runtime dependencies other than its core peer. Its
  source/identity/loss bundle is versioned separately from canonical Zloz JSON.
- The force adapter depends on FoldKit Viz. Its eligibility subpath is separate
  from the engine entry for hosts that load layout on demand.
- Existing catalogue policy, release-please changelogs and linked versions apply.
  Release-please updates that peer alongside the linked version. Breaking pre-1.0
  APIs require a minor bump.
- Publint, Are The Types Wrong and clean npm-consumer checks gate tarballs.

## Local qualification

```sh
bun install --frozen-lockfile
bun run check
bun typecheck
bun run test
bun run --filter @opsydyn/foldkit-zloz-mermaid pack:check
bun run --filter @opsydyn/foldkit-zloz-force pack:check
bun run --filter @opsydyn/foldkit-zloz-elk pack:check
bun run --filter @opsydyn/foldkit-zloz pack:check
bun run --filter @opsydyn/web test:e2e e2e/zloz.spec.ts
```

The core package's consumer test packs core and ELK, installs the core alone
with npm to check optional peers, then installs both tarballs with the qualified
FoldKit/Effect/platform-browser versions. It checks core Node/Bun runtime imports,
TypeScript Bundler and NodeNext resolution, Node server rendering and real ELK
layout outside the workspace. The Node CI job targets 24; local receipts record
the actual tested runtime rather than treating that configuration as CI evidence.

The force adapter's consumer test packs its runtime dependencies and installs
the tarballs with npm in a temporary directory. It checks both entry points
under Bundler and NodeNext resolution, then executes the compiled consumer in
Node and Bun. The consumer also checks that optional UI frameworks are absent.

The resulting archives live at `packages/<name>/dist/pack/`. Install those exact
files into local consumers before publication. Package packing is local and does
not contact the registry to publish. `bun pm pack` resolves development workspace
specifiers; npm publishes the resulting archive, not the workspace source tree.

## Release action

After reviewed commits and green CI, merging the linked release PR creates the
four tags and invokes **zloz-release-train**. The train waits for successful push
CI at the exact release SHA, qualifies all archives, then publishes core → ELK →
Force → Mermaid. Each stage requires exact registry archive integrity, identity,
peer/dependency and repository/source provenance checks plus `npm audit signatures`
in a clean registry consumer. The final installed Node consumer exercises all four.
The independent **publish** workflow no longer accepts Zloz packages.

For recovery, inspect the retained `verification.json` and candidate archives in
the workflow artifacts. Dispatch **zloz-release-train** from the matching core
release tag and supply its full 40-character product commit as `source_sha`. If the
release automation itself needed repair, dispatch from trusted main with that same
product commit. The controller must have identical package/build inputs, allowing
only the six enumerated release-control/documentation paths to differ. CI must
pass on both controller and product commits. All four tags stay at the product
SHA; provenance records the actual publication source, and receipts retain both.
Manual and automatic runs share one concurrency lock.
Existing versions are verified and skipped; downstream publication stops at the
first failed barrier. Only registry reads retry. Never blindly retry an uncertain
upload, move tags, unpublish or accept a differing archive. A byte mismatch on
rebuild requires inspection of the retained candidate. See [ADR 0115](../adr/0115-serialize-zloz-publication-with-registry-verification.md).

Use the existing repository credential/provenance setup. This slice neither
changes credentials nor configures npm trusted-publisher settings. A future switch
to trusted publishing is a separate operational change. Verify registry integrity,
provenance and a registry-installed consumer before recording publication complete.

## Current limits

Browser automation is evidence for the recorded browsers and viewport sizes only.
Physical touch, assistive-technology review, large-graph performance and worker
bundling require their own qualification. No performance capacity claim is made.
The default ELK fallback leaves standalone Bun 1.4.4 processes alive after layout;
use Node for CLI layout jobs. See the adapter README for the observed upstream cause.

The Mermaid package is qualified with its own packed-consumer test and
workbench evidence. It participates in the same four-package qualification and linked release
metadata. This configuration does not authorize running publication.
The CLI remains a private workspace package. Its local tarballs are installation
and type-contract fixtures, not npm publication candidates.

## Scoped v3 core release

The 2026-11-15 batch is authorized for commit/push/publication after green checks;
see [ADR 0108](../adr/0108-release-the-scoped-v3-core.md). Its remaining native,
adapter, advanced-tool, performance and human acceptance limits must accompany the
release. Existing 0.4.0 tags identify previous source: release-please must issue
the next linked version rather than reusing those tags. CLI and Alchemy remain
private. Verify all four registry versions, exact core peer pins, provenance and
a registry-installed consumer before recording publication complete.
