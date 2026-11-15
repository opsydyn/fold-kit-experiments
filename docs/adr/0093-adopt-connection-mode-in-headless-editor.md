# ADR 0093: Adopt connection mode in the headless editor

## Status

Accepted for the approved package-owned editor slice, 2026-11-14. Extends
[ADR 0092](0092-stage-explicit-v2-connection-documents.md); its historical evidence
continues to describe the preceding standalone-document slice.

## Context and decision

Standalone v2 documents retain strict/loose intent, but a mode flag on an editor
option alone would detach that intent from the authored source. Add
`createEditorFromConnectionDocument(document, options)` instead. Revalidate the
explicit v2 envelope and all graph data, detach the graph, retain its mode and use
its camera unless options override it. Legacy `createEditor(graph, options)` stays
strict. Unknown or absent document modes reject; no mode inference or port rewrite.

`EditorState.connectionMode` is fixed for a session; omission in older
host-constructed states means strict. No runtime mode-changing event is introduced.
All editor-owned graph validation/copying uses this mode, including movement,
clipboard and ordinary metadata edits, so accepted loose edges remain editable.
Existing v1 public graph validators/codecs retain their strict contract. Mode-aware
copying is internal and does not add a public bypass option to v1 APIs.

Creation and reconnection use the shared kind matrix and the existing live
validation order. Creation checks source port, target port, ordered duplicate and
whole-edge policy. Reconnection checks the existing edge/end lock, changed port,
ordered duplicate excluding the replaced edge, and whole-edge policy with the
replacement-free graph. The unchanged endpoint remains structurally checked; it
does not acquire a new port policy check. No chooser result grants permission:
commit reevaluates current graph/ports and supplied current policies. Missing
endpoints, duplicate IDs and malformed authored data still reject. Read-only and
active-gesture commit guards remain in force.

Headless creation/reconnection contexts enumerate both input/output kinds in loose
sessions, retain visible/all scope and protection reasons, and keep strict context
behavior. `PortActivated.end` optionally carries explicit source/target chooser
intent so restaging a loose source does not accidentally create an edge. Without
this field, loose activation stages the first port and connects the next; strict
activation retains its output-source/input-target behavior. Pointer reducer intents
use the same mode and recheck policies on release. This does not qualify native
browser input, hit testing, rendering, accessibility or workbench UX.

Each accepted creation/reconnection uses the existing graph transaction: one
revision advance, one prior graph, cleared redo/routes and detached authored
creation data. Same-endpoint reconnection is a no-op. Rejections add no graph
history. Undo/Redo restore graphs within the same immutable session mode; their
revision token continues forward. History entries need no separate mode because
there is no supported mode change in the session. `historyLimit: 0` still disables
Undo storage. A fresh initializer creates a fresh history boundary.

## Persistence and boundary review

Save using `captureConnectionDocument(editor)` and `serializeConnectionDocument`;
they retain the session mode, graph and camera while excluding session history.
Use explicit downgrade planning before producing v1 data. Manually extracting a
graph or passing a structurally compatible editor to a legacy snapshot serializer
cannot preserve loose intent, even when its current edges fit strict rules.

Boundary verdict: **safe with noted risk**. Core owns the mode and transactions;
headless contexts propose events and policy remains live at commit. Structural
TypeScript records are not tamper-proof capabilities. Retain the complete editor
returned by the reducer, do not mutate its mode or mix graphs/history from other
sessions, and do not treat a cached event as permission. No new dependency or
cross-package adapter ownership is introduced.

## Alternatives and consequences

An `EditorOptions.connectionMode` override was rejected because it could contradict
persisted source intent. Changing the existing v1 initializer or codecs to accept
loose data would silently weaken legacy contracts. A new parallel editor reducer
would duplicate policies and history logic. Session mode plus an explicit v2
initializer keeps one reducer and existing strict defaults, at the cost of auditing
all editor-owned validation/copy paths and documenting portable boundaries.

Model/edition/archive, patch/receipt, layout, Mermaid/CLI and native/workbench
adoption remain separate. This does not complete C1, C2–C4, qualification or release
gates. No version bump, npm publishing, deployment or mode migration is performed.

## Evidence and next step

See [headless editor qualification](../../packages/foldkit-zloz/evidence/connection-editor.md)
for public behavior tests, installed consumer checks and repository checks.
Architecture, delivery and test-quality review are self-review.

Next: qualify native/custom port interactions and the workbench under explicit
strict/loose mode, including accessible source/target intent and composable
protection feedback, before portable adapter adoption.
