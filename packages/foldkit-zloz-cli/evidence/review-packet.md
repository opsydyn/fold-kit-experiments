# Portable review packet qualification

## result

complete

## claim

The optional Mermaid package provides a pure `createReviewPacket` builder and
the Effect CLI exposes `review packet`. Chosen canonical snapshots, exact
data-only conventions, audit findings and both loss-aware Mermaid projections
travel together in a versioned JSON artifact. Core remains independent of the
optional adapter. Creation is distinct from semantic regression gating.

## evidence

- Root `bun typecheck`, `bun run check` and `bun run test` passed; the public API
  documentation build passed. The final dedicated CLI typecheck also passed,
  including its Mermaid/core build dependencies. Repository warnings and existing
  skipped tests remain.
- The adapter suite passed 18 tests with 179 assertions; the CLI suite passed
  17 tests with 284 assertions. Real packed consumers qualified Node/Bun runtime
  imports, installed commands and Bundler/NodeNext types. Optional adapter consumers
  still install no Effect, Foldkit, Mermaid parser, browser or layout engine.
- Tests cover detached JSON round trip and audit reproduction, exact owned/current
  selectors, same-edition review, copied rule data, no model mutation, callbacks
  rejected without execution, strict/report behavior, camera-only losses, scoped
  diagnostics and unsupported projection rejection. The exported CLI diagnostic
  schema preserves optional side metadata; old command shapes remain unchanged.
- The [executable script](review-packet.mjs) produced a
  [passing transcript](review-packet-results.json) for 32 real Node/Bun scenarios.
  It records runtime versions, verifies single-JSON stream framing and 0/1/2
  exits, and reproduces every created packet's audit from only exported snapshots
  and convention data. It also verifies nested C4 identity, Unicode edge identity,
  custom catalogue provenance, empty strict packets and atomic rejection of errors.
  Input fixture bytes remained unchanged during commands; later formatting only
  normalizes fixture whitespace.
- [Sample standalone packet](review-packet-sample.json) contains one introduced
  finding while its successful CLI creation exits 0. Projection losses are explicit
  and side-scoped; no unrelated archive, origin, editor/Undo or rule-file path is
  included in the packet. Selected authored data and any camera are retained.
- Initial package tests failed on the missing public builder and command tests
  failed on the missing CLI path. Implemented paths passed. Exporter relocation
  was compared byte-for-byte with its previous implementation and is unchanged.
  Guard/Effect control flow was adjusted to repository lint rules without adding
  a suppression. Packet composition introduces no new semantic grammar.
- Architecture, delivery and test-quality reviews were self-review. Dependency
  direction remains CLI → optional Mermaid adapter → core. No dependency,
  existing graph/model/archive protocol change, publishing or deployment occurred.

## remaining uncertainty

Evidence is local, including real installed tarballs and executable transcripts.
No new hosted CI, browser UI, benchmark, registry or deployment qualification is
claimed. The separate review envelope is an export artifact, not a packet import
API or full-model backup. It uses the documented v1 builtin participant mapping;
custom role callbacks cannot travel in a data-only packet. Malformed canonical
models or semantically invalid catalogues throw at the existing core boundary.
Created packets can contain findings; creation does not certify model correctness.

## next

Recommendation: **needs review** for the local commit. Next bounded slice:
composable packet export controls in the workbench, with chosen baseline/target,
scope/loss preview and explicit consent to a JSON download through this builder.
