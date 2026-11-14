# ADR 0090: Validate portable C4 conversion receipts before download or review

## Status

Accepted for the approved core/host receipt slice, 2026-11-14. Builds on ADRs
0088–0089. Architecture, boundary, delivery and test-quality reviews are self-review.

## Decision

Qualify the existing in-memory C4 conversion record as an independent v1 JSON
receipt. Expose `serializeEventStormingC4Conversion` and
`parseEventStormingC4Conversion` in the peer-free core. Accept only the exact format,
version and envelope fields, full source document/session/nonnegative safe revision,
explicit typed mappings/placements, affirmative recorded loss acceptance and target
document. Reject malformed, unsupported, foreign or unknown reserved fields.

Rebuild the C4 conversion plan from recorded source/options, including complete
choice coverage, direct-member scope, role/kind/parent/cycle checks and all losses.
Require a reviewable plan and a source camera. Use the same private projection as
Apply, then compare the complete decoded target document with the rebuilt target:
IDs, names, graph geometry, descriptors, wiring, authored data, camera, editions and
ancestry must match. Return detached frozen canonical source/options/target data.
Serialization uses the same validation boundary, rather than trusting a typed value.
No plan key, current consent token or editor transient state is serialized.

Receipts validate internal consistency, not authorship, truth of the model or a
historical human action. A self-consistent changed source/target pair is still
unsigned data. Parsing never invokes Apply, activates a model, appends a host record
or grants current loss consent. Original source is retained for recovery/review.

## Host integration and boundaries

Boundary verdict: safe with noted risk. Core owns the portable domain contract.
FoldKit owns file I/O Commands, bounded byte reading, fatal UTF-8 decoding, pending
read scope, user feedback and a detached read-only canvas. Astro remains the shell.
No new dependency, provider, CLI command, generic receipt engine or automatic storage
is introduced. No changes to graph/model/edition wire versions or the DDD receipt.

Validate a retained C4 record and require its encoded UTF-8 bytes to fit the same
5 MiB reopening limit before scheduling its download Command. Bind clicks
and success/failure feedback to current model/epoch and the stable append-only record
index. Preserve records after failure for retry; closing/reloading still needs an
explicit saved file. C4 filenames distinguish their format from DDD receipts.

Reuse the existing 5 MiB single-file reader and comparison navigation for both C4 and
DDD. Only strict core decoders may populate the receipt union. Route C4 to its sidebar
and show recorded C4 plan losses, including membership/containment/constraint findings.
Preserve chosen before/after side and existing change focus/Previous/Next/overview
semantics. Retain the last valid comparison on rejection, and discard cancelled or
foreign-source callbacks. Working editor, history, editions, ancestry, retained
conversion records and current consent remain separate from imported evidence.

## Acceptance and recovery

Start with independent literal v1 fixtures rather than producer-only round trips.
Test strict envelopes/options, missing/duplicate/foreign choices, containment, exact
projection, metadata/history fidelity, immutability, serializer validation and actual
Apply output. Qualify installed package consumers. Test host download scope/failure,
bounded UTF-8 reads, invalid/stale/cancelled imports, read-only side/focus navigation,
working-model/Undo preservation and Minimal mode. Capture production light/dark
keyboard download/reopen/before-after evidence. Run repository checks and API docs.

Recovery is close comparison and return to the exact working editor; invalid reads
leave prior review intact. Existing JSON models remain valid, with no migration.
No npm publishing, deployment, verified authorship or full D1b/C/Q/R closure is claimed.
