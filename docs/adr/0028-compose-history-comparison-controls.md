# ADR 0028: Compose history comparison controls

## Status

Accepted for the approved package comparison/workbench slice, 2026-11-09.
Boundary review: **safe with noted risk**. Hosts must re-resolve requests against
current edition metadata and policy; DOM callbacks do not authorize model edits.

## Decision

Core owns a pure comparison context and request resolver over edition ID/name
metadata, current review ID, baseline ID and four ghost preferences. Baseline
choices retain order, exclude the viewed edition, and reject duplicate IDs.
Unknown/self selections are ignored instead of silently clearing or substituting
a baseline. Clearing is explicit. Stale stored IDs display no active comparison
without changing state. Requests return ready, unchanged, ignored or blocked.
Global and individual host restrictions carry nonempty visible reasons.

Ghost master visibility and individual layers remain independent. Minimal mode
suppresses effective visibility while retaining preferences. Controls remain
configurable before review and with the master hidden. Native checkboxes emit
toggle facts resolved against fresh state; an absolute-value request also exists
for programmatic preferences. No timer, graph edit, Undo entry, persisted format
or replacement history cursor is introduced.

The optional Foldkit entry provides native select/checkbox/status/reason helpers,
a named composition, nullable slots, ordered ghost subsets and a layout hook.
Hosts can reuse native semantics inside custom wrappers without duplicating
policy. Helpers own no state, generated DOM IDs, clock or side effects.

The workbench consumes the same context for sidebar controls and canvas ghost
visibility and the resolver for updates. Its existing lifecycle still pauses
playback on baseline selection; ghost preferences remain live during playback.
The working editor, editions and existing Undo are untouched. The host continues
to own the accessible changes list and explanatory legend.

## Alternatives and consequences

Keeping private workbench controls would leave consumers rebuilding policy.
Coupling stored layer choices to visibility would lose designer/user choices.
Capturing desired toggle values would drop repeated clicks before a rerender.
No additional comparison state machine or persistence migration is needed.
Rollback is a code revert. No dependencies, publication or deployment changes.
Architecture, delivery and test-quality review are self-review.
