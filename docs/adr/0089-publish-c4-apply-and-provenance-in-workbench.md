# ADR 0089: Publish C4 Apply and provenance together in the workbench

## Status

Accepted for the approved host integration slice, 2026-11-14. Builds on ADR 0088.
Architecture, boundary, delivery and test-quality reviews are self-review.

## Decision

Compose the core's guarded C4 Apply in the existing left sidebar. Keep exact source,
placement and loss review before an explicit Apply button. Use the core to recheck
current source, lifecycle, containment and consent; use current host policies for
semantic protection, final affected relationships and an opt-in C4 Apply lock.
The disabled action exposes a visible associated reason, independent of diagnostics.

The Apply message carries source scope, exact plan key and current review generation.
Reject hidden, foreign, stale or replayed callbacks. Withdraw consent and advance the
generation when source, choices, read-only/busy state or relevant protection settings
change. A protection round trip must not restore an earlier acknowledgement or queued
Apply. Package consent remains review data and does not substitute for policy checks.

Publish the returned editor and append its frozen conversion record in one synchronous
Model update, without a Command, await or second event. Clear staged mappings/consent
on success. Preserve document identity and editions. One graph Undo restores the source;
the retained conversion record survives Undo/Redo and model/example changes. Show source
and target meaning plus placement in native expandable record summaries. Source graph,
camera, session/revision, editions, ancestry and choices remain in the retained record.

## Boundaries and alternatives

Boundary verdict: safe with noted risk. Core owns conversion validity and graph
history; the FoldKit host owns live source identity, external busy conditions, current
policies and the synchronous publication boundary. No projection or containment logic
is duplicated in Astro. C4 records stay separate from DDD's versioned receipt reader.
No portable C4 decoder, download, storage persistence, new package API or wire format
is added. Records are tab-local; reload loses them. General architecture correctness
and real user acceptance remain unqualified.

The host reviews the complete affected target relationships when semantic rules are
enabled. Explicit retention cannot silently bypass those rules after endpoint meaning
changes. Users can change the existing semantic-policy setting and must acknowledge
the resulting exact plan afresh. Policy callbacks remain synchronous and pure.

## Evidence and recovery

Test public host messages for atomic editor/record publication, no side-effect commands,
source immutability, one Undo/Redo, current protections, exact consent/generation,
stale callbacks, model changes, retained provenance and Minimal-mode rendering without
raw keys. Capture a production light/dark keyboard interaction path with canvas visible,
protected Apply, retained record, Undo/Redo and source/target exported model checks.
Run repository typecheck/check/test before commit. Recovery is graph Undo; retain the
record for inspection. No migration, deployment or npm publishing in this slice.

Next: qualify strict portable C4 conversion receipt decoding before download/reopening.
