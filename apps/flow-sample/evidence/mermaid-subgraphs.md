# Nested Mermaid subgraph export

- **result:** complete
- **claim:** The optional exporter preserves non-empty nested group structure, original identities and ordinary child endpoints; a separate nested C4 workbench example demonstrates it.
- **evidence:** Four hierarchy regressions, extended packed Node/Bun consumer, updated workbench tests, Chromium syntax and real SVG containment checks, themed screenshots and workspace gates.
- **remaining uncertainty:** Empty groups reject. Mermaid chooses layout; group appearance, architecture meaning, constraints and host data remain explicit losses. Import, publication and general rendering equivalence are not qualified.
- **next:** Implement the approved left-sidebar workbench redesign with independently scrolling controls and a persistent visible canvas.

The version 1 identity map adds optional `kind: 'group'` and original Flow
`parentId` fields. Flat entries and protocol remain unchanged. The emitter walks
validated hierarchy iteratively, preserves stable sibling order even when
children precede parents in input, and emits named edges after all declarations.
Core rejects invalid parents/cycles/group endpoints. Empty boundaries are not
flattened or replaced with fake nodes. Explicit group appearance has its own loss
code. See [ADR 0009](../../../docs/adr/0009-preserve-mermaid-subgraph-hierarchy.md).

**Open nested C4 container view** adds a persistence boundary inside the platform
boundary; existing C4 examples are unchanged. The preview starts strict, consents
per document, downloads the complete bundle and does not edit graph or Undo.

The host-run browser evidence in `mermaid-subgraphs-browser.json` checks eight
valid generated sources, including escaped group titles, and explicit empty-label
and empty-group rejections. It also invokes pinned Mermaid 12.3.0's public render
API: two real SVG cluster rectangles have positive dimensions and the inner one
is fully contained by the outer. This is stronger than syntax acceptance alone;
it is not a claim of identical Flow/Mermaid layout. No external requests or page
errors were observed. [Light](./mermaid-subgraphs-light.png) and
[dark](./mermaid-subgraphs-dark.png) screenshots capture the workbench preview.

Commands: `bun run test` passes (exporter: 12 tests; sample: 12), including the
extended clean npm consumer in Node/Bun and TypeScript Bundler/NodeNext.
`bun typecheck` and `bun run check` also exit 0. Production sample build and the browser journey pass.
An initial formatting-only failure in the new browser harness was corrected.
Self-review covered hierarchy/metadata compatibility, deep traversal, rejection
paths, package isolation and artifact scope. This is local, agent-maintained
qualification; CI, independent review and registry publication are separate.

Reproduce after installing the private spike's oracle dependencies:

```sh
bun run --filter @opsydyn/flow-sample build
node apps/flow-sample/evidence/mermaid-subgraphs-browser.mjs
```

Recommendation: **needs follow-up** for the authorized workbench layout slice.
