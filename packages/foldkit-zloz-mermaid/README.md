# Foldkit Zloz Mermaid

Optional, pure Mermaid flowchart export. No Mermaid parser, renderer, browser,
FoldKit or Effect dependency is installed. Requires the matching Zloz core peer.
Version 0.1.0 is a local release candidate; npm publication has not been performed.

After publication:

```sh
npm install @opsydyn/foldkit-zloz @opsydyn/foldkit-zloz-mermaid
```

In this checkout, use workspace links or the tarballs produced by `pack:check`.

```ts
import { exportMermaid } from '@opsydyn/foldkit-zloz-mermaid';

const result = exportMermaid(graph); // default: reject any conversion loss
if (result.status === 'rejected') {
  // Present result.diagnostics before requesting explicit loss consent.
}
const projection = exportMermaid(graph, { direction: 'LR', lossPolicy: 'report' });
if (projection.status === 'converted') {
  const bundle = projection.value;
  // Host owns persistence/download. Keep the complete bundle with its source.
  console.log(bundle.source, bundle.identity, bundle.diagnostics);
}
```

`exportMermaid` is synchronous, performs no I/O and does not mutate input. Invalid
graphs/options return structured rejection. A rejection never contains a partial
bundle. `report` permits losses, never errors. Every result and bundle carries
`protocol: 'foldkit-flow-mermaid/v1'`. Source is bounded at 32768 UTF-16 code units;
`mermaidSourceLimit` exposes that bound.

## Type contract

- `MermaidExportOptions`: optional direction (`LR | RL | TB | BT`) and loss policy
  (`reject | report`). Defaults: LR and reject.
- `MermaidExportResult`: discriminated `converted` with `value: MermaidBundle`,
  or `rejected` with diagnostics and no value. Both carry protocol and diagnostics.
- `MermaidBundle`: protocol, source, direction, identity and diagnostics. It is a
  JSON-compatible projection, not canonical Zloz JSON.
- `MermaidIdentity`: version 1 node aliases/original IDs/port IDs and kinds, plus
  named edge aliases/original IDs/endpoints. Optional `kind: 'group'` and `parentId`
  preserve group role and original Zloz parent IDs; flat v1 entries are unchanged.
  Contains no hidden full graph.
- `MermaidDiagnostic`: typed code, severity (`loss | error`), dimension
  (`syntax | semantics | identity | layout`), message and nullable subject ID.
- `MermaidDiagnosticCode`: invalid-graph, invalid-options, unsupported-subgraph,
  unsupported-label-encoding, source-limit, node-fields-omitted,
  edge-fields-omitted, port-details-omitted, group-presentation-omitted,
  layout-omitted, identity-map-required.

Keep the complete bundle: source uses deterministic aliases and explicit named
edges, so source alone cannot preserve arbitrary Zloz/port identities. Identity
metadata is versioned for future interoperability; this package does not yet
provide an importer, bundle decoder or a restore operation.

## Fidelity

Literal text/Unicode, rectangle/rounded-rectangle/cylinder outlines, directed
named edges, parallel edges, cycles and self-loops are supported. Labels are
quoted and special characters encoded as decimal entities. Icon-like `fa:` text,
empty labels, unsupported control characters and malformed Unicode labels reject. Non-empty groups export as nested named subgraphs. Empty groups reject rather
than disappearing or becoming invented nodes. Group outline presentation is a
reported loss; cross-boundary edges retain their ordinary child endpoints. Mermaid 12.3.0 is the independently qualified syntax target.

Layout/dimensions, port geometry/labels/order, architecture semantics, host data,
edge presentation and other authored fields are reported as omitted. Port IDs
and kinds remain in bundle metadata, not in Mermaid syntax. C4/DDD semantic
roles are not converted into equivalent Mermaid architecture notation. Treat
Zloz JSON as authoritative. The workbench exposes source preview, loss consent
scoped to the current revision and complete-bundle download.

## Verify locally

```sh
bun run --filter @opsydyn/foldkit-zloz-mermaid test
bun run --filter @opsydyn/foldkit-zloz-mermaid typecheck
bun run --filter @opsydyn/foldkit-zloz-mermaid pack:check
```

The packed-consumer test installs only the core and exporter into a temporary
npm project and checks TypeScript Bundler/NodeNext plus Node/Bun execution.
See [ADR 0008](https://github.com/opsydyn/fold-kit-experiments/blob/main/docs/adr/0008-export-mermaid-through-an-optional-package.md).
