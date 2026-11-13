# Foldkit Zloz Mermaid

Optional, pure Mermaid flowchart export. No Mermaid parser, renderer, browser,
Foldkit or Effect dependency is installed by the headless entry. Requires the
matching Zloz core peer. The published baseline is 0.3.0; the export controls below
are the next unreleased feature.

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

## Portable review packets

`createReviewPacket` composes the core edition audit and both Mermaid projections
without I/O, clocks, generated IDs or editor state:

```ts
import { createReviewPacket } from '@opsydyn/foldkit-zloz-mermaid';

const result = createReviewPacket(
  document,
  { baselineId: 'before', selectedId: 'after' }, // Omit selectedId for current graph.
  { direction: 'LR', lossPolicy: 'report', rules: conventions },
);
if (result.status === 'created') {
  const packet = result.value;
  // Host owns download/storage. Keep the complete JSON, not only the Mermaid source.
  console.log(JSON.stringify(packet));
} else {
  console.log(result.reason, result.diagnostics);
}
```

A packet has `format: 'foldkit-zloz-review'`, `version: 1` and
`scope: 'selected-snapshots'`. Its public `ZlozReviewPacket` contract contains:

- `model`: model ID and name.
- `baseline` and `selected`: explicit source references and complete detached
  canonical snapshots, including authored graph data and any camera.
- `conventions`: builtin/custom provenance, the complete rule catalogue and
  `roleInterpretation: 'zloz-event-storming/v1'`. It contains no file paths or
  executable callbacks; exported rules reproduce the audit independently of
  future default catalogues. Rules replace defaults when supplied.
- `comparison`: both audits, introduced/resolved/persisting findings and counts.
- `projectionOptions`, `projections.baseline` and `projections.selected`: chosen
  direction/loss policy and full Mermaid bundles with original-ID metadata.
- `diagnostics`: conversion losses/errors scoped to `baseline`, `selected` or
  `packet`. Semantic findings remain in `comparison`.

Only the chosen snapshots travel. Unrelated editions, origin/lineage, working
editor/Undo and host file paths are outside the packet. This export preserves
chosen authored data; it is not a backup of the entire model or a packet import
API. Save the full JSON to retain semantic metadata omitted from Mermaid.

Projection losses **reject by default**, even when canonical data is retained
elsewhere in the packet. `report` explicitly consents to Mermaid omissions on
both sides; it never permits errors. Camera omission is reported per side. Either
side failing rejects the whole export with no partial packet. The existing label,
source-size, nested-subgraph, alias and identity contracts apply unchanged.

A created packet can contain newly introduced audit findings: successful artifact
creation does not mean a compatible model. Selector/options failures return
`{ status: 'rejected', reason: 'input', diagnostics }`; conversion failures use
`reason: 'projection'`. Malformed canonical models or semantically invalid rule
catalogues throw the existing core validation error. Core remains the authority
for rules and model validation. Unknown option/rule fields and callback-based
interpretation reject; use core directly for nonportable `roleOf` customization.

The package additionally exports `ZlozReviewPacketOptions`,
`ZlozReviewPacketDiagnostic`, `ZlozReviewSnapshot` and `ZlozReviewPacketResult`.
Packet JSON round-trip tests reproduce its audit using only the chosen snapshots
and exported rules. The optional adapter still installs no Effect, Foldkit,
Mermaid parser, browser or layout engine. See [ADR 0035](../../docs/adr/0035-export-portable-review-packets.md).

## Strict review-packet reopening (unreleased)

```ts
import { parseReviewPacket } from '@opsydyn/foldkit-zloz-mermaid';

const result = parseReviewPacket(fileText);
if (result.status === 'parsed') {
  // Owned, deeply frozen read-only data. No editor/model import is performed.
  console.log(result.value.comparison.summary, result.value.diagnostics);
} else {
  console.log(result.code, result.reason, result.path);
}
```

`ZlozReviewPacketParseResult` distinguishes `parsed` and `rejected`. Rejection codes
are `invalid-json`, `limit-exceeded`, `unsupported-format`, `unsupported-version`,
`invalid-packet` and `inconsistent-packet`; `path` is a JSON Pointer (empty for root).
Invalid configured limits throw the existing core configuration error.

The decoder accepts exact `foldkit-zloz-review` v1 packets in selected-snapshots
scope. It validates snapshots/identities and data-only conventions, then recomputes
all audits, deltas, diagnostics, Mermaid sources and identity/fidelity projections
through the existing creator. The full wire representation must agree, with object
key order ignored and array order retained. Unknown fields, duplicate JSON keys
(including escaped aliases), non-finite numbers, conflicting edition identities,
invalid rules, stale findings and forged projections reject. Returned data is the
recomputed packet, never trusted cached projections. Current, distinct-edition and
same-edition comparisons are supported. Builtin v1 conventions must match the
builtin catalogue; custom catalogues retain their explicit validated rule data.

Optional limits are `maxCharacters` (default 2,000,000 UTF-16 code units, cap
16,000,000), `maxDepth` (64, cap 128), and `maxValues` (100,000, cap 1,000,000).
All must be positive safe integers. Nesting/duplicate keys are scanned before
JSON.parse; value traversal and freezing avoid spread-based argument limits.
These are input-shape budgets, not a wall-clock or peak-memory guarantee. Hosts
own file-byte limits, decoding and worker isolation when needed.

