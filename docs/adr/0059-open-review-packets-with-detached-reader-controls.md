# ADR 0059: Open review packets with detached reader controls

## Status and scope

Accepted for the approved read-only packet reader slice, 2026-11-13. Extends
[ADR 0057](0057-decode-portable-review-packets-strictly.md),
[ADR 0058](0058-inspect-review-packets-through-effect-cli.md) and P1.
Architecture/boundary, delivery and test-quality reviews are self-review, safe with
noted risk. No dependency, wire change, model import, publication or deployment.
PNG, Alchemy and writable modelling patches remain deferred.

## Decision

The optional Mermaid adapter owns the pure `createReviewReader`,
`reviewReaderForScope`, `resolveReviewReader` and `updateReviewReader` contract.
The host supplies a unique model-incarnation scope and File metadata. An accepted
ReadRequested produces a read descriptor (scope, monotonic run, byte budget).
The host reads only through a Command, bounds bytes before and after reading,
decodes UTF-8 fatally and returns the correlated success/failure fact. Default
budget is 1 MiB, configurable from 1 through 16,000,000 bytes; the package decoder
retains its independent character/depth/value budgets. Metadata is an early check,
not proof of actual byte size. No native File or browser dependency reaches the
headless root. Hosts must not reuse scopes across model incarnations.

Recheck opening protection at request and successful completion. Ignore foreign
scope and stale run callbacks; a newer read supersedes the old one. Logical cancel
and closing clear pending publication; they do not promise aborting native IO.
Decode and recompute through `parseReviewPacket` before publishing the owned,
frozen packet. Invalid files, live denial, cancellation and stale callbacks retain
the prior accepted packet, selected comparison side and host preview. Reopening
success selects the packet's selected side; baseline/selected changes require a
matching review ID and live selection policy. Empty protection strings remain
protected with a default reason. Close remains available even when protected.

The optional `/foldkit` helper `zlozReviewReader` supplies native file input,
status, cancel, side selection, close, audit findings and projection losses.
Nullable summary/finding slots and a layout slot compose custom controls;
undefined uses defaults, null omits. Count and instruction switches respect
minimal/diagnostic host preferences independently of functional findings/actions.
Opening protection and side protection are separate; neither permits graph edits.

The workbench's Review packets sidebar performs bounded file IO, rejects active
working edits/imports/layout, receipt/history comparisons and hidden/collapsed
opening contexts, and rechecks on completion. Publish reader and preview together.
Render the selected snapshot in a separate read-only editor with its own camera,
reusing core `updateHistoryReview` to admit only navigation events. Guard canvas
facts by scope, review ID and side. Block working graph/model/Undo commands during
review; retain theme/diagnostics and close. Fit and pan affect only the detached
preview. Closing reveals the original working graph, camera and Undo by reference.

## Alternatives and consequences

App-only file handling would duplicate the review lifecycle in every consumer.
Importing snapshots into the working editor would make inspection destructive and
require Undo recovery. Keeping the packet in package state and a detached preview
in host state separates lifecycle/validation from rendering without new schema or
canvas abstractions. Costs: synchronous bounded decoder recomputation, host-owned
IO enforcement and preview construction, and logical rather than physical cancel.
Validity remains self-consistency, not authenticity or renewed conversion consent.
Mermaid strings are retained data; the reader neither executes nor injects them.

## Implementation and verification

Add reader/controller and optional view modules/exports; reuse strict literal v1
fixtures, existing core read-only navigation, File Command and receipt canvas
patterns. Tests cover last-good/side retention, stale runs/scopes/IDs, cancellation,
closing, live policies, native/custom/minimal views, fatal UTF-8 and working model,
Undo and consent preservation. Exercise the real installed tarball in Node/Bun and
Bundler/NodeNext. Run root lint/format, typecheck, all workspace tests and TypeDoc,
with shared-dist builders sequential. Build the workbench and capture Chromium
light/dark/minimal opening, recovery and protection evidence. Rollback is a local
revert without a data migration. P2 patch planning requires a separate contract.
