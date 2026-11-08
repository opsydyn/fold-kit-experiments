# ADR 0008: Export Mermaid through an optional package

## Status

Accepted for local implementation on 2026-11-08 following approval of the
export-first recommendation in the Mermaid fidelity report. No registry
publication or general import API is authorized. Follows ADRs 0003 and 0007.

## Context and decision

The isolated spike preserves declared identities within a restricted subset but
finds parser defects that prevent general import qualification. A useful next
slice is a pure, optional `@opsydyn/foldkit-flow-mermaid` exporter with no runtime
dependency except its matching public Flow core peer. Do not promote the spike's
parser or import code. Package consumers may use Node, Bun or a browser.

Export literal flowcharts with explicit named edges, safe deterministic aliases,
quoted/encoded labels, directions LR/RL/TB/BT, and the three existing built-in
outlines. Reject groups/membership rather than flattening them. Validate input
with public core; normalize failure into typed, versioned diagnostics. Bound
source output at 32768 UTF-16 code units. Reject empty labels, unsupported control characters, invalid Unicode or icon-like
labels whose literal meaning is not qualified. Callers own execution and I/O.

`exportMermaid(graph, options)` returns a converted bundle or rejection with no
partial value. Loss policy defaults to `reject`; `report` explicitly permits
losses, never errors. The version 1 bundle includes source, direction, diagnostics
and an identity map containing node/edge/port IDs, port kinds and endpoints only.
It does not hide a full graph. Layout, port presentation, architecture semantics,
host data and edge presentation are reported as omitted. Original Flow JSON is
the authoritative document. Import stays in the private qualification experiment.

The Astro workbench derives an opt-in source preview from current graph state,
shows semantic losses regardless of canvas measurement diagnostics, and exposes
an explicit loss consent control before downloading the bundle. Opening the
preview or exporting does not edit the graph, revision or Undo history. All
browser download side effects remain FoldKit Commands. The package has no DOM,
Astro, FoldKit, Effect or Mermaid dependency.

## Alternatives and consequences

- A full import/export adapter now would promote an unqualified parser.
- Adding export to core would couple all consumers to an optional format.
- Source-only download would discard the port/identity contract and loss record.
- Rendering Mermaid in the app would add an unnecessary runtime dependency for
  this source-preview slice; syntax is checked independently in Chromium.

The separate package costs another versioned API and npm artifact. The pure
emitter stays small, and consumers can later compose a CLI without new core
behavior. General grammar, C4/DDD projection, group support, CLI/agent writes,
edition storage and publication are deferred. Review the import boundary when
parser defects and a differential grammar corpus have been qualified.

Boundary review: **safe with noted risk**. Flow owns graph validation and identity;
the adapter owns a declared lossy projection; the host owns download and consent.
The qualified grammar is limited. Compatibility evidence must remain separate
from a general Mermaid fidelity claim.

## Implementation and verification

- Add `packages/foldkit-flow-mermaid` following existing optional package ESM,
  declaration, licence and packed-consumer standards. Use matching core peer.
- Add meaningful tests before emitter implementation: exact source/encoding,
  aliases and named parallel edges, outline/direction mapping, strict losses,
  groups, malformed graph, invalid labels, limits, empty graph and immutability.
- Add clean npm consumer checks for TypeScript Bundler/NodeNext and Node/Bun;
  verify that framework/parser dependencies are absent.
- Integrate model/messages/view/Command in `apps/flow-sample` with live preview,
  visible rejection/losses, loss consent, bundle download and close control.
- Exercise the browser journey, download and graph/Undo invariance; independently
  validate generated syntax with the pinned Mermaid browser oracle and capture
  light/dark screenshots. Refresh the localhost demo after the build.
- Run package checks, all workspace tests, typechecking and lint/format. Record
  self-review/evidence and commit the slice. Publication remains a later gate.

Recovery before publication is reverting the new package and host integration;
no persisted Flow schema or existing user document is migrated.
