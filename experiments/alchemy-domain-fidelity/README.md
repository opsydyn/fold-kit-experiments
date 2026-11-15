# Private read-only Alchemy adapter candidate

The current qualification adds `projectAlchemyModel` as this private package's
root export. It uses the native read-model/declared-consumption contracts from
**core source `aaa1186`**. This is a privately packed candidate, outside production
workspaces and release allowlists; no npm publication or live integration is implied.

```ts
import { projectAlchemyModel } from '@opsydyn/zloz-alchemy-domain-fidelity-spike';

// Bank is an already-loaded trusted Domain model, never an arbitrary source path.
const plan = projectAlchemyModel(Bank, {
  namespace: 'banking',
  revision: 'edition-1',
  declaredPackageVersion: '2.0.0-beta.85',
});
if (plan.type === 'reviewable') {
  // Review plan.source, plan.graph, plan.findings and plan.coverage together.
  // This is not permission to replace a live editor or execute business commands.
}
```

The exact version claim is checked before model inspection. It is caller-supplied,
not authentication or automatic proof of each declaration's originating package.
Qualification independently checks the installed manifest and artifact integrity.
Expected identity/version/definition failures return blocked results without a
partial graph; unexpected inspection errors return a generic diagnostic.

Stateful views with declared state Schemas map to native DDD read-model nodes.
The adapter checks Schema presence and static definition validity; it copies no
Schema AST, initial-state values, handlers or business payloads into the result.
`feeds` relations acquire native meaning only when core resolves the exact source
and consumer roles. Stateless views remain visibly untyped. Other roles/relations
and excluded schema/behaviour semantics retain findings. The positive bank fixture
covers all 23 topology facts: one native read model, one native consumption edge,
one remaining stream-role gap and seven untyped relationships. Chained stateful
views are deterministic; a stateless producer cannot gain native source meaning
merely because its consumer is a read model.

The original five baseline tests and six new adapter tests pass under Node/Bun.
The actual packed export installs outside the monorepo and passes strict NodeNext/
Bundler compilation without Foldkit or React. Packed files exclude synthetic handlers.

**Compatibility gates:** beta.85 omitted aggregate `read` and stateless view `state`
forms fail strict TypeScript structural typing. Both negative probes are retained;
no flags, casts or dependencies were changed to hide them. The supported typed
fixture declares `read: {}` and state Schemas. The empty read contract belongs to
the synthetic fixture; fixes for existing models must preserve their authored
read semantics. A real JavaScript stateless fixture
qualifies runtime non-coercion separately; it does not establish TypeScript support.

**Core peer caveat:** the local core artifact still says 0.3.0, but published 0.3.0
predates these native contracts. The peer version alone is insufficient. Use the
recorded local source/tarball; publication requires a suitable core version and
separate compatibility qualification. Only the experiment's core tarball binding
was explicitly refreshed; root dependencies and catalogs are unchanged.

[Adapter receipt](evidence/adapter-receipt.md) ·
[Structured qualification](evidence/adapter-qualification.json) ·
[Installed packed consumer](evidence/adapter-consumer.json) ·
[Retained projection/findings](evidence/adapter-projection.json) ·
[Canonical SVG artifact](evidence/adapter-projection.svg).

The reproduction commands below now run both baseline and native-adapter
qualification. `test:consumer` installs the packed root export rather than a copied
adapter source path. The baseline section describes the original conservative
mapper, retained as an independent before/after reference. Its qualification record
has been explicitly rerun against the new local core integrity.

---

# Original declaration-fidelity baseline

Private experiment, not a published adapter or production integration. Approved
scope: [integration review](../../docs/assessments/2026-11-13-zloz-alchemy-domain-integration.md),
[ADR 0064](../../docs/adr/0064-qualify-alchemy-declarations-in-an-isolated-spike.md).
The fixture uses **Domain/Alchemy 2.0.0-beta.85, Effect 4.1.0, TypeScript 6.0.3**.
It sits outside the workspace globs and does not alter root dependencies/lockfile.

## Reproduce

At this checkout, first pack the unchanged production core:

```sh
bun run --filter @opsydyn/foldkit-zloz pack:check
cd experiments/alchemy-domain-fidelity
npm ci --ignore-scripts --no-audit --no-fund
npm test
bun run test:bun
npm run qualify
npm run test:consumer
```

