# DDD Effect CLI audit — local qualification

- result: complete
- claim: `zloz ddd audit` exposes the exact core convention report through versioned JSON with explicit compatible/incompatible/input exits and bounded data-only custom rules.
- evidence: command/service tests, actual installed Node/Bun binaries and strict consumer types, process transcript, root checks and API docs.
- remaining uncertainty: no DDD edition comparison, workbench UI, general DDD certification, performance budgets, registry/hosted or provider qualification is established here.
- next: package-owned read-only DDD findings and navigation in the workbench; keep edition comparison separately scoped.

## Contract and boundaries

[ADR 0079](../../../docs/adr/0079-expose-ddd-audit-through-effect-cli.md) records
Effect command/Schema/platform ownership. Command implementation remains in the
Effect adapter; core owns `auditDddRelationships`. There is no manual argv parser,
new runtime framework, graph grammar or network command. Input files are read-only.

The new `ddd-audit` operation is additive to `foldkit-zloz-cli/v1`, with audited
status, current-graph scope, modelId/convention provenance, core report and blocked
edge diagnostics. Dispatch by operation as well as status. Incompatible reports
exit 1 with audited data; invalid input/rules exit 2 with rejected JSON and no audit
data. Invalid invocation uses JSON stderr and empty stdout. Compatible includes
no DDD coverage; inspect typed/unrelated counts rather than assuming certification.

Graph/snapshot/model input shares existing bounded UTF-8/JSON reading and core
codecs. Models audit the current snapshot only, not editions or lineage. Optional
DDD rule files replace defaults, reject unknown fields and non-DDD descriptors,
and undergo core rule validation before reading model input. They are independent
from causal files; `--rules -` rejects because stdin belongs to the model. Rule
provenance is a filename, not an embedded catalogue or content attestation.

No source/model/Undo changes, DDD comparison, automatic fixes, UI, dependency,
manifest or publication changes. Existing causal commands retain their behavior.
The earlier private-guard/release follow-up remains open in this isolated branch.
Local tarball packing/installing is qualification, not npm publication.

## Command and fixture evidence

The [literal core input](../../foldkit-zloz/test/fixtures/ddd-audit-v1.json) and
[independent expected report](../../foldkit-zloz/test/fixtures/ddd-audit-report.json)
qualify all 11 projected edges exactly, including Unicode ordering, role errors,
custom/strategic/feeds meaning and unrelated entries. CLI diagnostics are checked
against the literal report, not a second call to core under test.

[Injected command tests](../test/commands.test.ts) cover:

- Exit 1, one stdout record, exact core data and per-edge diagnostic projection.
- Compatible graph/snapshot/model inputs; current model only despite an incompatible
  archived edition; empty/unrelated graphs; no causal behavior change.
- Custom DDD catalogue success and byte-for-byte preservation of model/rule files.
- Version/excess fields, causal descriptors, non-DDD/empty/scope-invalid participant
  lists, duplicate rule keys, invalid direction and invalid side-role fields.
- Rules are validated before model reading; malformed JSON, oversized rules/stdin,
  unavailable files, malformed DDD descriptors/port direction and forbidden rules
  stdin yield input rejection, not an audit.

Focused DDD command tests: 5 pass, 85 assertions (includes the existing mixed-family
regression). The red run explicitly rejected unknown subcommand ddd before code was
added: `/private/tmp/zloz-cli-ddd-red.log`. Initial lint rejected sequencing inside
Option.match and piped generator yields; the workflow was split into named Effects
and checked again without suppression. API-doc generation then exposed a union-
Effect inference issue not reported by the workspace compiler. A named guarded
reader, following the existing causal reader pattern, fixed it without manual
Effect channel tuples; CLI types, affected tests, installed binaries and
API docs were rerun. No failed check is counted as a pass.

[Installed-binary tests](../test/package.test.ts) run actual local tarballs under
Node and Bun, checking help, 0/1/2 exits, stdout/stderr isolation, exact report data,
custom rules, invalid UTF-8/JSON/limits/family/options and unchanged files. Strict
Bundler/NodeNext consumers narrow the new response operation and reject inferred
DDD count fields at type level. Existing 130/SIGINT and other command tests remain.
No timeout or existing test was weakened.

## Process transcript and verification

[Reproducible process script](ddd-audit.mjs) and [captured transcript](ddd-audit-results.json)
exercise real workspace-built Node/Bun binaries for compatible empty, incompatible,
custom-compatible, invalid document/rules source and invalid invocation cases.
They assert one JSON value, exact core report, clean output channels and preserved
inputs. Temporary catalogue paths in the transcript belong to the fixture and
are cleaned up; the script contains the complete catalogue for reproduction.

Host-captured local commands:

- Baseline root `bun typecheck` and `bun run check`: exit 0.
- Focused command tests and CLI typecheck: exit 0.
- Final root `bun run check`, `bun typecheck`, `bun run test`: exit 0.
- API documentation generation: exit 0.
- Process qualification script and local link/diff checks: pass.

Logs: `/private/tmp/zloz-cli-ddd-{focused,types,final-check,final-types,final-tests,api-docs,process}.log`.
Existing advisories and configured skips remain. API output is a local ignored
build artifact. This CLI slice adds no visual UI, so no screenshot is claimed.

## Self-review

Architecture/boundary: **safe with noted convention/protocol limits**. Schema
validates transport; core validates DDD conventions and projects reports. Named
Effects handle I/O and errors; runtime starts only in the existing binary boundary.
A separate namespace avoids conflating causal and DDD convention schemas.

Delivery: old operations/shapes remain. The new audited response is distinguished
by operation. Expected semantic/input/invocation errors have explicit existing
exit-code markers, not ad hoc process.exit calls. Files are never rewritten.
Publishing, package version bumps and release guards were not changed or activated.

Test quality: literal reports prevent a command test from merely accepting any
core-shaped output. Real process tests distinguish output channels and exits from
in-process Effect success/failure. Invalid rule files exercise both Schema and
core semantic validation even before empty models. Resource/interruption tests
are existing shared-reader proof, not a new family-specific cancellation claim.
No independent/delegated agent was used. No live user or performance measurement.

Recommendation: **needs follow-up** for read-only review/navigation and DDD deltas;
this approved CLI slice is ready for local commit. Nothing was pushed or published.
