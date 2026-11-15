# ADR 0057: Decode portable review packets strictly

## Status and scope

Accepted for the approved package-level decoder slice, 2026-11-13. Extends
[ADR 0035](0035-export-portable-review-packets.md) and the P1 core completion criterion.
Architecture/boundary, delivery and test-quality reviews are self-review: safe with
noted risk. No new dependencies, wire version, IO, model import, editor mutation,
CLI commands, workbench opening UI, PNG, Alchemy or publication are introduced.

## Decision

Expose `parseReviewPacket(text, options?)` in the optional Mermaid adapter. Return
`parsed` with an owned deeply frozen packet, or `rejected` with code, reason and a
JSON Pointer path (empty string for root). Malformed input is data; invalid configured
budgets throw the existing core configuration error. JSON parsing is not permission
to execute Mermaid, import a graph, edit a model or trust an author's identity.

Defaults: 2,000,000 UTF-16 code units, depth 64, 100,000 JSON values. Optional
`maxCharacters`, `maxDepth` and `maxValues` are positive safe integers capped at
16,000,000 / 128 / 1,000,000 respectively. Scan nesting and decoded duplicate property
names before JSON.parse; reject duplicate keys even when escaped differently. Count
values and reject non-finite numbers before reconstruction. Traversal and freezing
are iterative, without spread-based argument lists that can overflow on wide arrays.
Limits bound input shape, not a wall-clock or peak-memory service guarantee; hosts
may choose smaller budgets or a worker when responsiveness requires isolation.

Require the exact review format, version 1, selected-snapshots scope, identities,
source discriminants, convention interpretation and complete projection options.
Use existing core snapshot validation. Build a temporary owned document containing
only the chosen baseline/selected editions and current selection; never invent
archive provenance. A shared edition ID requires identical names and snapshots.
Current and same-edition comparisons remain valid.

Recompute the full packet through `createReviewPacket`: audits, deltas, diagnostics,
Mermaid sources and identity/fidelity mappings. Builtin conventions must match the
current v1 builtin catalogue; custom catalogues are validated portable data. Compare
the complete JSON wire representation with object-key order ignored and array order
retained. Unknown fields or stale/tampered derived sections reject. Return the
recomputed owned value rather than the claimed audit/projections. This checks
self-consistency, not authenticity: a coherently rewritten packet can be valid.
Future interpretation/catalogue changes must preserve v1 semantics or use an explicit
new version/profile; do not silently reinterpret old builtin packets. Diagnostic
text and projection serialization participate in v1 reproducibility too; intentional
changes need an explicit compatibility/version strategy.

## Alternatives and consequences

A shape-only decoder would accept forged findings or Mermaid projections. Silently
replacing mismatched derived fields would hide corruption and violate review trust.
Reusing the existing creator avoids a second audit/projection engine and keeps the
codec peer-free and headless. Costs are synchronous recomputation, conservative
limits and strict compatibility obligations for a portable format.

## Implementation and verification

Add a decoder module, result/options exports, literal v1 fixture and independent
malformed/tampered-input tests. Reuse the creator's data-only option guard internally.
Qualify literal, generated current/edition/self/custom cases, unknown fields,
duplicate escaped keys, finite numbers, depth/width/value/character limits and frozen
ownership. Reproduce a wide-array stack overflow under compiled Node before fixing
it; Bun alone did not reveal the failure. Test object-shaped scalar coercion rejection
and legitimate metadata keys. Exercise real packed Node/Bun consumers and TypeScript
contracts. Run root lint/format, typecheck, all tests and TypeDoc sequentially where
dist builds are shared. Rollback before publication is a local revert without model
migration. CLI inspection and workbench reopening remain the subsequent slices.