Reopening validates **self-consistency, not authenticity**. A coherently rewritten
packet can still be valid. Parsing does not execute Mermaid or confer model import,
editing, graph mutation or trust in an author's identity. The decoder performs
no IO; the reader below and Effect CLI compose it at their host boundaries. See
[ADR 0057](../../docs/adr/0057-decode-portable-review-packets-strictly.md) and
[decoder qualification](evidence/review-packet-parse.md). PNG and Alchemy remain deferred.

## Composable review-packet controls (unreleased)

The root entry exports `resolveReviewPacketControls` and
`resolveReviewPacketRequest`. The optional `/foldkit` entry exports
`zlozReviewPacketControls`, `zlozReviewPacketConsent`, `zlozReviewPacketDownload`
and their view/parts types. Install matching `foldkit` to use the native controls;
it remains an optional peer and is not installed for headless consumers.

```ts
import {
  resolveReviewPacketControls,
  resolveReviewPacketRequest,
} from '@opsydyn/foldkit-zloz-mermaid';
import { zlozReviewPacketControls } from '@opsydyn/foldkit-zloz-mermaid/foldkit';

const selection = { baselineId: 'before', selectedId: null }; // null = current
const state = { consentKey: null }; // host-owned, ephemeral Foldkit model state
const context = resolveReviewPacketControls(document, selection, state, {
  blockedReason: null, // supply live host protection; direction and data-only rules are optional
});
const controls = zlozReviewPacketControls(
  h,
  context,
  (request) => Message.ObservedReviewPacketInput({ request }),
  {
    showCounts: !minimalMode && diagnosticsEnabled,
    renderStatus: () => (minimalMode || !diagnosticsEnabled ? null : undefined),
  },
);
// In update: rebuild with the current document, selection, state and options.
const decision = resolveReviewPacketRequest(document, selection, state, request);
// ready: retain decision.state; blocked: show decision.reason;
// download: pass decision.packet to a host Command, never perform I/O in update.
```

Preview materializes report-mode projections in memory. Scope text discloses that
both full authored snapshots and cameras travel; only Mermaid omissions need
loss consent. Projection errors always block download. Consent and requests use
an opaque, exact-content key; a fresh resolution catches changes to chosen sources,
model identity/name, graph/camera, conventions and projection direction. The key
contains packet data: keep it ephemeral, do not log it, put it in DOM attributes or
use it as an authentication credential. Hosts also check session identity/epoch
and current protection before acting; they own storage/download and any playback
pause. Unrelated history changes do not alter a selected-snapshot packet.

Every part has a nullable/custom renderer, with independent attributes, labels,
layout and count visibility. Custom diagnostics own list-item semantics. Native
checkbox/button helpers retain disabled state and accessible protection reasons.
Hiding a part never bypasses the pure request resolver. Counts can disappear in
minimal mode while functional scope, losses and reasons remain available. No
packet import, graph mutation or new Undo entry is implied. Exact serialization
costs packet-sized memory and projection work while previewing; no performance
claim is made. See [ADR 0037](../../docs/adr/0037-compose-review-packet-export-controls.md).

## Read-only packet reader (unreleased)

```ts
import {
  createReviewReader,
  resolveReviewReader,
  updateReviewReader,
} from '@opsydyn/foldkit-zloz-mermaid';

let reader = createReviewReader('model-id/incarnation-1');
const started = updateReviewReader(reader, {
  scope: reader.scope,
  type: 'ReadRequested',
  file: { name: file.name, byteLength: file.size },
});
reader = started.state;
const readDescriptor = started.read;
// Continue only when readDescriptor exists.
// A host Command reads the File within maxBytes,
// checking actual bytes and decoding fatal UTF-8. Return its correlated fact:
if (readDescriptor) {
  reader = updateReviewReader(reader, {
    scope: readDescriptor.scope,
    type: 'ReadSucceeded',
    run: readDescriptor.run,
    text: fileText,
  }).state;
}
const snapshot = resolveReviewReader(reader).snapshot;
// Render snapshot in a detached read-only editor. Do not replace the working model.
```

`updateReviewReader` returns `{ state, read }`. Its requests include correlated
read success/failure/cancel, `SideSelected` and `ReviewClosed`. `blockedReason` and
`selectionReason` are live policies; opening is checked again at completion.
`reviewReaderForScope` resets the reader when the host model incarnation changes.
Use unique scopes: stale callbacks must never collide with a new model session.
Default `maxBytes` is 1 MiB (configurable integer 1–16,000,000); the host must enforce
actual bytes before and after IO. `parseOptions` independently bounds decoding.
No file IO occurs in the package. Cancellation prevents publication; it need not
abort underlying IO. Invalid/stale/protected/cancelled reads preserve the last
good review and chosen side. Closing invalidates pending reads.

The optional `@opsydyn/foldkit-zloz-mermaid/foldkit` export `zlozReviewReader`
accepts the HtmlBuilder, state, request callback, file callback, live policy and
view options. It renders native opening/cancel/close and baseline/selected controls,
audit findings and projection losses. `renderSummary`, `renderFinding` and
`renderLayout` compose custom presentations; undefined falls back, null omits.
`showCounts: false` and `instructions: false` provide a clean UI while findings
and actions remain available. Hosts own detached canvas rendering and interaction
protection. Reading grants no editing/import permission, authenticity guarantee or
new loss consent. See [ADR 0059](../../docs/adr/0059-open-review-packets-with-detached-reader-controls.md)
and [local qualification](../../apps/zloz-demo/evidence/review-reader.md).
