# Zloz Alchemy adapter (private workspace)

Read-only Domain inspection and portable graph projection. This package is
`private: true`, version `0.0.0`, and is not an npm release candidate.

| Entry                                  | Responsibility                                                          | Required runtime                           |
| -------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------ |
| `@opsydyn/foldkit-zloz-alchemy`        | Validate/serialize a v1 descriptor; recompute graph and findings        | Zloz core only                             |
| `@opsydyn/foldkit-zloz-alchemy/domain` | Inspect trusted, already-loaded Domain declarations; optionally project | Core, exact Domain/Alchemy beta.85, Effect |

The portable entry's JavaScript and declarations have no SDK, Effect, Foldkit or
React imports. SDK/Alchemy/Effect peers are optional so data-only consumers do not
install them. The `/domain` entry requires those peers explicitly.

```typescript
import { inspectAlchemyModel } from '@opsydyn/foldkit-zloz-alchemy/domain';
import {
  projectAlchemyDescriptor,
  serializeAlchemyDescriptor,
} from '@opsydyn/foldkit-zloz-alchemy';

// Bank is a trusted model already loaded by the host. No module loader is provided.
const inspection = inspectAlchemyModel(Bank, {
  namespace: 'example/bank',
  revision: 'v1',
  declaredPackageVersion: '2.0.0-beta.85',
});
if (inspection.type === 'inspected') {
  const portable = serializeAlchemyDescriptor(inspection.descriptor);
  const review = projectAlchemyDescriptor(inspection.descriptor);
  // The host owns saving portable and presenting review.findings before any edit.
}
```

`projectAlchemyModel` in `/domain` composes those steps. `decodeAlchemyDescriptor`
throws `AlchemyAdapterError` with a structured `issue`; `projectAlchemyDescriptor`
converts failures to a `blocked` result without a partial graph. Successful results
are `reviewable`, with the validated source, graph, findings, source-fact coverage,
native read-models and accepted declared consumption. Outputs are detached/frozen.

## Portable contract

Format `foldkit-zloz-alchemy`, version `1`, contains source package version,
namespace/model/revision, declaration IDs/locators/kinds/names, explicit
`viewState: 'declared' | 'absent'` on views, and directed source relations. It does
not accept graphs, findings, schema ASTs, handlers, permissions or verification
assertions. Projection recomputes its output each time.

The decoder accepts unknown **data objects**, not raw JSON text. Hosts own input
byte limits, framing and duplicate-key handling before decoding. Plain own-data
records and dense arrays are checked; unknown/accessor/symbol fields are rejected.
This is not a JavaScript sandbox: do not pass hostile executable objects or proxies.
Raw limits are 256 declarations and 1,024 relations, names 256 characters, identities
16,384 and relation IDs 65,536. Identity text must be well-formed Unicode. Required
fields, uniqueness, locators, canonical relation IDs, endpoint kinds and complete
model membership are validated before graph emission.

`alchemySourceId(namespace, modelName, kind, name)` creates encoded locators. IDs
normally equal locators; explicit `identityOverrides` on inspection preserve IDs
across renames. Portable descriptors retain both. Sorting is canonical; revision
lives in source provenance rather than every node's semantic metadata. Automatic
layout is a deterministic preview, without a stable incremental-layout guarantee.

State presence and upstream version are **host-authored claims**, not authenticated
proof, execution capability or editor permission. The portable entry never imports
or statically verifies a Domain model. Only `/domain` calls `Domain.verify`, and
only after checking the caller's exact version claim. It does not invoke business
handlers, Layers, clients, stores or providers. No Apply or runtime integration is
provided.

## Explicit compatibility gates

- Qualified SDK pair: `@alchemy.run/domain@2.0.0-beta.85` and
  `alchemy@2.0.0-beta.85`, with `effect@4.1.0` and TypeScript `6.0.3`.
  Other versions are unqualified; inspection blocks a different version claim.
- Qualified core is this branch's native read-model/declared-consumption artifact
  (contract introduced at `aaa1186`). Its manifest still says `0.3.0`, but the
  **published 0.3.0 lacks these contracts**. Peer metadata is not proof of published
  compatibility. Do not install the registry core and infer support.
- Two beta.85 negative TypeScript probes remain gates with
  `exactOptionalPropertyTypes`: omitted Aggregate `read` and stateless View
  `state` fail SDK structural typing. Positive synthetic fixtures declare explicit
  read definitions and state schemas. This is not advice to change production read semantics to
  silence a compiler. Runtime stateless data remains non-native and reports loss.
- Stateful views map to native DDD read-models; feeds become declared consumption
  only when core accepts both endpoints. Streams and other relation meanings
  retain source metadata and visible findings. This does not claim full Domain
  fidelity, event processing, schema validation, routing or framework compatibility.

The bank fixture retains all 23 source facts (8 declarations, 15 relations), one
native read-model and one native feed, while reporting the stream gap and seven
untyped relations. Edition comparisons retain IDs and semantic continuity.

## Verification

```sh
bun run --filter @opsydyn/foldkit-zloz-alchemy typecheck
bun run --filter @opsydyn/foldkit-zloz-alchemy test
bun run --filter @opsydyn/foldkit-zloz-alchemy pack:check
```

Tests include a literal descriptor, malformed/protected inputs, real SDK poison
handlers, aliases/reorder/editions, both negative compiler probes and disposable
packed consumers outside the monorepo. Consumers exercise Node/Bun and strict
NodeNext/Bundler profiles; the portable consumer installs no SDK/Effect/Foldkit/React.
See [qualification evidence](evidence/qualification.md) and
[ADR 0067](../../docs/adr/0067-split-private-alchemy-inspection-and-portable-projection.md).
No browser, provider, deployment, publication or user-acceptance claim is made.

## Local workbench review

The Zloz workbench's **Domain review** sidebar demonstrates this portable entry
with paste/file text decoding, detached read-only preview, declared provenance and
visible losses. Its host boundary is limited to 1 MiB UTF-8, depth 16 and 16,384
values, rejecting duplicate keys and bad framing before projection. It does not
load the SDK or execute uploaded code. This is local demo evidence, not publication
or broader compatibility. See [workbench qualification](../../apps/zloz-demo/evidence/alchemy-review.md).
