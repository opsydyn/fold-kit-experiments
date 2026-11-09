# Relationship audit qualification

## result

Complete locally. Delivery recommendation: needs review. No publication, deployment or PR was performed.

## claim

The core package provides a deterministic, read-only causal relationship audit. The Effect CLI exposes it through `zloz relationships audit`, including data-only custom conventions and machine-readable diagnostics. Compatible input exits 0, semantic incompatibilities exit 1 after emitting the complete report, and rejected input exits 2.

## evidence

- Root `bun typecheck`, `bun run check` and `bun run test` passed. Real packed consumers qualified the public types and installed CLI under Node and Bun. The core API documentation build passed.
- Focused core, command and input tests passed: 17 tests, 90 assertions. The final command/input rerun passed: 14 tests, 74 assertions. The final CLI typecheck and build passed.
- [Executable evidence script](relationship-audit.mjs) produced a [passing transcript](relationship-audit-results.json) for 14 real Node/Bun scenarios: typed, inferred, incompatible, custom conventions, invalid JSON and reserved rules stdin. Fixture bytes remained unchanged during the audit commands; subsequent formatting only normalizes fixture whitespace.
- Tests cover canonical report order, input immutability, host-data exclusion, custom catalogue validation, ambiguity, current-graph model scope and error/exit contracts. Existing validation, Mermaid and bounded-input regressions passed.
- Initial missing core export and missing CLI command produced failing tests before implementation. A writer-yield regression introduced during lint cleanup was caught by existing command tests and corrected. Effect error framing was kept branch-local to preserve inferred channels without suppressions.
- Architecture, delivery and test-quality reviews were self-review. The audit reuses the existing relationship resolver; no new relationship grammar, runtime dependency or editor state was introduced.

## remaining uncertainty

This is semantic relationship qualification, not structural validation or executable-process certification. Inferred and unrelated edges can be compatible without carrying authored semantics. Model documents audit only their current graph. CLI convention files are data-only; the core callback API remains available to hosts. No new hosted CI, UI, performance or publication evidence is claimed.

## next

Add edition-aware audit comparison against an explicit baseline, reporting introduced and resolved findings through the core API and CLI. This extends the history capability without changing the existing audit contract.
