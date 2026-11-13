# ADR 0079: Expose DDD audit through the Effect CLI

## Status

Accepted for the approved CLI slice, 2026-11-13. Architecture, boundary, delivery
and test-quality reviews are self-review. Boundary verdict: **safe with noted
convention/protocol limits**. Extends [ADR 0016](0016-ship-a-standalone-effect-cli-for-zloz.md)
and [ADR 0078](0078-audit-declared-ddd-relationships.md).

## Decision

Add `zloz ddd audit` to the existing `effect/cli` command tree. Keep
`relationships audit/compare` causal and unchanged. DDD uses public core
`auditDddRelationships`; do not duplicate rules or infer domain meaning in the CLI.
Accept canonical graph/snapshot/model documents via existing `--input/-i`, bounded
UTF-8 input and codecs. For models, audit only the current graph and include modelId;
no implicit edition selection or comparison.

Optional `--rules <file>` reads a separate version-one data-only DDD catalogue.
Schema validates version, excess fields, DDD descriptors, participant role strings,
label and direction. The core catalogue validator (through an empty-graph audit)
checks semantic rule validity before reading the model. Custom catalogues replace
defaults. Stdin is reserved for model input. Reuse the 1 MiB scoped UTF-8/JSON reader;
no callbacks, arbitrary code or network data sources are accepted. Do not reuse
EventStorming's transport schema for DDD rules.

Extend `foldkit-zloz-cli/v1` with operation `ddd-audit` and an operation-discriminated
response branch. Completed audits use status audited, scope current-graph, modelId,
conventions provenance, the exact core report and blocked-edge diagnostics prefixed
`ddd-relationship-`. Incompatibility is an audited result, not malformed input.
Emit one JSON value plus newline on stdout. Invalid invocation keeps stdout empty
and uses the existing JSON stderr presenter. Old operations/shapes are unchanged;
this additive operation does not authorize a new core/report wire format.

Exit contract: 0 means compatible under the selected catalogue (including no DDD
coverage); 1 means audited incompatibility; 2 means invalid input/rules/I/O/options.
Explicit help/version and SIGINT retain current Effect CLI behavior. Reuse the
existing typed CliInputError/CliAuditIncompatible markers and output framing.
Optional role absence and unknown custom convention behavior come from core.
No source files are rewritten, nor graph/Undo/model semantics changed.

## Alternatives and consequences

A family flag on causal commands would couple incompatible convention schemas and
risk changing existing agent output. A generic audit framework would broaden this
slice before a consumer needs one. A separate DDD namespace over the same I/O,
protocol and Effect services preserves family ownership and reuse. Schema role
vocabulary must track the supported core roles deliberately; version-one rule files
are not a DSL or universal DDD correctness contract.

Core stays pure and peer-free. Effect/platform services remain in this adapter;
runtime starts only in bin.ts. No manual argv parser, synchronous file reads,
Mermaid parser, browser UI, audit comparison or automatic Apply. No dependencies,
manifest, publish selectors, npm publication, deployment or provider activation.
The previously documented private-guard/release follow-up remains separate.
Rollback before release is a local revert and rebuild; no persistent data migration.

## Implementation and evidence

- `src/ddd-relationship-rules.ts`: bounded Schema decoding and core catalogue check.
- `src/index.ts`: Effect command/execution; `src/protocol.ts`: additive response type.
- Literal mixed graph/report from the core audit fixture qualifies exact projection.
- Test 0/1/2, empty/unrelated coverage, graph/snapshot/model scope, custom rules,
  invalid syntax/catalogues/excess fields/families, stdin/file limits, preservation
  and unchanged causal behavior through injected services and real binaries.
- Install actual local tarballs and execute Node/Bun; inspect stdout/stderr and help.
- Run root check/typecheck/full tests and API docs. Record evidence separately from
  registry/hosted state; local packing is qualification, not npm publication.

Next: compose package-level read-only DDD findings and navigation in the workbench,
then consider edition-aware DDD comparison separately.
