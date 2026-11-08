# Foldkit Zloz npm publication

The Zloz packages are local 0.1.0 release candidates. Record registry
publication separately from local package qualification.

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
layout outside the workspace. The Node CI job targets 22; local receipts record
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

After reviewed commits and green CI, use the existing **publish** workflow at the
approved release ref. Select `foldkit-zloz` first, independently verify its npm
version and contents, then select `foldkit-zloz-elk` at the same ref. That ordering
ensures npm can resolve the adapter's core peer. Before publishing
`foldkit-zloz-force`, verify that its packed Zloz peer and Viz dependency
versions are available in the registry. Select `foldkit-zloz-force` at the
approved ref. The workflow runs package checks
and publishes the checked tarball with `--access public --provenance`.

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

The Mermaid candidate is locally qualified with its own packed-consumer test and
workbench evidence. It participates in the same four-package qualification and linked release
metadata. This configuration does not authorize running publication.
No registry publication is implied by its local 0.1.0 package metadata.
