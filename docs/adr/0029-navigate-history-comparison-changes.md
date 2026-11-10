# ADR 0029: Navigate history comparison changes

## Status

Accepted for the approved change-navigator/workbench slice, 2026-11-09.
Boundary review: **safe with noted risk**. Hosts must validate callback scope,
current comparison identity, filters and live focus policy before moving a camera.

## Decision

Core derives a change list and Added/Removed/Changed controls from the existing
comparison contract. Node and edge identities remain separate even when their
IDs collide. Filters are host preferences, independent of ghost visibility,
playback and persisted editions. Kind counts describe the unfiltered comparison;
empty comparisons and empty filter results have distinct summaries.

An explicit focus request carries baseline/selected edition IDs plus entity type
and ID. The resolver rechecks the current pair, visible entries and current host
restrictions. It returns ready, ignored or blocked; unknown, stale and filtered
requests never select a substitute. Denial reasons are nonempty and visible.
Added/changed targets use existing node/edge reveal events. Removed targets carry
earlier node or endpoint geometry for camera fitting only. Nothing restores
removed content or changes ghost preferences. Portable snapshots contain no
computed routes, so removed-edge framing uses baseline endpoint node geometry.
The existing `fitNodes` primitive is exported for directly fitting these bounds;
hosts need no synthetic graph or geometry algorithm.

The optional Foldkit entry offers native filter inputs, focus buttons, status,
reason and a list composition. Nullable slots, ordered filter subsets and a
layout hook separate appearance from behavior. Default entries expose protection
reasons visibly and through native disabled/description semantics. Camera focus
keeps keyboard focus on the initiating button; helpers perform no DOM focus,
effects, graph edits or state ownership.

The workbench replaces its private change list with this composition and custom
badges. Focus is scoped by model identity and projection epoch. Both view and
update share live operation/measurement restrictions. A valid explicit focus
pauses playback and updates only the detached review camera; stale callbacks
cannot pause playback. Removed focus works with ghosts hidden and leaves that
choice intact. Minimal mode can omit the numeric result summary. Working editor,
Undo, editions and serialization are unchanged.

## Alternatives and consequences

Keeping an app-only list would force consumers to duplicate interpretation and
policy. Capturing ordinals or camera coordinates would allow stale callbacks to
select another change. A new selection cursor or automatic ghost activation
would couple exploration to unrelated preferences. The chosen pure request
contract adds no dependencies, clocks or archive format. Hosts retain camera,
callback lifetime, playback and accessible custom-renderer responsibilities.
No publishing or deployment. Reviews are self-review; rollback is a code revert.
