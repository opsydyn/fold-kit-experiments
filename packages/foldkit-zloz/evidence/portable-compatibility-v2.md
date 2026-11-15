# V2 portable compatibility batch

result: complete

claim: approved adapter capability/version decisions and safe v2 layout/Mermaid/CLI adoption are implemented locally; native v2 patch/receipt/packet/audit formats remain explicit follow-up work.

evidence: full workspace tests, typecheck, lint/format and API documentation passed; installed Node/Bun CLI and package fixtures and built CLI artifacts are recorded below.

remaining uncertainty: no current CI, registry, hosted, device or human acceptance evidence; format capability is not engine eligibility or Apply authority.

next: batch native v2 audits, modelling patches, conversion receipts and portable review packets with old-reader fixtures.

Measured parent: `21791ade`, isolated `codex/zloz-context-map` worktree.
Architecture, delivery and test-quality reviews are self-review. See
[ADR 0103](../../../docs/adr/0103-qualify-v2-portable-adapter-boundaries.md).

## Delivered contract and scope

The headless capability report validates all checkpoints, names native/projected
and version-required boundaries and retains strict-incompatible edge IDs and
whole-model downgrade findings without returning downgraded data. Origin-only
loose authoring is a finding even when every graph happens to use strict-compatible
edges. Reports are deeply frozen review data, not permission or current consent.

Layout requests preserve current mode through detachment, engine validation and
stale-result acceptance. Mode mismatch is ignored like a stale result. Geometry
changes retain full-frame graph/mode Undo. Real ELK and force tests cover loose
input-to-input edges without mutating source or identity. Handwritten requests
without mode remain strict; engine-specific constraints remain unchanged.

The new Mermaid v2 entry validates the complete document, emits a distinct v2
protocol and retains mode/ordered identity. Source-only loose semantics and camera
loss reject by default. Report mode accepts omissions, not malformed input.
Legacy graph-only export stays strict and retains its old protocol/output.

Effect CLI validates v1/v2 and inspects full v2 model capabilities through bounded
UTF-8 streams. V2 Mermaid selects the explicit adapter. Valid v2 input to legacy
v1 operations emits `adapter-version-required` with exit 1, distinct from malformed
input with exit 2. V1 readers and native Apply contracts remain unchanged. There is
no silent graph extraction, mode rewriting, file modification or new network I/O.

This closes the approved **capability/decision and safe-adoption batch**, not native
v2 authoring through patches, receipts, packets or relationship audits. Those
require coupled versioned source, provenance, dry-run, Apply/reopen and recomputation
contracts; the ADR records their concrete completion requirements.

## Regression evidence

Before implementation, the capability/explicit Mermaid exports were absent, loose
layout threw in the strict-only copy path and CLI validation returned exit 2 for a
valid v2 model. Focused tests reproduced those boundaries. New tests cover actual
loose edges, current/edition/origin-only incompatibility, unchanged source, frozen
findings, cross-mode stale layout, Undo, real engines, strict legacy rejection,
structured CLI stdout/exits and malformed modes.

Installed-consumer fixtures exercise new core types, explicit Mermaid v2 protocol
and mode, and the real CLI binary under Node and Bun. V1 exact output tests remain
part of the suite. A temporary mutation reporting source-only semantic loss for
strict instead of loose mode failed the projection regression; original source
was restored and the test passed. Development lint/type failures were corrected
rather than counted as passing evidence.

## Verification

Observed local results:

- `bun run check`: exit 0, with advisory lint and existing Viz skill-version warnings.
- `bun typecheck`: exit 0. Nonfatal sandbox Vite listen diagnostics are separate from TypeScript failures.
- `bun run test`: exit 0 with cache access for installed-consumer fixtures. Core **813 pass**, ELK **12 pass**, force **7 pass**, Mermaid **45 pass**, CLI **33 pass**, workbench **178 pass**; all other workspaces passed. Two existing promo skips remain.
- `bun run --filter @opsydyn/foldkit-zloz docs`: exit 0 with warnings treated as errors. Generated pages include capability types/function, explicit Mermaid v2 export and CLI APIs.
- The real CLI tarball ran under Node and Bun against the literal loose input-to-input fixture: retained ordered shared ports, blocked strict downgrade, validated v2 mode and explicit legacy incompatibility exits.
- The original sandboxed full test run stopped in the existing workspace packaging fixture because Bun could not write its external cache. The authorized rerun passed; the cache denial was not a code regression.

Built CLI output is retained in [capability inspection](../../../packages/foldkit-zloz-cli/evidence/compatibility-v2.json), [loose Mermaid projection](../../../packages/foldkit-zloz-cli/evidence/mermaid-connection-v2.json) and [v2 model validation](../../../packages/foldkit-zloz-cli/evidence/validate-model-v2.json).
The mixed-mode model fixture has strict-compatible graphs: downgrade is reviewable
with explicit archived/origin mode losses, not automatically lossless. Separate
loose-edge unit/engine/installed-binary fixtures block downgrade. An initial artifact
checker incorrectly expected that mode-only fixture to be blocked; its independent
expectation was corrected without changing product output.

Reproduce from the worktree root after building the CLI:

```sh
node packages/foldkit-zloz-cli/dist/bin.mjs compatibility inspect -i packages/foldkit-zloz/test/fixtures/model-v2-modes.json
node packages/foldkit-zloz-cli/dist/bin.mjs mermaid export -i packages/foldkit-zloz/test/fixtures/connection-v2-loose.json --loss-policy report
node packages/foldkit-zloz-cli/dist/bin.mjs validate -i packages/foldkit-zloz/test/fixtures/model-v2-modes.json
```

There are no UI changes; mounted history evidence from the preceding batch is
retained separately and is not claimed as fresh visual evidence. No deployment,
registry/npm publication, current CI or human acceptance was performed.

Recommendation: needs follow-up for native versioned authoring/evidence formats.
