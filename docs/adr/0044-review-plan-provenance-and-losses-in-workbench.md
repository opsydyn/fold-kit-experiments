# ADR 0044: Review plan provenance and losses in the workbench

## Status

Accepted for the approved workbench slice, 2026-11-11.
Boundary review: **safe with noted risk**. Acknowledgement records review of a
specific plan; it is not edit permission, a human-identity guarantee or Apply.

## Decision

Compose the public `resolveEventStormingDddConversionConsent` in Mapping review,
using the displayed editor and authoritative model document capture. The host
supplies its tab namespace/model epoch/historical source ID and editor revision.
The package owns provenance capture, blockers, proposed changes and loss decisions.
The app owns only mapping preferences, temporary consent and callback generation.
No converted graph or duplicate domain rules are stored in the UI.

Add a collapsible Conversion plan review section in the left sidebar. Show model
name, working/historical snapshot and fork ancestry, with source identifiers under
a separate disclosure. Show package blockers and the complete prospective loss
list before a native all-loss acknowledgement checkbox. Blocked/unchanged plans,
history and busy edits/import/layout disable acknowledgement with a visible and
accessible explanation. Existing mappings and source canvas remain available.
No Apply control is introduced.

Store affirmative consent only in transient Foldkit Model state. Bind callbacks to
source model/epoch/revision/graph key, exact current package plan key and a host
review generation. Do not render or log the exact-content plan key. Recompute the
package review before accepting a click. Native unchecking withdraws consent.
Choices/reset, source/camera/revision, metadata/editions/ancestry, model/history
replacement and busy-state transitions clear or invalidate it. Increment the review
generation so callbacks from before a withdrawal or change-and-revert cannot revive
an old acknowledgement. Item inspection, theme and diagnostics preferences preserve
consent while its exact source/plan remains unchanged.

Acknowledgement never enters model JSON, editions, origin, editor Undo or saved
model documents. Provenance and functional losses/protection reasons remain visible
with Minimal mode or Show diagnostics disabled. Optional numeric summaries retain
the existing diagnostic controls. Use native details/labels/checkbox/focus behavior
and the existing shared light/dark family tokens.

## Simplicity and alternatives

Reuse the package consent resolver rather than storing a cached transformed graph
or app-computed consent boolean. Use one transient consent record and one callback
generation, rather than a capability store or provenance persistence schema. Native
collapsible content keeps the sidebar manageable and the canvas unobstructed. Costs
are full document/plan recomputation while reviewing, with no large-model performance
claim. Rejected: a broad allow-loss toggle, acceptance of stale UI closures and
rewriting model fork ancestry to represent conversion provenance.

## Verification and next work

Test first: blockers, source provenance, exact-plan acceptance/withdrawal, camera
change-and-revert replay, choice/reset/archive/source invalidation, stale/hidden/busy
callbacks, history inspection and unchanged authoritative export/Undo. SSR checks
native semantics, diagnostic independence and absence of plan keys in output.
Production browser evidence exercises a real edition fork, keyboard acknowledgement,
loss lists, invalidation, source exports and inspected light/dark screenshots.
Run root check/typecheck/tests. Architecture/delivery/test-quality reviews are
self-review; browser evidence is local, not comprehensive assistive-tech acceptance.

Next bounded slice: design and implement package-level atomic Apply with live
source/policy/lifecycle/consent checks, retained provenance and one Undo, before
exposing an Apply control in the workbench. Provenance storage still needs an explicit
contract. Rollback is source reversion; no user model data is migrated here.
