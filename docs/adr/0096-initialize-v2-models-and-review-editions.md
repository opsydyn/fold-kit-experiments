# ADR 0096: Initialize v2 models and review editions independently

## Status

Accepted for the approved headless model/review slice, 2026-11-14. Follows
[ADR 0095](0095-stage-canonical-v2-model-and-edition-documents.md).
Architecture, delivery and test-quality review are self-review.

## Decision

Add `createModelEditorV2(document, options)`. Validate/detach the complete canonical
v2 model, including editions and pinned origin, then initialize from its current
snapshot through `createEditorFromConnectionDocument`. The current snapshot owns
connection mode. Preferences may override camera, read-only and history limits;
undefined camera inherits the snapshot camera. Preferences cannot supply a mode,
working graph, Undo/Redo, revision or transient state. Each initialization starts a
fresh detached session; no model identity or checkpoint is rewritten.

Add `createHistoryReviewV2(edition, present)` with a `ZlozHistoryReviewV2` containing
an immutable detached `edition` pin, its `editionId` and a fresh read-only editor.
The selected checkpoint owns graph and connection mode even when the working
editor uses the opposite mode. Use its camera when authored, otherwise a detached
copy of the working camera. Only the working zoom limits, fit padding and a copied
surface size are inherited. Do not inherit selection, pending connection, gestures,
clipboard, routes, revision, Undo/Redo or other transient working state.

The review editor has literal `readOnly: true` in the public type and zero Undo
capacity. `updateHistoryReviewV2` reuses the existing fail-closed history-navigation
whitelist and the core reducer. Selection uses current policies; camera, focus,
fit and surface measurement remain separate session navigation. Authored edits,
node measurement, connection creation/reconnection and Undo/Redo do not enter the
reducer. New editor events are not implicitly authorized. The original pin remains
unchanged as navigation proceeds; accepted updates retain read-only state.

## Boundaries and consequences

Boundary verdict: **safe with noted risk**. Core retains model validation,
checkpoint ownership and editor behavior. The v2 adapter composes those mechanisms;
it adds no second reducer, browser state, resource or dependency. Reusing a mutable
working editor or changing its mode to rewind was rejected because it would mix
histories and reinterpret checkpoint edges. Using the v1 initializer was rejected
because its strict-format boundary deliberately refuses v2 snapshots.

A camera outside the inherited zoom range rejects rather than being clamped or
rewritten. A camera-less checkpoint stays camera-less in its immutable pin even
when the review uses a working-camera fallback. Read-only navigation never restores
or applies the checkpoint. Callers own the choice of edition; no implicit lookup,
parent traversal, remote access, current consent or edit authority is introduced.
Retain the complete review returned by this API and route review events through
its adapter. EditorState is a trusted runtime value, not a wire format or a
security capability; do not decode or mutate it as a substitute for these APIs.
Independent native view scopes still require distinct view IDs.

V1 initialization/review and all wire formats remain unchanged. V2 fork, append,
comparison/ghosts, restore/playback, CLI, other adapters and workbench wiring remain
separate adoption boundaries. No mode-changing event, publication, version bump
or deployment is added. C1 and broader C/Q/R gates remain partial.

## Evidence and next

[Qualification](../../packages/foldkit-zloz/evidence/model-workflow-v2.md) records
public behavior tests for strict/loose initialization and every working/checkpoint
mode combination, actual installed consumers, the navigation-whitelist regression
and repository verification. This headless slice adds no visual/device/AT claim.

Next: v2 edition forking with pinned source provenance and a fresh target session,
retaining the selected checkpoint mode before cross-mode restore/playback adoption.
