# Review-packet CLI validation and inspection qualification

- **result:** complete
- **claim:** Effect CLI `review validate` and `review inspect` reuse the strict
  package decoder, scoped bounded UTF-8 IO and typed JSON responses. Validation
  distinguishes valid packets with findings (exit 0) from invalid/unsupported input
  and IO failures (exit 2). Inspection returns the complete read-only packet as data.
- **evidence:** focused command/IO tests cover regressed-but-valid packets, full
  inspection equality, JSON Pointer diagnostics, malformed/duplicate/deep JSON,
  raw response-wrapper rejection, missing files, preserved source files and exact
  UTF-8 byte boundaries. Existing chunking/cancellation/finalization tests remain
  required. Real packed Node/Bun binaries exercise file validation, stdin inspection,
  forged projections, invalid UTF-8, framing, exit codes and clean stderr. See
  [the repeatable compiled CLI check](review-packet-read.mjs) and
  [captured stdout summaries](review-packet-read-results.json). Root `bun typecheck`,
  final CLI package typecheck, `bun run check` and `bun run test` exit 0. CLI has
  21 passing tests, including three new command tests and expanded packaged cases;
  core has 486, Mermaid adapter 38 and workbench 106. The full suite has no failures.
  `bun run --filter @opsydyn/foldkit-zloz docs` exits 0 and emits the new CLI summary
  and updated protocol/diagnostic contracts.
  Both compiled Node/Bun evidence runs assert equal inspection data, empty stderr,
  correct 0/2 exit codes and preserved input.
- **remaining uncertainty:** validation means self-consistency, not author trust,
  compatibility or renewed loss consent. The 1 MiB byte cap and decoder shape limits
  are not wall-clock or peak-memory guarantees. The response wrapper's `.data` must
  be extracted explicitly before passing it as a raw packet. No Mermaid execution,
  model/graph import, input-file write, workbench opening UI, hosted qualification,
  deployment, npm publication, PNG or Alchemy is introduced. Architecture/boundary,
  delivery and test reviews are self-review, with these runtime and host/UI limits.
- **next:** needs review — add guarded read-only workbench packet opening, preserving
  the working editor and last good review on failure. Keep PNG and Alchemy deferred.

See [ADR 0058](../../../docs/adr/0058-inspect-review-packets-through-effect-cli.md).
The result artifact summarizes actual JSON stdout; complete inspected packet equality
and input-file preservation are asserted by the script and packaged consumer tests.
