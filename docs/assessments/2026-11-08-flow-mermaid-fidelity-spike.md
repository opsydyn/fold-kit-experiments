# Mermaid fidelity qualification — 2026-11-08

- **result:** complete
- **claim:** The bounded spike qualifies restricted conversion and explicit identity/loss contracts; it does not endorse a general Mermaid import parser.
- **evidence:** Twelve authored fixtures, Node/Bun SDK and read-only driver tests, public packed-core editing/Undo, independent Chromium syntax checks and required workspace gates, detailed below.
- **remaining uncertainty:** Unqualified Mermaid grammar can contain further dropped semantics. No full rendering/layout fidelity, hostile-input performance, published consumer or hosted acceptance is established.
- **next:** Build an optional export-first Mermaid adapter with the explicit identity/loss contract; keep general import experimental until parser defects and grammar coverage are addressed.

## Decision and observed limits

Keep dependencies out of core. The private [experiment](../../experiments/mermaid-fidelity/README.md)
implements a small SDK and stdin/stdout driver against the packed public Flow API.
[ADR 0007](../adr/0007-isolate-mermaid-fidelity-qualification.md) records the boundary.
Qualification starts from core commit `1bfeeaf`; exact dependency/archive integrities
and corpus hash are captured in the runtime evidence files.

The official `@mermaid-js/parser` 2.0.1 rejects `flowchart` as an unknown diagram
type. Mermaid 12.3.0 public `parse` fails without browser globals on both Node
24.15.0 and Bun 1.4.4 with `DOMPurify.addHook` errors. The official parser's
[current dispatcher](https://github.com/mermaid-js/mermaid/blob/develop/packages/parser/src/parse.ts)
and the public [flowchart syntax](https://mermaid.js.org/syntax/flowchart.html)
were checked alongside the pinned runtime behavior. These are separate packages
and do not supply a qualified public headless flowchart AST interchangeably.

[`mermaid-ast` 0.8.2](https://github.com/neongreen/mermaid-ast) provides a usable
public DOM-free parse API for the bounded subset, with material defects:

- Named edge IDs include the `@` delimiter; the prototype normalizes it.
- Its own renderer drops named edge IDs; the prototype uses a separate emitter.
- Node `style` declarations disappear from its AST; statement-level detection
  records presentation loss, including semicolon-inline declarations.
- Valid leading comments reject in the parser. This is retained as a failed
  capability, with no source rewriting to disguise it.
- Group endpoint references appear as ordinary nodes as well as group IDs.
  Import rejects groups and boundary endpoints instead of producing a false graph.

These results support export-first product work. A handful of compatibility
patches would not establish general import fidelity. No parser adoption or new
production API is accepted by this spike.

## Evidence and acceptance

Host-executed evidence is stored alongside the runnable experiment:

| Evidence                                         | Observed result                                                                                                                                                                                                           |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fixtures/corpus.json`                           | 12 authored cases: 7 restricted conversions, 5 rejections                                                                                                                                                                 |
| `npm test`                                       | 21 passing tests: fixture expectations, edit/export/reimport/Undo, arbitrary IDs and unused ports, strict loss policy, stale maps, feature boundaries, candidate defects, import/export CLI parity and malformed requests |
| `npm run test:bun`                               | Same 21 tests passing on Bun                                                                                                                                                                                              |
| `evidence-node.json`, `evidence-bun.json`        | Matching conversion cases; pinned versions/integrities and separate runtime failure messages                                                                                                                              |
| `evidence-browser.json`                          | Chromium public Mermaid syntax validation: 11 valid original fixtures accepted, malformed source rejected, all 7 projections with edited labels and an empty graph accepted; no page errors or external requests          |
| Core `pack:check`                                | Passed; private project consumes the packed archive, not source aliases                                                                                                                                                   |
| `bun run test`, `bun typecheck`, `bun run check` | All three exited 0                                                                                                                                                                                                        |

Round trips preserve node labels and qualified outlines, node/edge IDs, endpoint
port IDs/kinds and unused port identities when the explicit map accompanies the
source. This is a projection: positions, dimensions, port geometry/presentation,
C4/DDD semantics and host data do not survive and are reported as losses. Source
alone uses safe aliases. Implicit edge identities depend on endpoint-pair
occurrence order; named IDs are required for stable topology edits.

The map contains no full graph and rejects mismatched topology. Unsupported
structure rejects with no value even in report mode. SDK and CLI default to
rejecting losses. No callbacks execute, no provider is contacted, and the driver
writes only stdout. Browser checks establish syntax, not visual equality or
accessibility. The existing C4 demo remains independently available on localhost.

## Recommended next slice

Create optional `@opsydyn/foldkit-flow-mermaid` with export, versioned diagnostics
and identity metadata, plus consumer tests. Provide a workbench export preview
that makes projection losses visible. Retain Flow JSON as the authoritative
format. Keep import behind an experimental boundary with a public support matrix
and a larger differential grammar corpus before promoting it. A standalone CLI
can follow the adapter; writable agent tools and edition storage remain separate.

Recommendation: **needs follow-up** for production integration; the bounded
qualification is complete. No PR, publication or deployment is part of this slice.

## Validation receipt

Host execution on 2026-11-08: core `pack:check`, standalone `npm test` (including
TypeScript compilation), `npm run test:bun`, both runtime qualification runners,
Chromium oracle, `bun run test`, `bun typecheck`, and `bun run check` exited 0.
Node and Bun conversion cases and dependency records match. Test totals are 21
per runtime; browser syntax checks cover 12 original inputs and 8 generated
inputs, including empty output. Root lint reports advisory warnings and no errors;
format and catalog checks pass. The source/evidence fingerprint is recorded in
`experiments/mermaid-fidelity/evidence-manifest.json`.

The first sandboxed workspace test attempt failed on npm cache writes and local
server binds. The authorized rerun with host access passed. No cache ownership or
system settings were changed. The evidence is a local qualification, maintained
by this implementation session; it is not independent review, CI or registry proof.
