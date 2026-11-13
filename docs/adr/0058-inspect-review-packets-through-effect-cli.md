# ADR 0058: Validate and inspect review packets through Effect CLI

## Status and scope

Accepted for the approved review-packet CLI slice, 2026-11-13. Extends
[ADR 0057](0057-decode-portable-review-packets-strictly.md) and the P1 criterion.
Architecture/boundary, delivery and test-quality reviews are self-review: safe with
noted risk. No new dependency, npm publication, model mutation/import, workbench
opening UI, PNG or Alchemy is introduced.

## Decision

Add Effect `Command.make` leaves `zloz review validate` and `zloz review inspect`,
using the existing `--input` / `-i` flag with stdin (`-`) default. Validation emits
model and baseline/selected identities, graph counts, audit status/counts and retained
projection diagnostics. Inspection emits the complete recomputed packet as JSON data.
Neither command executes Mermaid, edits a model or writes its input file.

Both commands exit 0 for a valid packet, including introduced audit findings and
reported projection losses. They check validity, not compatibility or new loss
consent. Malformed/inconsistent/unsupported input and IO/output failure exit 2.
They introduce no exit-1 case; existing audit/export exit semantics stay unchanged.
The CLI protocol remains additive v1 with operations `review-validate` and
`review-inspect`, statuses `valid` and `inspected`, a typed inspection/summary contract
and optional diagnostic `path` preserving the decoder's JSON Pointer. Subject remains
the input path or stdin marker. Existing command response shapes remain intact.

Extract the existing scoped 1 MiB UTF-8 reader as `readTextInput`. Existing graph,
model and rule readers continue through `readJsonInput`; review reading sends raw
text directly to the strict package decoder. This preserves duplicate-key/depth
checks before any generic schema parse. Fatal UTF-8 decoding, stream byte limits,
cancellation/finalization and TTY protection retain the existing IO boundary.
Use Result/Match for pure decoding and projection; compose Effect read/report/write
pipelines. Platform services and the sole process runtime stay injectable/unchanged.

Inputs are raw portable packet documents. The CLI creation/inspection protocol
wrapper is not a packet; hosts extract its `.data` explicitly. Do not silently unwrap
via a generic JSON parse that could discard duplicate keys. Workbench downloads are
already raw portable packets. No automatic model/graph projection is introduced.

## Alternatives and consequences

Duplicating decoder validation in the CLI would drift from package semantics.
Returning exit 1 for a valid regressed packet would confuse validity with audit gates.
A generic JSON reader before strict decoding would weaken the resource/duplicate-key
boundary. Raw text reuse keeps IO and interpretation separate without a second stream
collector. Costs are a complete packet on inspect stdout, synchronous decoder work
within existing limits and explicit `.data` extraction for CLI response wrappers.
Validity remains self-consistency, not authenticity; UI recovery is still a host concern.

## Implementation and verification

Extend CLI protocol/types, the Effect command tree and shared text IO seam. Test
positive validation/inspection, regressions with exit 0, exact JSON-path rejections,
raw wrappers, malformed/duplicate/deep JSON, file preservation, missing files and
exact UTF-8 byte limits. Exercise real packaged Node/Bun commands for file/stdin,
inspection, invalid UTF-8, forged projections, framing and exit status. Existing IO
scope/cancellation and all old command tests must stay green. Capture real command
JSON evidence; run root lint/format, typecheck, all workspace tests and TypeDoc with
shared-dist builds sequential. Rollback is a local revert without a document migration.
Next: guarded read-only workbench opening, preserving the last good review on failure.
