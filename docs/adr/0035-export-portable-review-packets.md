# ADR 0035: Export portable architecture review packets

## Status

Accepted for the approved package and Effect CLI slice, 2026-11-09.
Boundary review: **safe with noted risk**. A review packet preserves selected
authored snapshots; its Mermaid views remain explicitly lossy projections.

## Decision

`createReviewPacket` belongs to the existing optional Mermaid package, which
already depends on core. Core must not depend on the adapter. Move the unchanged
exporter implementation into a leaf module and retain its public exports through
the package index, avoiding a circular import when the packet builder composes it.
There is no new workspace, dependency or runtime activation.

The pure builder takes a model, an explicit owned baseline ID, an optional owned
target edition ID (otherwise current graph), direction, loss policy and optional
data-only replacement rules. Existing core capture validates and detaches the
model; existing comparison/audit functions own semantic policy. Invalid canonical
model or rule data throws at the existing core boundary. Selector/options failures
return input rejection; projection failures return projection rejection. Missing
selectors never fall back. Same-edition comparisons are valid.

A created packet is `{ format: 'foldkit-zloz-review', version: 1 }`, scoped to
`selected-snapshots`. It includes model ID/name, both source references and full
snapshots, a complete detached convention catalogue with builtin/custom provenance
and `zloz-event-storming/v1` role interpretation, full audit comparison, explicit
projection options, both Mermaid bundles/identity maps and side-scoped conversion
diagnostics. Current snapshots include their camera if present. Only the selected
snapshots travel: no unrelated edition archive, origin, clock, generated identity,
editor state, Undo or host file path. Authored data within chosen graphs is retained.

Packet interpretation uses the standard core participant mapping. Callback-based
role interpretation and unknown option/rule fields reject instead of silently
changing portable meaning. Rule contents travel with the packet so consumers do
not depend on a path or future builtin catalogue. Their semantic validation stays
with core; the adapter only checks that configuration is data-shaped.

Mermaid projection losses reject by default. Explicit `report` consents to losses,
never errors, on both sides atomically. Camera omission is recorded per side even
though the packet preserves the camera. No partial packet is emitted when either
projection fails. Nested subgraphs, aliases, identity, label/source limits and
other loss behavior reuse the qualified exporter. Existing graph/model/archive
and Mermaid protocols retain compatibility; this is a separate export envelope.

The Effect CLI adds `review packet --baseline <id> [--edition <id>]` with existing
bounded input, `--rules`, `--direction` and `--loss-policy` flags. Created responses
use operation review-packet, status created, scope selected-snapshots and data.
Top-level diagnostics concern projections; semantic findings remain in the full
packet comparison. Exit 0 means the artifact was created, including packets with
introduced findings. Use relationships compare for regression gating. Projection
rejection exits 1; input/configuration/selector rejection exits 2. The command
outputs one JSON response and newline, reads no executable modules and rewrites
no files. Existing commands retain their contracts.

## Alternatives and consequences

A new review workspace would add distribution and coordination without a new
dependency boundary. Putting Mermaid in core would invert ownership. A packet
containing only diagrams/findings or file paths could not reproduce its audit.
Copying every model edition would enlarge sharing scope unnecessarily. Storing
callbacks or relying on unspecified future defaults would weaken portability.
Treating introduced findings as artifact-creation failure would conflate review
export and regression gating. There is no packet import, writable agent action,
workbench UI, publication or deployment in this slice.

## Implementation and verification

- Adapter: exporter leaf, packet builder/public types and invariant tests.
- CLI: Effect command, additive protocol/error, shared model-input projection.
- Qualify Node/Bun real packed consumers and Bundler/NodeNext public types.
- Tests cover explicit/current/same selectors, detached JSON round trip and audit
  reproduction, custom convention data, no input mutation, scoped losses/errors,
  strict/report behavior, rejected callbacks and 0/1/2 JSON contracts.
- Capture an executable transcript plus sample packet, then run root check,
  typecheck, workspace tests and API docs. No browser evidence is required for a
  package/CLI-only slice. Architecture/delivery/test-quality reviews are self-review.
