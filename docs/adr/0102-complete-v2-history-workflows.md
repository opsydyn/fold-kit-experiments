# ADR 0102: Complete v2 history workflows as one batch

## Status

Accepted for the approved v2 history/workflow completion batch, 2026-11-15.
Follows [ADR 0101](0101-append-v2-editions-with-explicit-identity-conflicts.md).
Architecture, delivery and test-quality reviews are self-review.

## Scope and completion criteria

Deliver atomic v2 merge, guarded graph-and-mode restore with one Undo, pinned
mixed-mode playback, mounted sidebar workbench adoption and explicit compatibility
qualification together. Completion requires a mixed-mode archive to be merged,
reviewed with ghosts/change navigation, played/rewound, restored and undone without
losing checkpoint modes or changing independent working/review histories. Keep
npm publishing and broader portable-adapter/C2–C4/Q/R work outside this batch.

## Mode-aware history contract

`createModelEditorV2` opts into transient `connectionHistory` full frames containing
`graph` and explicit `connectionMode`. These frames own v2 Undo/Redo; the existing
`past`/`future` graph arrays remain synchronized compatibility projections for
native controls and existing callers. Consumers must not independently patch
those projections. Legacy `createEditor`, v1 model sessions and standalone
`createEditorFromConnectionDocument` retain fixed-mode graph-only history.

Shared internal bookkeeping synchronizes commits, gesture releases, measurement,
Undo/Redo, redo invalidation and history limits. No mode is inferred from port kinds.
Measurement updates each frame's graph while preserving its mode. Undo/Redo change
graph and mode atomically, increment revision and invalidate native routes/selection
as before. Camera remains navigation state, outside graph-and-mode Undo.

The runtime frames are not a new wire format. Canonical v2 model/edition codecs
continue storing explicit checkpoint modes, not editing history or playback state.
Loading a model creates fresh history. The UI retains one previous working session
for explicit return with its own Undo/mode; it does not fabricate model ancestry.

Cross-mode Undo can leave a loose-only clipboard in a strict session. Retain that
clipboard, but check its edge kinds through the existing compatibility primitive
before paste. An incompatible paste reports a reason without throwing, committing,
clearing Redo or rewriting ports. Returning to a compatible mode permits paste.

## Merge and restore

`mergeEditionsV2` validates/detaches both complete collections before identity
checks. Identical IDs/data are idempotent; fresh IDs append in incoming order.
Any conflicting ID blocks the whole merge with immutable existing/proposed pins
and no replacement archive. Malformed collections, including duplicate IDs within
either input, throw the existing validation error. Even unchanged success is a
validated detached frozen archive; input reference identity is not promised.

V2 restore preview/apply validate the checkpoint in its own mode and require a v2
mode-aware session, matching safe nonnegative revision, editable/idle state, no
active edge-label draft or host busy reason, and enabled Undo for a real change.
Exact graph+mode repeats are no-ops. Mode-only changes are real transactions.

Evaluate the whole `canRestoreEdition(edition, currentConnectionDocument)` veto
freshly and reuse shared granular movement/size/appearance/architecture/deletion/
port/connection policies, adding edge architecture/waypoint checks. Frozen detached
current/target data reaches callbacks. Blank vetoes get a readable fallback;
exceptions propagate without returning a replacement editor. Host-only drafts and
external work use `busyReason`. The host owns preview pin binding and persistence;
preview is not an authorization token or permission cache.

`restoreEditionV2` rechecks on every call and publishes target graph+mode as one
history step. It leaves working camera, edition archive and origin untouched.
Blocked/no-op results retain the original editor. No silent downgrade or standalone
mode-toggle event is introduced. Legacy restore retains graph-only semantics.

## Playback and presentation

V2 playback pins validated immutable editions around the existing ID/timing
transport. Review materializes each checkpoint in its own mode using independent
read-only initialization; working graph/history are never replaced. Opt-in play,
pause, rewind, interval timing and reduced-motion behavior reuse existing core
semantics rather than introduce another timer engine.

Presentation accepts `displaySide`. Semantic comparison remains chronological;
only ghost geometry/movement chooses the other checkpoint for the displayed side.
Added/removed meaning and colors do not reverse. Baseline comparison marks say
“Compared”; selected-side prior marks retain “Previous”. Custom hooks receive
chronological changes and can read the public display-side context. Mode inspection
returns no geometry/reveal event and does not initialize or move the working camera.

## Workbench and compatibility

Add `/history/` to the shared neutral/blue family shell. Four model-controlled
sidebar sections keep the canvas visible: capture/files, review/compare, playback,
restore/Undo. Compose package functions and native/custom parts; Astro owns only
host state, Commands, subscriptions and preview/persistence decisions. Theme,
minimal mode and minimap/ghost preferences remain independently controlled.
Canvas help retains its accessible ID inside a native sidebar disclosure.

File Commands enforce 5 MiB before reading, recheck returned bytes, decode fatal
UTF-8 and use strict v2 model/archive readers. Export enforces the same reopening
budget and uses scoped object-URL release on failure/interruption. Imports check
request token, kind and working revision; cancellation/stale results cannot publish.
Matching stale revisions clear their own pending read without changing working data.
Archive conflicts retain review pins but add no partial editions. Model loading
starts fresh history and retains the previous working session for explicit return.

Native callbacks carry canvas epoch; clocks carry run identity. Inspection,
section changes, imports, hidden-page and reduced-motion transitions pause or
invalidate queued clocks. Passive measurement and idle `GestureCancelled` cleanup
must not interrupt playback; an actual active gesture still pauses inspection.
Protection round trips invalidate restore preview, and confirmation rechecks policy.

Supported portable flows are v2 canonical model/archive I/O. Existing v1 readers
reject v2 envelopes, and v1 writers reject explicit v2 snapshots. The architecture
workbench, Mermaid, patches, receipts, review packets and CLI retain their existing
versioned contracts; they are not upgraded or silently fed unwrapped loose graphs.
They remain separately tracked adoption boundaries, not claimed complete here.

## Boundary and alternatives review

Verdict: **safe with noted risk**. Core owns graph/mode invariants and transactions;
FoldKit views own presentation; the workbench owns effects, session binding and UI
intent. Graph projections are compatibility views of one full-frame history, not
an independent history authority. Replacing public graph arrays with a breaking
union or maintaining unrelated mode side arrays was rejected. Duplicating restore
policy or timing engines was rejected in favor of shared internal primitives.

The dedicated workspace preserves existing strict architecture workflows while
qualifying the complete supported v2 flow. It does not imply that every existing
architecture tool now accepts v2/loose documents. No dependency/version change,
release, deployment, authenticated history, storage service or full parity claim.

## Evidence and next

See [batch qualification](../../packages/foldkit-zloz/evidence/history-workflow-v2.md)
and [mounted workbench evidence](../../apps/zloz-demo/evidence/history-workflow-v2.md).

Next: reconcile portable-adapter gaps into one bounded v2 compatibility batch,
including explicit format/capability decisions before any patch/receipt/Mermaid/CLI
Apply or projection changes. C1 broader portability and C2–C4/Q/R stay open.
