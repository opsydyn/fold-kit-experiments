# Effect CLI C4 receipt inspection qualification

- result: complete
- claim: C4 receipt inspection reports validated provenance, changes and recorded losses as read-only JSON with explicit 0/1/2 exit semantics.
- evidence: literal-receipt command tests, installed Node/Bun consumers, local binary transcript and repository checks recorded below.
- remaining uncertainty: receipts are unsigned consistency evidence; authorship, historical human review, hosted CI/registry qualification and complete roadmap closure remain unverified.
- next: reconcile remaining domain/agent and compatibility criteria before selecting another core feature.

See [ADR 0091](../../../docs/adr/0091-inspect-c4-receipts-through-effect-cli.md).

## Contract and tests

`zloz c4 receipt inspect` uses the existing bounded 1 MiB file/stdin reader and
strict core receipt parser. The pure CLI projection composes existing plan losses
and history comparisons without duplicating conversion/containment validation.
The command entry module owns Effect orchestration, typed failures and output.
There is no Apply import/call, session activation, source rewrite or new dependency.

Three new command tests cover full source/camera/edition/ancestry provenance,
target/choices equality, stable ID-sorted before/after changes, recorded loss
findings and successful loss-bearing inspection; format/version incompatibility
(exit 1); invalid core data, malformed JSON/markers, unknown reserved fields,
missing/oversized input and absent Apply flags (exit 2). No rejected response has
inspection data. File bytes remain unchanged. Existing I/O tests retain output
failure/terminal/stdin behavior. Installed consumer qualification exercises Node
and Bun binaries, valid/unsupported/forged/invalid-UTF-8 inputs and public response
types, including a negative authority fixture.

The initial tests failed at the missing command. One expected row order was corrected
to the existing history API's documented stable ID ordering. Lint checks exposed
that Effect orchestration belongs in the existing CLI entry-module seam rather
than a newly wrapped workflow helper; the final new module is a pure projection,
and the entry point uses the existing one-Effect.gen pattern. No lint rule was
weakened. A temporary mutation replaced strict core parsing with JSON.parse: the
invalid-data/failure-exit test failed. Restoring the source returned all focused
C4 command tests to green. No mutated source remains.

## Process evidence

After building, `node packages/foldkit-zloz-cli/evidence/c4-receipt-inspect.mjs`
runs actual Node/Bun binaries with 18 file/stdin and rejection cases. The script
checks exit codes, one JSON stdout frame, empty stderr, exact source/target/choice
preservation and unchanged source-file bytes. It captures
[the transcript](c4-receipt-inspect-results.json) and
[a full valid report](c4-receipt-inspection.json). These are synthetic local inputs,
not a claim of human review or hosted deployment. No screenshots are needed for
this headless command; browser receipt review evidence remains separate.

Full workspace typecheck, an additional final CLI typecheck, lint/format, local
build and the **18-case** binary transcript passed with exit 0. The installed
consumer suite has passed all **31 CLI tests**, including real Node/Bun binaries
and public TypeScript contracts. Full `bun run test` completed with exit 0 across the workspace. Existing configured warnings/skips remain; no warning-free claim
is made. Architecture, boundary, delivery
and test-quality reviews are self-review. The CLI's 1 MiB resource bound is explicit
and differs from the workbench's 5 MiB bound. No npm publishing or deployment.

Recommendation: **needs follow-up** for roadmap/compatibility reconciliation.
