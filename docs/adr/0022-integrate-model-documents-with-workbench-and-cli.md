# ADR 0022: Integrate model documents with the workbench and CLI

## Status

Accepted for the approved model-import and CLI validation slice, 2026-11-09.
Extends ADRs 0016 and 0021. Boundary review: **safe with noted risk**; adapters
must preserve identity and provenance or explicitly report projection loss.

## Decision

The core model-document codec remains the authority. Workbench import opens a
separate editable session, retaining the active and parked sessions. Duplicate
model IDs reject without overwrite or renaming. File reads are strictly UTF-8,
limited to one 5 MiB file, cancellable and bound to the initiating request,
editor revision, graph identity and session epoch. Graph identity also rejects
replacement graphs whose revision counter was reset. Permission is checked again on completion.
Switch/fork/import operations cannot overlap a pending model read.

The production workbench allocates a workspace namespace with crypto.randomUUID
inside a Command. A small Preparing/Ready/Failed Foldkit shell exposes the editor
only after allocation; retry is explicit. The existing editor is a lifted child
with its own message/view/subscription boundary. Test init remains deterministic.
Model IDs allocated in this workspace use that namespace, avoiding the old
fixed-root collision across browser sessions. Imported IDs remain unchanged. A new session widens its own zoom limits when
needed to preserve the imported camera; the source preferences remain intact.

CLI bounded input gains a tagged readDocument API. Validate accepts graph,
snapshot and model-document v1 inputs; old graph responses remain byte-compatible.
Model validation additionally reports identity, edition count and immediate origin
identifiers without modifying the input. The existing public readGraph helper
continues to reject model envelopes rather than silently discarding metadata.

Mermaid export projects only the current snapshot. Model identity, editions,
lineage and camera omission are explicit loss diagnostics, rejected by default.
--loss-policy report consents to reported losses, never structural errors.
Snapshot camera loss is reported too. The Mermaid library and bundle format are
unchanged; CLI-owned diagnostics extend its response, not the library vocabulary.
CLI protocol v1 remains compatible for existing inputs and adds metadata only for
new model-document validation. No parser, new runtime dependency or publication.

## Acceptance and scope

Qualify strict/invalid/future input, permission revocation, duplicate IDs, source
preservation, cancellation/stale reads, fresh Undo, import/export round trips and
real Node/Bun CLI processes. Reuse the existing bounded I/O and foldChild/
Subscription.lift mechanisms. Do not flatten metadata into node data, replace
models on collision or invent automatic identity migration. No autosave,
collaboration, model merging or npm publishing. Reviews are self-review.
