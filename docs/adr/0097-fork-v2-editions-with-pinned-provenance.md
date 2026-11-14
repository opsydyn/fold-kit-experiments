# ADR 0097: Fork v2 editions with pinned provenance

## Status

Accepted for the approved package-level fork slice, 2026-11-14. Follows
[ADR 0096](0096-initialize-v2-models-and-review-editions.md).
Architecture, delivery and test-quality review are self-review.

## Decision

Add `forkEditionV2(source, editionId, target, policy)` with
`ZlozEditionForkPolicyV2` and the discriminated `ZlozEditionForkResultV2`. Validate
and detach the whole canonical v2 source, including unselected and pinned-origin
checkpoints. Target ID/name must be nonempty and the ID distinct from the source.
Select only a named edition owned by `source.editions`. Never fall back to current
state, a review's navigated editor, a pinned origin or an externally supplied
checkpoint. Invalid source data throws the existing core validation error; missing
edition, invalid identity and policy veto return `blocked` without a target.

Evaluate `canForkEdition` on every valid attempt using the detached frozen source,
the selected edition within that source and a frozen copied target identity.
Null permits the fork; empty/whitespace rejection strings remain vetoes with a
readable fallback. A thrown policy failure propagates without returning a target.
No policy result is cached and no callback is invoked before ownership/identity
preconditions pass. Hosts own workspace-wide identity availability; they can veto
conflicts through this policy. The package does not query or write a registry.

An allowed result contains a deeply frozen detached canonical v2 document with the
chosen identity/name, the selected edition's exact snapshot/mode/camera, an empty
edition list, and immediate-parent provenance pinned to the source identity/name
and selected edition. Preserve authored node/edge/port IDs, kinds, payloads,
geometry and semantic data; IDs stay local to their model. The target snapshot
and its origin pin are distinct detached values. A fork-of-fork pins only its
immediate parent, not a flattened ancestor or recursive document chain.

The fork result is persistent data. Compose it with `createModelEditorV2` to start
a fresh target session with no inherited revision, selection, clipboard, gesture,
surface, Undo/Redo or permissions. Default initialization is editable and uses the
checkpoint camera, or its own default when the checkpoint has no camera. Explicit
host `EditorOptions` remain available through that initializer. Do not copy the
working editor, reinterpret mode or restore into its history. No source Undo entry
is created; normal target edits use that target's own Undo.

## Alternatives and boundary review

Boundary verdict: **safe with noted risk**. Core owns canonical validation,
checkpoint ownership, policy and provenance. Reuse the unversioned ID/name value
object and v2 capture/initialization rather than adding an identity allocator or
another editor reducer. Returning an editor from the fork was rejected because it
would couple persistent data to transient preferences. Using the v1 fork was
rejected because its strict snapshot boundary intentionally refuses v2 records.
A generic version-erasing fork abstraction would complicate the different codec
boundaries; the small v2-specific adapter keeps those boundaries explicit.

The function produces local data, not an external write or service authorization.
It does not change the source model/current mode, grant Apply permission, infer
relationships or invent timestamps/identities. V1 behavior and wire formats remain
unchanged. V2 append, comparison/ghosts, restore/playback, CLI/workbench and broader
C/Q/R gates remain open. No publication, version bump or deployment is performed.

## Evidence and next

[Qualification](../../packages/foldkit-zloz/evidence/edition-fork-v2.md) records all
working/checkpoint mode combinations, loose-only checkpoints, immutable ownership
and provenance, live/failing policies, fresh target sessions, fork-of-fork/camera
behavior, installed consumers and repository checks. Reviews are self-review; no
new browser/device/AT claim is made for this headless slice.

Next: v2 edition comparison with explicit mode-only changes before comparison
presentation and cross-mode restore/playback adoption.
