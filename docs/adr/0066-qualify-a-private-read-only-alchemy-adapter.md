# ADR 0066: Qualify a private read-only Alchemy adapter

## Status

Accepted for the approved qualification slice, 2026-11-13; not production adoption.
Architecture, boundary, delivery and test-quality reviews are self-review.

## Decision and scope

Extend the isolated private `experiments/alchemy-domain-fidelity` candidate with a
packed root adapter entry, `projectAlchemyModel`. Qualify it against core source
`aaa1186`, not the previously published 0.3.0 artifact, which predates these native
contracts. Refresh only the experiment's core-tarball integrity, explicitly; do not
change core dependencies, root catalogs/lockfile, hosting or npm release allowlists.

Use the exact beta.85 Domain public declarations, static `Domain.verify`, existing
bounded extraction, identity/alias and coverage logic. The caller supplies
`declaredPackageVersion`; reject other versions before touching its model. This is
an explicit compatibility claim supplied by a trusted host, not authentication or
automatic discovery of every declaration's originating installation. Consumer
qualification separately checks the actual installed package version/integrity.

Stateful views with a declared state Schema become native DDD read-model nodes.
Inspect only Schema presence, not its AST, values or handlers. Stateless views,
streams, projections, sagas and other uncovered semantics retain findings; do not
coerce them to read models. Retype a `feeds` source relation only when the new core
`resolveDeclaredConsumption` accepts its exact mapped endpoints. All other source
facts/IDs remain covered and losses visible. Static declarations never prove event
filters, runtime delivery, permissions, handler effects, consistency or replay.

Return an immutable read-only review projection with source provenance, native
binding evidence, graph, findings and coverage. Expected version/identity/definition
failures return blocked results without a partial graph. Unexpected inspection
failures have a generic reason, not leaked exception data. The API provides no
Apply, editor mutation, command sends, Layers, clients, stores or provider calls.
Read-only means extraction/projection does not mutate the source; the returned graph
is not itself permission to replace a live editor.

Package privately with only required built modules and docs; do not ship synthetic
fixture handlers. Test installed exports outside the monorepo under Node/Bun and
strict NodeNext/Bundler, with no Foldkit/React installed. Preserve the original
spike's golden expectations; add independent native graph expectations. Retain the
omitted-read strict-optional failure as a compatibility gate, not a suppressed
compiler error. No new workbench workflow or production adapter workspace yet.

## Alternatives and consequences

Adopting a production workspace/package now could imply general compatibility while
the pinned strict-optional issue remains. A source-only experiment would not prove
installed exports. Retyping every view or source relation would silently invent
semantics. A private packed candidate provides reviewable evidence with a bounded
supported subset; a later explicit extraction/release decision remains necessary.

Verify exact version rejection before model access, identities/collisions/aliases,
stateful versus stateless mapping, source coverage, rejected definitions, no handlers,
no mutation, core edition differences and v1 round trips. Run existing spike and
new adapter tests, outside-repo packed consumer, retained negative compile probe,
root typecheck/check/all tests. Stop if private runtime state, untrusted module
loading, dependency upgrades or provider execution become necessary. Rollback is
revert of the candidate qualification and documentation; no external state changes.