The lockfile binds the local 0.3.0 core tarball from this checkout, not a registry
release. A different core source/package document revision may require requalification
and a new tarball integrity; do not silently refresh the lockfile to hide drift.
Generated `dist` and dependencies are ignored; fixtures/evidence are retained.
Other workspace builds may clear core/dist; repack the local core immediately
before standalone install/consumer checks. A missing archive fails explicitly.
After regenerating JSON evidence, use the repository's Oxfmt before `bun run check`.

## What this proves

The synthetic bank contains an aggregate-root type, two commands sharing an event,
a view, policy and stream. All business handlers throw a typed error if invoked.
The positive fixture declares `read: {}` explicitly; static `Domain.verify(Bank)`
returns no findings. No Layers are built and no clients/stores/providers are used.

The pure experiment extractor reads public declaration fields and produces a
versioned, detached, frozen manifest. It reads names, command/event lists and
source references; it never reads payload values, state or handler implementations.
IDs combine an explicit namespace, model, kind and name with encoded separators.
Distinct declarations colliding on an ID reject; shared declaration objects deduplicate.
Explicit one-to-one identity overrides preserve rename continuity; absent or
colliding aliases reject. Reordering preserves the entire manifest/graph.

The mapper accounts for **8 declarations + 15 relations = 23 source facts**:
8 graph nodes, 8 labelled edges and 7 parent memberships. Missing references block
the entire graph. The bounds limit unique output declarations/relations, not
wall-clock time, peak memory or hostile input execution. Inputs are already-loaded
trusted declarations or the extractor's typed manifest; no arbitrary module loader,
untrusted JSON decoder or production contract is provided.

Supported diagram roles are candidate projections: bounded context, aggregate-root
**type**, command, domain event and policy. Views/streams have explicit `untyped`
labels and per-node losses. All drawn relationships remain semantically untyped,
with source facts and per-edge findings. A declaration of possible production is
not a runtime event, and message flow does not establish strategic DDD influence.
Sagas, APIs, external systems, rejection/schema/routing/handler semantics are not
covered; the manifest explicitly discloses that limit. Public Model.Any does not
provide a complete typed saga inventory. Projection code is present but not
qualified by this fixture; do not count it as supported coverage.

## Golden and history evidence

[Expected source](fixtures/bank-source.json) and [expected graph](fixtures/bank-graph.json)
were authored from the fixed fixture specification, not generated by the mapper.
Tests compare complete results and verify duplicate/alias/missing-source rejection,
coverage, port endpoints, immutability, namespaces, reorder, rename and zero handler
calls. [Second edition](evidence/bank-next.json) adds `WithdrawMoney` and
`MoneyWithdrawn`; core edition comparison identifies exactly those added nodes.

Keep revision provenance on the manifest rather than every graph element. The
[retained failing regression](evidence/revision-provenance-regression.txt) caught
spurious semantic changes when revision metadata was copied into all node data.
The final tests require zero semantic changes among unchanged declarations.
The simple sorted-grid layout still moves existing nodes on insertion; core marks
these as layout changes. Stable IDs alone do not imply a stable incremental layout.
Editor Undo/edition rewind never sends backend commands or replays business history.

[Qualification receipt](evidence/qualification.json) ·
[Fresh outside-repo consumer](evidence/isolated-consumer.json) ·
[Canonical SVG projection](evidence/bank-projection.svg).
SVG is emitted by the existing core writer with its own fidelity findings and
explicit loss opt-in. It is a data/artifact check, not browser/manual acceptance.

## Compatibility finding

[Minimal omitted-read probe](fixtures/strict-optional-repro.ts) fails strict
TypeScript 6.0.3 with `exactOptionalPropertyTypes`: the produced aggregate's
`definition.read: undefined` is incompatible with Aggregate.Any's optional read
contract. [Captured diagnostics](evidence/strict-optional-repro.txt).
`npm run qualify` requires that specific failure; it does not silently turn off
strict optional checking. The real positive fixture uses a valid explicit empty
read contract. No cast, dependency upgrade or upstream modification was used.

The supported fixture/experiment compile under NodeNext and Bundler. A fresh npm
consumer outside the monorepo runs under Node and Bun and installs neither Foldkit
nor React. This qualifies the bounded fixture and entry/dependency boundary, not
every Domain configuration or live runtime. No public package, CLI, workbench
integration, backend transport, deployment or npm publication was added.
