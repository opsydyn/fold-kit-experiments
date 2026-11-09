# ADR 0032: Audit causal relationships through Effect CLI

## Status

Accepted for the approved core audit and agent CLI slice, 2026-11-09.
Boundary review: **safe with noted risk**. Reports classify semantic compatibility
under one selected convention; they do not certify executable business processes.

## Decision

Core audits every authored edge using the existing relationship resolver. Entries
are ordered by UTF-16 edge ID comparison, with distinct typed, inferred, unrelated
and blocked statuses, stable codes, readable messages and endpoint identity.
Compatible entries carry non-null semantic descriptors. Reports omit host data,
rule callbacks and editor/runtime state. They contain counts and overall
compatible/incompatible status, without mutating a graph or stamping inferred
metadata. Empty graphs are valid audits; malformed rule catalogues still reject.
Structural validation remains the graph codec's responsibility.

The standalone Effect CLI adds `relationships audit`. Existing graph/snapshot/model
input uses the current bounded UTF-8 reader and core codec. Model input explicitly
audits only the current graph, with its model ID; editions and lineage are not
implicitly traversed. The additive v1 response has operation relationships-audit,
status audited, scope, convention provenance, report data and semantic diagnostics.
An incompatible audit remains a complete audited response, with exit 1. No blocked
entries yields exit 0, including inferred/unrelated edges. Input/configuration or
invocation failures use existing rejected framing and exit 2. Existing commands
retain their output and exit contracts. CliAuditIncompatible is a distinct typed
Effect error; there is no hand-written argv parser or process invocation at import.

Optional `--rules` loads a version-one data-only catalogue. It replaces defaults,
uses Effect Schema plus the core descriptor/configuration guards, and rejects
unknown fields, duplicate keys, invalid roles and executable-style configuration.
Rules have the same independent 1 MiB UTF-8 budget as model input. A rules file is
read before the model; '-' is rejected for rules, reserving stdin for the model.
The existing scoped input collector is shared internally without changing the
public readGraph/readDocument contracts. Core API callers may supply roleOf;
CLI configuration cannot load code or callbacks.

## Alternatives and consequences

An app-only report or a second CLI validator would duplicate semantic policy.
Treating inferred/unrelated edges as typed would overstate model qualification.
Rejecting all incompatible input as malformed would hide a useful complete audit.
Loading executable convention modules would introduce unnecessary execution and
trust scope. The selected read-only projection keeps agent use deterministic,
structured and independent of browsers, Foldkit views or layout engines.

No dependencies, model/archive migrations, runtime activation, publishing or
deployment. Rollback is a code revert; existing documents are never rewritten.
Architecture, delivery and test-quality reviews are self-review.
