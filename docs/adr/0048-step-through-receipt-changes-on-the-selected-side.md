# ADR 0048: Step through receipt changes on the selected side

## Status

Accepted for the approved package/workbench slice, 2026-11-12.
Boundary review: **safe with noted risk**. Reviews are self-review. Pure package
navigation owns traversal; the host owns receipt identity, cursor and detached
camera. No permission to apply model changes follows from navigation.

## Decision

Expose `resolveHistoryChangeStep`, `ZlozHistoryChangeCursor` and
`ZlozHistoryChangeStepDirection` from the core package. A cursor is an entity/ID
pair, not an ordinal. Resolve current visible entries through the existing change
navigator, then resolve the adjacent candidate through the same live focus policy.
Next with no cursor selects the first visible change. Previous with no cursor is
unavailable. First/last boundaries stop without wrapping. A hidden or stale cursor
is ignored; an unavailable candidate is blocked, never silently skipped. The
helper preserves selected-edition and original-side removal targets from the
existing focus resolver. It does not mutate comparison, camera, selection or model.

The workbench supplies a comparison oriented to its chosen Before/After side.
Previous/Next messages carry receipt generation, side, direction and the last
focused entity/ID. Recheck all of these against live state, plus panel visibility,
measurement, read-in-progress, gesture and candidate membership. This prevents a
queued/replayed click from walking onward from a different cursor or side. Route
successful steps through the same private camera-only adapter as direct row focus.
Existing manual navigation resets the cursor; an idle canvas binding preserves it.

Native buttons show unavailable reasons and a current-position readout even with
minimal diagnostics. Direct Focus before/after remains available. No extra cursor
store, default keyboard shortcut, wrapping, automatic playback or graph transaction.
The receipt codec and persistent model format remain unchanged.

## Alternatives and consequences

App-only index arithmetic would make traversal unavailable to package consumers
and risk diverging from filters and live focus vetoes. A separate transport model
or cached focus grant adds state and invalidation without improving this bounded
behavior. The pure resolver is additive and reuses established domain contracts.
The host must still validate its own message scope and use the returned target
against the correct review. Synchronous comparison cost remains unqualified for
large receipts; this slice adds no performance claim.

## Verification and next work

Core tests protect null start, boundaries, entity collisions, filters, live vetoes,
non-skipping and reversed comparisons. Typed workbench tests protect chosen-side
continuity, cursor/side/receipt staleness, all existing focus guards, minimal-mode
controls, position and working-state preservation. Production browser evidence
checks keyboard Next, Previous/Next on both sides, boundary reasons, direct focus,
manual reset and exact working-document preservation after closing. Run root lint,
typecheck and tests, plus production and API documentation builds.

## Follow-up: focused side continuity, 2026-11-12

Implemented the approved next slice through the existing public focus resolver.
Explicit Before/After switching carries the current stable entity identity into
that side's comparison and refocuses it, preserving traversal position. Availability,
receipt identity and panel visibility are rechecked before changing the review.
An unavailable target preserves the previous side, camera and marker.

The explicit Show receipt overview control replaces Fit receipt diagram. It sends
a scoped camera-only message, clears the cursor even when the camera already fits,
and fits all nodes on the current side. Pending reads, active gestures and missing
measurement block it with a visible reason; stale receipt/side callbacks cannot
reset another view. With no focused change, side switching retains the existing
recorded-snapshot camera behavior. Native buttons keep keyboard focus and continue
to operate in minimal mode. Working editor, Undo, consent, receipts and history
remain unchanged. No public API or persistent schema change is required.

The core roadmap remains the priority. Alchemy Domain integration is deferred
until completion of that roadmap by the user's explicit instruction.
