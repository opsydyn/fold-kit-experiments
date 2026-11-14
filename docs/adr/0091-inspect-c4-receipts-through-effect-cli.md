# ADR 0091: Inspect C4 conversion receipts through the Effect CLI

## Status

Accepted for the approved read-only CLI slice, 2026-11-14. Builds on ADR 0090.
Architecture, boundary, delivery and test-quality reviews are self-review.

## Decision

Add `zloz c4 receipt inspect [--input <file>|-]` using the existing Effect CLI
command tree, injectable platform services, bounded UTF-8/JSON input and framed
JSON stdout. Default input is stdin; terminal stdin requires an explicit source.
The existing CLI limit remains 1 MiB for both file and streamed stdin. This is a
CLI resource bound, distinct from the workbench's documented 5 MiB limit.

Expose an additive `c4-receipt-inspect` operation in `foldkit-zloz-cli/v1` with
`scope: recorded-conversion`. Successful data contains the validated v1 format,
full source provenance (document, camera, session/revision, editions and ancestry),
target document, explicit choices, before/after node and edge changes, recorded
plan loss findings and affirmative historical loss acceptance. Set
`authority: read-only-evidence`; no current consent or Apply permission is created.
Losses also appear as `severity: loss` diagnostics and do not fail valid inspection.

Core remains the conversion authority. Strictly decode with the public C4 parser;
reuse its plan builder for loss findings and existing history comparison for change
classification/order. Do not duplicate conversion, containment or target-equality
logic, invoke Apply, activate sessions, append records or write files. Imported
receipts remain unsigned internal-consistency evidence, not verified history.

## Failure and output contract

- Exit 0: fully validated receipt and one `inspected` JSON response, including losses.
- Exit 1: valid JSON explicitly identifies a different string format or numeric
  version. Emit `rejected` with `incompatible-c4-receipt`, no inspection data.
- Exit 2: malformed/invalid receipt, I/O, byte limit, UTF-8/JSON, invocation or output
  failure. Preserve existing shared diagnostic codes; use `invalid-c4-receipt` for
  core contract rejection. Missing or incorrectly typed envelope markers are invalid
  data rather than a readable future contract.

Version/format incompatibility is classified before interpreting its contents.
A future-version payload is not partially inspected. Unknown supported-version
reserved fields and altered targets fail strict core validation. Expected failures
are typed Effect errors; output is framed before failure and output errors retain
exit 2 priority. No errors or source files are silently rewritten.

## Boundaries and verification

Boundary verdict: safe with noted risk. CLI owns I/O, protocol projection and exit
classification; core owns receipt/domain validity and history semantics. Effect
owns command parsing and the executable alone owns NodeRuntime. No new dependency,
core contract, wire version, graph mutation, renderer or deployment is introduced.

Tests begin with the independent core literal v1 receipt. Check exact provenance,
target and choices, stable changes/losses, successful loss-bearing inspection,
unsupported/malformed distinctions, no partial data, file-byte preservation, stdin,
missing/oversized/invalid-UTF-8 input and invocation rejection. Qualify real installed
Node/Bun binaries and public response types. Capture a local command transcript,
run full repository checks, then commit. No npm publishing.

Recovery is rerun inspection with a compatible valid file; no model or filesystem
changes need rollback. Next: reconcile remaining domain/agent roadmap gates against
these receipt APIs and evidence before selecting another feature.
