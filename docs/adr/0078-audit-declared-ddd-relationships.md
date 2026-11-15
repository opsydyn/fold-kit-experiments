# ADR 0078: Audit declared DDD relationships without inference

## Status

Accepted for the approved headless package slice, 2026-11-13. Architecture,
boundary, delivery and test-quality reviews are self-review. Boundary verdict:
**safe with noted convention limits**. Extends
[ADR 0038](0038-define-ddd-relationship-contracts.md) and the
[domain reconciliation](../assessments/2026-11-13-zloz-domain-compatibility-reconciliation.md).

## Decision and input boundary

Core exports `auditDddRelationships(graph, options)` and dedicated report, entry
and code types. Reuse `ZlozDddRelationshipOptions`, `checkedDddRelationshipRules`,
`dddRelationshipKey` and `resolveDddRelationship`; no parallel DDD grammar.
Validate the typed graph structurally before projecting entries. Invalid graphs
throw the existing invalid-graph error rather than becoming semantic findings.
Invalid convention catalogues throw invalid-edit even on empty/unrelated graphs.
This is not an untrusted text decoder; callers decode wire data first.

Every authored edge produces one entry, sorted by UTF-16 edge ID independently of
graph-array order and locale. DDD descriptors resolve as typed-compatible or
blocked under the supplied/default convention. Untyped and other-family edges
are unrelated; do not infer DDD from node roles, labels or causal conventions.
Entries include detached edge ID/label, endpoint IDs, descriptor, convention key,
code and message. Copy nested upstream lists through the shared architecture
copy helper with a DDD-preserving internal overload. Do not include graph data,
caller endpoint extras, policies, callbacks or rule object references.

The report has compatible/incompatible status, edges/typed/unrelated/blocked
summary and entries. Compatible means zero blocked DDD edges under this catalogue,
not all edges typed or universal architecture correctness. A custom catalogue
replaces the default, matching current resolver behavior. Unknown custom roles
remain portable but blocked under a catalogue that does not declare them.
Optional side-role absence is valid. Strategic self-links, participant mismatch
and unsupported participants use current decisions/messages. `feeds` retains
existing explicit source-role restrictions. No aggregate ownership inference,
cycle rules, topology advice, runtime semantics or implied Apply authorization.

## Ownership, alternatives and consequences

A report is a synchronous detached read-only projection, not another persisted
model or graph mutation. No graph/snapshot/model/edition/receipt version changes,
Undo entries, imports, Commands or UI peers. No CLI, workbench, audit-delta or
packet integration in this slice. Existing causal audit behavior is untouched.
No dependency, publishing, deployment or provider changes.

Renaming the causal audit would falsely interpret DDD through EventStorming rules.
Duplicating DDD checks would diverge from editing policies. A generic cross-family
framework would couple reporting vocabulary before a concrete consumer needs it.
A small DDD-specific projection over the existing resolver keeps the boundary
explicit. It repeats only the report assembly pattern, not domain validation.

Costs: graph validation and per-edge resolver/catalogue checks are not a new
large-model performance guarantee. Diagnostic prose and convention-specific status
must not be sold as architectural certification. Report types become a public
compatibility obligation after release. Root import remains Node/Bun safe and
without required Foldkit/Effect peers. Before release, rollback is a local revert.

## Implementation and verification

- `src/ddd-relationship-audit.ts` owns the projection and public report types;
  `src/index.ts` exposes it. Reuse existing errors/resolver/copy boundary.
- `src/architecture.ts` adds a type-preserving DDD overload to its existing internal
  copy function; runtime copy behavior does not change.
- Literal wire/report fixtures qualify valid tactical/strategic/feeds, bad roles,
  self-context strategic links, unknown custom and unrelated families/untyped edges.
- Test custom catalogues, invalid rules on empty/unrelated graphs, UTF-16 order,
  source/editor history invariance and nested descriptor/endpoint detachment.
- Test invalid graph/descriptor rejection separately from semantic findings.
- Exercise actual installed Node/Bun and strict TypeScript consumers without UI
  peers, run root check/typecheck/full tests, and generate API docs.

Next: compose a read-only DDD audit review surface after this report is qualified;
no follow-on implementation is authorized by this ADR alone.
