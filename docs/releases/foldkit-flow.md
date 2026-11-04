# FoldKit Flow npm publication

Both 0.1.0 packages are local release candidates. A manifest, tarball or passing
local check is not evidence of registry publication.

See the [local qualification receipt](foldkit-flow-qualification.md) for tested
behaviour, exact runtime versions and remaining acceptance limits.

## Package contract

- Scoped names: `@opsydyn/foldkit-flow` and `@opsydyn/foldkit-flow-elk`.
- ESM `.mjs` and `.d.mts`, explicit export maps and Node 22+ tooling.
- No source-only runtime export condition. Consumers use built files.
- Explicit package files: distribution, README, changelog, licence and notices.
  Tests, nested tarballs, workspace links and catalog specifiers must not ship.
- Core runtime imports work without FoldKit, Effect, ELK or browser globals.
  FoldKit and Effect are optional peers used by `/foldkit` only.
- ELK is isolated in the adapter; the adapter pins the core at the same version.
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
bun run --filter @opsydyn/foldkit-flow-elk pack:check
bun run --filter @opsydyn/foldkit-flow pack:check
bun run --filter @opsydyn/web test:e2e e2e/flow.spec.ts
```

The core package's consumer test packs both packages, installs the core alone
with npm to check optional peers, then installs both tarballs with the qualified
FoldKit/Effect/platform-browser versions. It checks core Node/Bun runtime imports,
TypeScript Bundler and NodeNext resolution, Node server rendering and real ELK
layout outside the workspace. The Node CI job targets 22; local receipts record
the actual tested runtime rather than treating that configuration as CI evidence.

The resulting archives live at `packages/<name>/dist/pack/`. Install those exact
files into local consumers before publication. Package packing is local and does
not contact the registry to publish. `bun pm pack` resolves development workspace
specifiers; npm publishes the resulting archive, not the workspace source tree.

## Release action

After reviewed commits and green CI, use the existing **publish** workflow at the
approved release ref. Select `foldkit-flow` first, independently verify its npm
version and contents, then select `foldkit-flow-elk` at the same ref. That ordering
ensures npm can resolve the adapter's core peer. The workflow runs package checks
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
