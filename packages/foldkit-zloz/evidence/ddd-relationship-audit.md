# Headless DDD relationship audit — local qualification

- result: complete
- claim: the core package exposes a deterministic, detached DDD convention audit with explicit unrelated edges and no inference or graph mutation.
- evidence: literal graph/report fixtures, focused regressions, installed Node/Bun and TypeScript consumers, root check/typecheck/tests and generated API documentation.
- remaining uncertainty: no CLI/UI/delta integration, additional DDD topology rules, performance budgets, real-user, browser/manual AT, hosted or registry qualification is established by this headless slice.
- next: expose the report through the Effect CLI with structured JSON and explicit validation/incompatibility exits; keep causal commands family-scoped.

## Contract and ownership

[ADR 0078](../../../docs/adr/0078-audit-declared-ddd-relationships.md) defines
`auditDddRelationships`, `ZlozDddRelationshipAudit`, entry and code types. The pure
core function validates the typed graph, validates the convention catalogue even
on empty/unrelated graphs, and delegates DDD meaning to `resolveDddRelationship`.
Custom rules replace defaults. All authored edges appear in UTF-16 ID order.

Typed-compatible and blocked entries preserve authored DDD descriptors and copied
upstream lists; untyped and other-family edges are unrelated, without inference.
No host data, callback, endpoint extra or rule object is included. Optional side
roles remain absent. Compatible means zero blocked DDD edges under this catalogue,
not universal correctness or full typing. Malformed syntax is a structural error,
not an invented semantic finding. Existing causal reports remain family-scoped.

No graph/editor/policy/Undo or wire changes. The existing internal architecture
copy helper gains a DDD-preserving overload; its runtime copy behavior is unchanged.
Core has no new browser/Effect/CLI dependency. This is not a decoder, report archive
format, Apply authorization or implementation of Context Mapper's full grammar.

## Behavioural evidence

[Literal v1 graph](../test/fixtures/ddd-audit-v1.json) and
[independent expected report](../test/fixtures/ddd-audit-report.json) are written
records, not generated from the encoder/audit under test. Their 11 authored edges
produce exactly 4 typed-compatible, 5 blocked and 2 unrelated entries. They cover
feeds, tactical emits, strategic influence, absent side roles, incompatible roles,
unknown custom convention, same-context strategy and foreign participants.
An accented edge ID catches locale-dependent ordering.

[Regression tests](../test/ddd-relationship-audit.test.ts) also verify:

- Node/edge array reordering leaves the exact report unchanged.
- Custom catalogue replacement changes declared findings without changing source.
- Mutating reported nested annotations/endpoints cannot mutate graph data;
  later source mutation cannot rewrite the saved report.
- Empty labels and optional annotation absence are preserved; host extras are omitted.
- Empty and unrelated graphs report compatible with typed count zero.
- Duplicate/empty/scope-invalid/direction-invalid catalogues reject on empty and
  unrelated graphs with invalid-edit. Bad endpoints, duplicate edges, missing
  nodes and malformed descriptor syntax reject with invalid-graph.
- Serialized editor state and Undo remain unchanged. Causal audits still treat DDD
  edges as unrelated.

The original red run failed because the approved new export did not exist:
`/private/tmp/zloz-ddd-audit-red.log`. Focused DDD/causal tests subsequently pass
(17 tests; Bun records 92 expect calls, with additional Node strict assertions).
The first focused typecheck caught JSON fixture literal widening in Bun's typed
matcher; Node deepStrictEqual preserves exact structural comparison without a
cast. Lint required error-code assertions to use Node error match objects rather
than unknown-typed predicate parameters. Both test-harness issues were corrected;
no failure was treated as passing evidence.

## Installed and workspace verification

[Installed consumer test](../test/package.test.ts) compiles and executes the new
report/code/entry types against packed artifacts. It checks the literal graph,
summary and ID ordering, and rejects an inferred status at type level. Node/Bun
execution and strict Bundler/NodeNext typechecks (including exact optional fields)
run before UI peers are installed, retaining the peer-free root guarantee.

Host-captured local commands:

- Baseline root `bun typecheck` and `bun run check`: exit 0.
- Focused regression tests and core typecheck: exit 0.
- Final root `bun run check`, `bun typecheck` and `bun run test`: exit 0.
- `bun run --filter @opsydyn/foldkit-zloz docs`: exit 0; generated TypeDoc includes
  the public report/function and landing-page links.
- Local documentation links and `git diff --check`: pass.

Logs: `/private/tmp/zloz-ddd-audit-{focused,core-types,final-check,final-types,final-tests,api-docs}.log`.
Existing workspace advisories/configured skips remain. Generated API output is
ignored build output, not a deployment. No new screenshot is claimed: no UI was
added. Test passing does not refresh previous visual or performance evidence.

## Self-review

Architecture/boundary: **safe with noted convention limits**. Read-only report
assembly reuses current validation and descriptor-copy ownership. There is no
cross-family generic framework or duplicate DDD grammar. Input graph validation
is explicit; arbitrary untrusted objects require a separate decoder boundary.

Delivery: existing public APIs and causal behavior remain unchanged. Source,
Undo, optional policies and publication state are untouched. Report types add
unreleased public surface; no consumer migration or new wire format is required.

Test quality: exact independent fixtures catch skipped/wrongly inferred edges,
wrong resolver codes, missing annotations and incorrect summaries. Reordering and
mutation tests catch unstable order and shallow copies; invalid empty-catalogue
cases catch validation hidden behind a loop. Installed tests qualify real exports,
not workspace aliases. These tests do not establish performance or usefulness
with actual architecture reviewers. No independent/delegated agent was used.

Recommendation: **needs follow-up** for CLI/review/comparison surfaces and the
remaining D/C/Q gates. The approved headless audit slice is ready for local commit.
Nothing was pushed, published or deployed.
