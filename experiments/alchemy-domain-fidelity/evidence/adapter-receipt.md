# Read-only adapter candidate qualification

- **result:** complete
- **claim:** the approved optional read-only adapter qualification is implemented
  as a privately packed candidate against native core source `aaa1186`. It projects
  qualified stateful views/consumption and retains explicit gaps and provenance.
  It is not a production workspace or general framework compatibility claim.
- **evidence:** eleven Node/Bun behavioural tests, exact installed package metadata,
  literal baseline golden expectations with independently specified native changes,
  both strict TypeScript profiles, fresh installed-package exports outside the
  monorepo, source fact/identity/edition checks and retained negative compile probes.
  Root typecheck/check/all tests pass. Reviews are **self-review**.
- **remaining uncertainty:** omitted-read and stateless-view beta.85 forms fail
  strict optional structural typing; published core 0.3.0 lacks these new contracts.
  Streams and seven relationship meanings remain untyped in the bank fixture.
  Schemas/rejections/handlers/routing, sagas, APIs, arbitrary source loading, untrusted
  descriptor parsing, live/runtime/provider/browser/device/AT and user-value
  qualification remain outside this candidate. Version claims are host supplied.
- **next:** extract a private workspace adapter with separate Domain inspection and
  portable validated projection entries; retain compatibility/source-fidelity gates
  before broader support or release. Recommendation: **needs review**.

## Supported path and exact observed output

Pinned Domain/Alchemy **2.0.0-beta.85**, Effect **4.1.0**, TypeScript **6.0.3**.
Node **24.15.0**, Bun **1.4.4**. Actual installed metadata and tarball integrities
are recorded in [adapter qualification](adapter-qualification.json).
Only this experiment's local core tarball integrity was intentionally refreshed;
no root dependency/catalog/lockfile or core package source changed.

`projectAlchemyModel` rejects unsupported declared versions before touching model
properties. It uses the pinned public static definition verifier and the existing
bounded extractor. Identity collisions, absent aliases and invalid definitions
return blocked results with no partial graph; unexpected exceptions do not leak
exception data. No Layer, command, client, store, handler or provider is executed.

The positive bank has **8 declarations and 15 relations**, all 23 covered source
facts. It emits eight nodes/eight edges: one stateful view becomes a native DDD
read model, and one `feeds` relation is accepted by `resolveDeclaredConsumption`.
Only their previous untyped-role/relationship findings are removed. One stream
role gap, seven untyped relationships and broader topology/behaviour limitations
remain visible. Metadata records the state-Schema basis, not a runtime equivalence
or consistency assertion. Schemas/initial values/handlers are not serialized.

Reordering commands or multiple views preserves the whole projection. A chained
stateful view gets a second native feed. A stateless view remains labelled untyped;
a stateless producer cannot acquire feed semantics from its native consumer.
Aliases retain explicit rename continuity; namespace/source identities survive
serialization. A second edition adds exactly `WithdrawMoney`/`MoneyWithdrawn`
without false semantic changes among existing declarations. Simple layout movement
remains distinct from semantic change. Source objects and returned projections
are not mutated by review; outputs are detached/frozen. Business handler count is 0.

## Installed export and compatibility boundaries

[The outside-repo consumer](adapter-consumer.json) installs the **actual npm-packed
private root entry**, checks its public TypeScript API with NodeNext and Bundler,
and executes it under Node/Bun. Neither Foldkit nor React is installed. The packed
file list excludes fixture/test handlers. Candidate and consumer-core integrities
are retained and the consumer-core binding is checked against the qualified lockfile. This complements, rather than replaces,
the source tests. No tarball was published to a registry.

The supported typed fixture uses an explicit empty aggregate read contract and
stateful views. Both retained negative probes deliberately require specific
compiler failures:

- [Omitted-read diagnostics](strict-optional-repro.txt): `definition.read` includes
  undefined but Aggregate.Any's optional contract does not accept that form under
  exact optional properties.
- [Stateless-view diagnostics](stateless-view-repro.txt): View.definition.state
  includes undefined but View.Any's optional state contract does not accept it.

The real stateless runtime fixture is JavaScript, with poison emit/evolve handlers.
It establishes runtime non-coercion separately; it does not cast away or suppress
that TypeScript issue. Both source tests and the generic exception path pass.

The core peer metadata still says 0.3.0 because source versioning/publication is
separately gated. **Published 0.3.0 is not qualified**: the supported core artifact
is the one from source `aaa1186`, with the receipt's integrity. A release must choose
an appropriate core version and requalify the adapter. Do not infer support from
the semver peer declaration or caller-supplied version string alone.

## Reproduction and review

```sh
bun run --filter @opsydyn/foldkit-zloz pack:check
cd experiments/alchemy-domain-fidelity
npm ci --ignore-scripts --no-audit --no-fund
npm test
bun run test:bun
npm run qualify
npm run test:consumer
```

Root verification: `bun typecheck`, `bun run check`, `bun run test`.
The final consumer initially found that workspace builds had removed the shared
core archive; repacking the unchanged source restored the expected integrity and
the rerun passed. A missing archive now fails before installation, without fallback.
After regeneration, format JSON evidence with repository Oxfmt before root checks.
[Retained graph/findings](adapter-projection.json) and [canonical SVG](adapter-projection.svg)
are artifact checks, not browser/manual acceptance.

Architecture/boundary self-review: **safe with noted risk** for trusted declarations
in the isolated candidate. Core does not import the SDK. A portable future entry
must use a versioned validated descriptor rather than evaluating user TypeScript.
Full production adoption remains on hold.

Test-quality self-review: version-before-access uses an inaccessible model; missing
and colliding identities block; strict negative probes require their specific
errors; independently specified native graph changes reject coercion. Mixed source
and reordered/chained cases prevent target-only typing or ordering shortcuts.
Poison handlers and a frozen definition container protect the tested path, not a
sandbox or universal no-code-execution guarantee for arbitrary JavaScript.

Delivery self-review: local packing/installing is separate from publication. The
candidate remains private and outside production workspace/release selection.
Rollback is a local revert of candidate files and its local core binding; no remote
state changes. Recommendation: **needs review**.
