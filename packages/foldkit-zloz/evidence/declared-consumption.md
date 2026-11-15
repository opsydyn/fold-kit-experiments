# Read-model and declared-consumption core contract

- **result:** complete
- **claim:** the approved framework-neutral core contracts are implemented: native
  DDD read-model nodes, explicit tactical `feeds` meaning, and a pure guarded
  two-ID consumption resolver, composed with existing package mechanisms.
- **evidence:** six new behavioural tests plus extended native DDD renderer,
  catalogue, relationship and installed-package tests. Literal v1 decoding,
  immutable logical resolution, live editing policy/controls, Undo/Redo, editions
  and SVG findings are exercised. Root verification and API docs are recorded below.
  All architecture/boundary/delivery/test-quality assessment here is **self-review**.
- **remaining uncertainty:** declarations do not establish a source event set,
  filters, handlers, transport, ordering, consistency or live consumption. Non-DDD
  role mappings, streams/policies/sagas and Alchemy's strict-optional compatibility
  remain separate work. No new workbench/browser/device/manual AT, provider or
  hosted qualification is claimed. Earlier readers may reject the new role strings.
- **next:** qualify a separate optional read-only Alchemy adapter against this
  native subset, retaining exact-version/identity/loss reports and the upstream
  compatibility gate. Recommendation: **needs review**.

## Contract and observed checks

`ZlozDeclaredConsumption` names `sourceNodeId` and `consumerNodeId` only.
`isDeclaredConsumption` rejects invalid/plain-record syntax and extra fields.
`resolveDeclaredConsumption` reads the current graph and either reports an explicit
rejection or returns a frozen detached declaration, source role and directed logical
relationship. `declaredConsumptionArchitecture` and
`declaredConsumptionSourceRoles` are frozen public defaults. No editor or dependency
runtime is involved.

The DDD `read-model` role is an ordinary node, not a group, repository or executable
projection. The preset chooses rounded-rectangle geometry, retaining normal authored
appearance/renderer slots. Existing native DDD content renders “Read Model” with
normal handles, ports, themes and accessibility structure. The extended renderer
fixture now covers all nine roles with existing light/dark/minimal/custom checks.

Default tactical `feeds` is directed from aggregate/root, domain-event type or read
model to a read model. A source-level relationship does not enumerate or imply
all events; an explicit event-type node can name a particular declared input.
Reverse/incompatible/missing/non-DDD participants reject. Self-dependency is an
explicitly permitted tactical declaration, with no inferred executable feedback.
Logical resolution may describe a portless aggregate; it does not invent ports or
promise a drawable edge. Existing editor connection validation remains separate.

A literal version1 fixture, written independently of the encoder, retains the new
node/edge descriptors through canonical serialization. Editions detect an added
feed. SVG produces canonical artwork and explicitly reports semantic-edge fallback.
Reserved descriptors reject runtime-handler/event-filter fields and wrong scopes.
The original contract test first failed because the new export was absent; the
implemented behaviour passes. An invalid test group initially retained an ordinary
node's rounded appearance; correcting the authored group fixture preserved the
existing portless rectangular invariant. No implementation guard was relaxed.

Existing DDD controls expose `tactical:feeds` as an explicit choice, retaining the
previous catalogue order. The DDD policy checks actual endpoints and incident role
changes; host protection, read-only and stale revision rejection still apply.
Architecture edits add one Undo entry, and Undo/Redo restores exactly the authored
graph. The resolver itself leaves the graph and event set untouched.

## Verification

Commands run from the isolated worktree:

```sh
bun typecheck
bun run check
bun run test
bun run --filter @opsydyn/foldkit-zloz docs
```

The focused five-file suite passes **33 tests**. The core suite passes **524 tests**,
including the npm tarball consumer under Node/Bun, strict TypeScript Bundler and
NodeNext, and optional-peer absence checks. The consumer imports the public logical
contract/resolver/constants, creates a native read-model node, resolves declared
consumption and type-rejects runtime-filter fields. This is package evidence,
not an Astro-only helper or a dependency installed into core.

Root typecheck, lint/format and all workspace tests pass. TypeDoc includes the public
resolver, guard, types and constants. No dependency, package version, public hosting
or publish workflow changed. Existing Alchemy spike fixtures remain historical
qualification against their pinned core tarball; this change does not silently
refresh that experiment's lockfile or claim its upstream compatibility issue fixed.

## Self-review and recovery

Architecture/boundary: **safe with noted risk** for the additive local contract.
Core remains browser/framework free; the DDD relationship machinery owns authoring
semantics and the editor owns mutation permissions/lifecycle. A new runtime or edge
family was unnecessary. Narrow read-model targeting avoids coercing unrelated types.

Test quality: explicit role/direction matrices, literal wire fixture, native output,
rejection paths, policy bypass attempts, one Undo, retained SVG findings and installed
consumer types exercise the public boundaries. There is no inferred runtime source
or execution proof to test. Full D1/D/C/Q closure and representative-user acceptance
remain unperformed.

Delivery: no new dependency or version bump. Keep any saved documents with new role
strings before reverting to a reader that cannot decode them. Otherwise rollback is
revert of this commit. Recommendation: **needs review**.

[ADR 0065](../../../docs/adr/0065-declare-read-model-consumption-without-runtime-semantics.md)
· [Public guide](../README.md#read-models-and-declared-consumption-unreleased)
· [Behaviour tests](../test/declared-consumption.test.ts).
