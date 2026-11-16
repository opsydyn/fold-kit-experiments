# ADR 0112: Paste native v3 fragments with explicit identities

## Status and scope

Accepted, 2026-11-16. The user approved the next bounded native v3 clipboard
slice in the isolated worktree: package contracts, live policies, atomic Undo,
composable workbench demo, tests, visual evidence and a local commit. No publishing,
deployment or unrelated adapters. Architecture, boundary, delivery and test-quality
reviews are self-review.

## Decision

Keep clipboard data and intent in peer-free core. A distinct immutable native
fragment keeps mode/capability and rooted world geometry; no legacy bare-graph
clipboard, implicit capability enablement or downgrade is used. Full source
validation happens before copy selection. Groups include descendants once and all
internal edges. Detach external parents and their constraints; disclose this and
omitted crossing edges through findings. Copy never edits the source and can run
in read-only review, subject to a dedicated live whole-fragment copy veto.

Paste requests name the exact target session/revision/full document, full copied
fragment, finite world offset and complete node/edge/scoped-port maps. Default IDs
are collision-free; explicit host maps remain available. Reject missing, extra,
ambiguous or colliding identities. Preserve target mode/capability/camera, require
matching fragment mode/capability, remap parents and endpoint owners/ports, translate
every node and bend exactly once and leave opaque metadata unchanged.

Review is informational. Apply rebuilds and validates complete intent, geometry,
current lifecycle and current port/connection/whole-document policies using the
existing native transaction kernel. Publish all changes synchronously as one Undo
unit; failure leaves the original editor and history untouched. Undo/Redo rerun
current directional policy. No clipboard contents become authority.

The native workbench Model owns clipboard/findings outside editor history and
portable checkpoints. Buttons/custom controls and existing keyboard input facts
share the package controller. A repeated placement helper advances offsets when
node anchors collide; exact headless offsets remain host-controlled. Optional
Foldkit controls show current denial/findings even in minimal mode. Hosts may
compose or replace them; no mandatory UI/runtime peer reaches core.

## Alternatives and consequences

Reusing legacy paste would lose the v3 capability envelope and bypass native
live transaction checks. An implicit per-fragment conversion would hide mode and
port-kind changes. Copying/pasting runtime sessions would mix transient authority
with document data. Explicit maps cost validation and API surface, but permit
custom designer identities without losing source binding or endpoint consistency.

OS clipboard, cut, cross-tab transport, portable clipboard text decoding,
paste-into-parent, automatic collision-free envelopes and application-specific
metadata references are separate contracts. This slice avoids new dependencies,
wire-version changes, permission prompts and transport/UI coupling. Geometry
checks and per-port policies add work proportional to fragment size; broad
performance and human AT/device acceptance remain unqualified.

## Verification and recovery

Test nested groups, identical local port names, parent remapping, endpoint maps,
opaque metadata, bends, ownership, detachment/crossing findings, repeated paste,
explicit IDs, collisions, malformed/accessor inputs, stale complete sources,
mode/capability incompatibility, policy exceptions/vetoes, lifecycle and read-only
behavior. Assert one full-document Undo/Redo and current directional protection.
Qualify installed peer-free Node/Bun consumers and optional Foldkit SSR controls.
Browser evidence exercises actual controls/shortcuts, sockets, current protection,
minimal/light/dark presentation and source-preserving Undo. Run workspace checks,
typechecks/tests, production demo/API builds and staged Moon checks before commit.

Rollback is a local revert; canonical documents and dependencies are unchanged.
