# ADR 0025: Add opt-in edition playback

## Status

Accepted for the approved playback/package/workbench slice, 2026-11-09.
Boundary review: **safe with noted risk**. Playback must never own or mutate the
working graph, editions, Undo or model identity. Timing belongs to the host.

## Decision

Core exposes a pure session cursor over a pinned ordered collection of edition
IDs. Empty, paused and playing states are explicit; only playing carries elapsed
time. Creation is opt-in and reduced motion defaults true until the host supplies
the preference. Play, pause, rewind, manual steps, seek and interval changes are
deterministic events. Reduced motion pauses immediately and never auto-resumes;
manual navigation remains available. Play at the last edition restarts at the
first; playback pauses at the end and never loops automatically.

Each elapsed event advances at most one edition and discards overshoot. This
favours an inspectable narrative over wall-clock catch-up after a delayed timer.
Invalid identities/intervals/active elapsed values throw the canonical error.
Hosts replace the cursor when the collection changes and resolve selected IDs
through their own edition store. No graphs or timer resources enter the cursor.

The workbench owns a scoped Effect Stream timer, active only while playing.
It skips Stream.tick's immediate emission so every edition gets a full interval.
Callbacks carry model identity and a playback generation, independent of canvas
projection epochs. Pause/restart, media preference, visibility, collection/model
changes and manual inspection invalidate old callbacks. Automatic advancement
uses existing read-only history projections and previous-edition ghost comparison;
working graph/Undo/camera stay untouched. Live reduced-motion changes and hidden
pages pause without resuming automatically.

Playback is disabled by default and exposed in the History sidebar. Users retain
control over ghosts, comparison, timing, manual steps and return to present.
Capture/import/restore/fork/model switches and navigation pause the transport;
queued ticks cannot republish a previous projection. Playback is session-only;
no snapshot, edition, model codec or public persistence format changes.

## Alternatives and consequences

An app-only timer would deny consumers a reusable transport. A timer inside core
would couple graph state to browser effects. Camera interpolation, morphing,
audio, looping, exports of a playback session and collaboration are omitted.
Static cuts and optional existing ghosts make the same editions inspectable
without automatic motion. The host owns lifecycle/freshness checks; public pure
cursor types do not prove that a host resolved an ID against the right model.
No dependency, publication or deployment change. Rollback is a code revert;
portable documents are unaffected. Reviews are self-review.
