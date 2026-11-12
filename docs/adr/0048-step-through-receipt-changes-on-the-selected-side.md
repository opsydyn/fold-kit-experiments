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

Next bounded navigation slice: preserve the focused change when explicitly
switching Before/After, while keeping overview reset an explicit action.
