# Foldkit Zloz Mermaid

Optional, pure Mermaid flowchart export. No Mermaid parser, renderer, browser,
Foldkit or Effect dependency is installed by the headless entry. Requires the
matching Zloz core peer. Export controls, native v3 projections and portable review
packets are included in the linked 0.6.0 release.

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

<a id="strict-review-packet-reopening-unreleased"></a>

## Strict review-packet reopening

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

<a id="composable-review-packet-controls-unreleased"></a>

## Composable review-packet controls

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

<a id="read-only-packet-reader-unreleased"></a>

## Read-only packet reader

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

## Explicit v2 connection documents

```ts
import { exportConnectionMermaid } from '@opsydyn/foldkit-zloz-mermaid';
const result = exportConnectionMermaid(documentV2, { lossPolicy: 'report' });
// Converted bundles use foldkit-zloz-mermaid/v2 and retain connectionMode.
```

This entry validates the complete v2 connection document and preserves ordered
source/target identity even for input-to-input or output-to-output links. Mermaid
source cannot express loose future-connection rules or the camera; those losses
reject by default. `report` accepts projection omissions, never invalid graphs.
Keep canonical JSON as authority. No general import or model reconstruction is
promised. The existing `exportMermaid(graph)` remains strict and its protocol and
output are unchanged. V1 review packets/readers remain v1; they do not accept v2
bundles or silently remove checkpoint modes.

## Native v2 review packets

```ts
const result = createReviewPacketV2(
  modelV2,
  { baselineId: 'baseline' },
  {
    lossPolicy: 'report',
  },
);
if (result.status === 'created') {
  const text = JSON.stringify(result.value);
  const opened = openReviewPacketV2(text, 'selected', workingEditor);
  // opened.review.editor is independent and read-only when status is 'opened'.
}
```

Version-2 packets retain baseline/selected connection documents, modes, data-only
conventions, mode-aware audit comparisons and v2 Mermaid projections. The scope is
selected snapshots, not a whole-model/ancestry archive. Role interpretation stays
`zloz-event-storming/v1` because domain rules are independent from port kinds.

`parseReviewPacketV2` shares strict bounded scanning and deterministic recomputation
with the v1 decoder. Conflicting side identities, duplicate fields, altered modes,
forged projections/audits or unknown fields reject. V1 readers stay fixed at v1.
Creation checks default reopening budgets (2,000,000 characters, depth 64, 100,000
JSON values) and reports `packet-limit` before claiming portable success.

`openReviewPacketV2` revalidates text before initializing either side in its saved
mode with zero Undo, leaving the working editor/history untouched. Packets and
recorded findings never authorize editing, import or Apply. Native workbench file
controls remain a separate adoption slice.

<a id="native-v3-groups-and-loss-review-unreleased"></a>

## Native v3 groups and loss review

```ts
import {
  exportGroupMermaidV3,
  createGroupMermaidReviewV3,
  resolveGroupMermaidReviewV3,
  updateGroupMermaidReviewV3,
} from '@opsydyn/foldkit-zloz-mermaid';

const projection = exportGroupMermaidV3(documentV3, { lossPolicy: 'report' });
const context = { scope: 'working:mermaid', sourceRevision: editor.revision, document: documentV3 };
const state = createGroupMermaidReviewV3(context.scope);
const controls = resolveGroupMermaidReviewV3(state, context);
// Emit native review facts from controls; consume only a returned download payload in host IO.
```

The distinct `foldkit-zloz-mermaid/v3` bundle validates the complete native source
and retains world convention, connection mode, group-port capability and native
identity (`nodeId`, `edgeId`, original parent and scoped endpoint IDs/kinds).
Source uses safe aliases, named edges and nested nonempty subgraphs. A group edge
links its boundary alias: actual socket artwork, anchor positions and attachment
are **explicit losses**, not implied fidelity. Layout, camera, future mode/capability
rules and omitted semantic/data fields retain their findings. No full graph is
hidden in identity. Canonical JSON remains authoritative; no production import or
round trip is promised. Existing graph/v2 exports, protocols and readers stay fixed.

Losses reject by default. `report` creates a review candidate, never an IO grant.
Errors (invalid documents/options/labels, empty groups and generated source over
32768 UTF-16 code units) cannot be accepted. Native scalar options reject accessors
and unknown fields; returned native bundle/identity records are frozen.

`resolveGroupMermaidReviewV3` binds acceptance to the full document, scope/revision,
direction, file name and exact output/findings. `updateGroupMermaidReviewV3` accepts
`MermaidDirectionChanged`, `MermaidLossAcceptanceChanged`, `MermaidDownloadRequested`
and `MermaidDownloadSettled` facts carrying its identity. It reruns `canDownload`
against the current document and candidate, checks consent and emits a detached
`ZlozGroupMermaidDownloadV3` only when allowed. Consume its exact `text` in a host
Command; never render again to download. Pending runs prevent duplicate requests,
failure permits retry and stale completions do not overwrite current feedback.
`groupMermaidReviewForScopeV3` resets authority for working/edition scope changes
while retaining direction preference. Review state is trusted transient Model data,
not a credential or portable session codec. A download already dispatched cannot
be retroactively revoked. Graph, revision and Undo remain unchanged by export.

Optional `/foldkit` `zlozGroupMermaidReviewV3(h, controls, onRequest, { id })`
provides a direction selector, safe highlighted source, all findings, consent and
download. Minimal/global diagnostics hide optional status, preserving functional
findings and denial reasons. `renderPart`, `renderFinding` and `renderLayout` use
undefined for native defaults and null to omit; replacements own their semantics
and explanations. Compose `zlozGroupMermaidConsentV3` /
`zlozGroupMermaidDownloadV3` independently or use headless APIs for a fully custom
surface. Scoped `theme` uses core's shared public Foldkit theme mapper.

No Mermaid parser/renderer, DOM, Astro, Foldkit or Effect dependency enters the
headless root. Local browser oracle evidence is version-specific and separate from
human AT/device, hosted deployment, broad performance and registry acceptance.
The private CLI's current Mermaid export remains v1/v2; compatibility inspection
only reports native package availability. Native packets/receipts/patches/audits
remain separate adoption work.

<a id="native-v3-review-packets-unreleased"></a>

### Native v3 review packets

`createReviewPacketV3(model, { baselineId, selectedId? }, options)` combines the
chosen complete native checkpoints, capability/mode-aware audit comparison and
native Mermaid projections. `lossPolicy: 'report'` produces visible findings;
hosts must obtain explicit acceptance before exposing a download. Group-port
artwork and exact attachment remain reported Mermaid projection losses.

`parseReviewPacketV3(text)` strictly bounds text and recomputes audits and both
projections. `openReviewPacketV3(text, 'baseline' | 'selected', sessionId)` creates
an independent read-only v3 review with empty Undo history. Imported packets
never grant edit authority. Existing packet decoders remain version-fixed.
