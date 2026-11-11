# ADR 0047: Reopen conversion receipts as read-only comparisons

## Status

Accepted for the approved workbench slice, 2026-11-11.
Boundary review: **safe with noted risk**. Review and test-quality checks are
self-review. Imported receipts are validated data, not verified authorship or
permission to edit.

## Context and decision

ADR 0046 retains portable conversion receipts. Reopen downloaded receipts directly
in Mapping review, including files from another model or browser session. Reuse the
package's strict receipt parser, edition comparison and read-only history navigation
adapter. No public package contract changes or additional conversion/diff engine.

Read one UTF-8 JSON file through a Command with a 5 MiB limit checked before and
after reading. Model owns a monotonic read generation and current model ID/epoch.
Cancellation, replacement reads and closing invalidate publication; completion
checks current scope and host editing/playback conditions again. A failed read or
invalid/malformed/tampered/unsupported receipt preserves the last valid comparison.
The parser validates the complete before/after documents and the declared mapping's
target, including recorded provenance. Parsing does not establish authenticity.

Publish an independent receipt review and detached read-only editor. Before/After
controls reconstruct the chosen immutable snapshot; navigation events carry review
identity and side and pass through the package's fail-closed history adapter. The
main canvas shows that review, with a persistent read-only banner and close control.
Working editing actions and model switching are blocked during review; theme,
sidebar and diagnostics controls remain available. The skip link targets the actual
review canvas. Changes, ancestry, original identifiers and historical loss reasons
remain available with minimal diagnostics. Closing returns to the exact prior
working editor, Undo/Redo, editions, model sessions and any historical review.

The imported receipt is not appended to the local Apply receipt registry, activated
as a working model, or used to populate Apply choices/consent. File reading affects
only transient review state; there is no automatic persistence, replay or external
write. Pending reads can be cancelled logically; an already-started bounded native
file read may finish, but its late response cannot publish.

## Alternatives and consequences

Opening the target as an editable model would conflate inspection and editing.
Embedding two independent full editors adds navigation and layout complexity;
a single Before/After surface plus a change list preserves canvas space and reuses
existing primitives. Side changes reset the review camera to the recorded snapshot;
Fit navigates only the detached editor. The working camera remains untouched.

The existing layout still constructs its ordinary canvas before selecting the
review surface; discarded HTML has no mounted effects. Full receipt validation and
comparison are synchronous and repeated during rendering. The byte limit bounds
input size, not graph complexity or latency. No large-document performance claim,
full assistive-technology qualification, hosted proof or cryptographic trust claim
is made. Receipt state remains tab-local and can be recovered by reopening the file.

## Verification and next work

Typed controller/Command tests protect exact working-state preservation, meaningful
semantic before/after changes, read-only navigation, stale scopes, cancellation,
malformed/tampered/oversized/unsupported/invalid UTF-8 input, retry, historical-review
preservation and minimal-mode native controls. Production browser evidence reopens
an actual downloaded Apply receipt in a fresh page, checks both semantic renderers,
keyboard selection, final working-document equality, rejection recovery and
light/dark captures. Run root lint/format, typecheck and tests.

Next bounded slice: select a recorded change to focus its node or connection on
either side using the existing history navigation primitives.
