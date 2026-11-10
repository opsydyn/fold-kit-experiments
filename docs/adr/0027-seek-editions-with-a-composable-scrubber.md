# ADR 0027: Seek editions with a composable scrubber

## Status

Accepted for the approved package scrubber/workbench slice, 2026-11-09.
Boundary review: **safe with noted risk**. Ordinal input must become an edition
identity before dispatch; hosts must validate current identity, policy and session.

## Decision

Core derives ordered entries, labels, current value text and restrictions from
the existing playback cursor. A native range value maps to a nullable identity
request; malformed/out-of-bounds values never clamp or select a substitute. A
fresh resolver checks membership and host restrictions in update, yielding a
ready EditionSelected event, a blocked reason or ignored input. Manual seek
remains available with reduced motion. Applying the existing event pauses play.
No new cursor, draft selection, timer or persistence format is introduced.

Foldkit helpers provide a controlled range, non-live readout, visible reason and
explicit Open edition button, plus nullable slots and a layout hook. The range
uses native keyboard behavior and human-readable aria-valuetext. The Open button
supports a single edition and selecting an unchanged point while present. Hosts
can omit it when composing with other transport controls. Helpers generate no
DOM IDs, and custom labels/content/layout remain independent of behavior.

The workbench captures model identity plus a stable seek-session token, separate
from the timer run and canvas projection epochs. Continuous seeking preserves
that token; model/collection changes, disable/re-enable, leaving History, working
graph edits and return to present invalidate it. Old callbacks cannot reopen a
historical projection. Live busy policies are rechecked. Working graph, Undo,
camera and editions remain untouched; existing ghosts compare adjacent editions.

## Alternatives and consequences

Dispatching a saved ordinal could select a different edition after reorder.
Preview/confirm drafts would introduce another selection source without a need
in this slice. Reusing timer generations would invalidate continuous range input
on every seek. A dedicated session identity is host-only and never serialized.
The package owns the input/decision contract; hosts own callback lifetime and
projection. Comparison editing, playlist curation, search and new history formats
are later work. No dependency, publication or deployment changes. Reviews are
self-review; rollback is a code revert without portable-data migration.
