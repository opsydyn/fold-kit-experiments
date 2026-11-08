# Headless Flow architecture contract

- **result:** complete
- **claim:** package-owned C4/DDD descriptors, outline geometry, v1 retention and
  policy-aware undoable changes are implemented for the headless slice.
- **evidence:** execution-tool command results for workspace gates, 250 Flow
  tests, both adapters, strict packed consumers, pinned old-core qualification,
  native FoldKit SSR and warning-strict TypeDoc; source hashes recorded below.
- **remaining uncertainty:** default architecture artwork and browser authoring
  are future work; old consumers retain fields with generic rendering/geometry.
- **next:** C4 renderer presets and a themed system-context workbench example.

Implemented locally on 2026-11-08 under
[ADR 0005](../adr/0005-headless-flow-architecture-contract.md), following approval
of slice one of the [architecture plan](2026-11-08-flow-architecture-shapes-plan.md).

## Delivered contract

The existing dependency-free `@opsydyn/foldkit-flow` root now supplies:

- `FlowNodeArchitecture`: discriminated C4/DDD meaning, optional descriptions,
  C4 container/component technology and DDD context subdomain classification.
- Optional `FlowNode.architecture` and `FlowNode.appearance`, independent of
  consumer `data` and group `kind`. Reserved descriptor fields are strictly
  validated at parsed and programmatic graph boundaries.
- A frozen twelve-role catalogue and detached, validated standalone factory.
  Caller IDs, dimensions and ports are explicit; parenting is assembled in the
  complete graph. The factory selects a catalogue outline only when omitted.
- Rectangle, rounded-card and cylinder outlines, safe local content bounds,
  inclusive world containment and cardinal boundary intersections. Layout,
  selection and grouping retain the authored rectangular envelope. A Person
  preset is a rounded card; the adornment belongs to the next renderer slice.
- Canonical default port anchors on those outlines. Explicit authored anchors
  remain unchanged during semantic/shape changes and resize; routing projection
  follows the chosen outline. Native/custom sockets and anchor controls use the
  same node-aware coordinates as headless paths and previews.
- `NodeArchitectureChanged`, `NodeAppearanceChanged` and `PortAnchorReset`.
  Accepted edits use existing read-only/gesture gates, fresh host policies,
  revision/route invalidation and one-step Undo. Null removes a descriptor;
  exact no-ops preserve state. Semantic changes preserve appearance. Reset uses
  the existing per-port position policy and restores the same side at offset 0.5.

Groups stay portless and rectangular. Only C4 system/container and DDD
aggregate/context boundary roles apply to groups; an aggregate requires a group.
A bounded context can be a normal connectable node in a context map. No domain
identity, aggregate-root references or business invariants are inferred.

## Evidence and regression review

The first API test failed because the public contract did not exist. A separate
pre-change boundary assertion also failed: the previous core accepted an invalid
C4/entity descriptor. The new tests exercise the actual graph/editor/geometry
paths rather than mocked policy or serialization implementations.

Ten new Flow tests cover catalogue coverage and detached inputs; literal old/new
v1 documents; malformed family/role/field combinations and group invariants;
outline/content geometry at corners and small dimensions; resize and explicit
anchor preservation; canonical edge endpoints; no-op, clear, veto and read-only
paths; Undo/Redo; pending-source cancellation; stale layout rejection; port reset;
and native/custom socket/handle agreement through real FoldKit SSR. Advisory lint
suggestions remain; all mandatory lint/format/catalog checks must exit zero.

The new real-ELK regression preserves node bounds/metadata and checks canonical
curved/authored route endpoints. The new force regression initially failed: a
lead projected from a curve could stay inside the rectangular routing obstacle,
so no route was returned. The adapter now clears that envelope before corridor
search and retains its canonical endpoint. This is an integration correction,
not a new layout engine or arbitrary-outline obstacle router.

The packed consumer installs only the core tarball, compiles in strict Bundler
and NodeNext modes with exact optional properties, and runs on Node and Bun.
It exercises factory, geometry, semantic change and Undo, and contains negative
type assertions for mixed C4/DDD roles and technology on a Person. FoldKit,
Effect, ELK and React remain absent until the existing optional-view qualification
explicitly installs them. This qualifies the public package boundary, not only
source aliases inside the monorepo.

## Version 1 compatibility

[Pinned-core result](../../packages/foldkit-flow/evidence/architecture-compat.json)
records an actual pre-change core built from commit `ce978a2`. It reads the literal
new v1 fixture, renames/moves nodes, copies/pastes, undoes and exports; the current
reader verifies retained descriptors and host data. It also checks the old codec
round trip. The driver uses historical source rather than a simulated old codec:

```sh
bun tools/check-flow-architecture-compat.ts
```

That local driver requires the pinned Git history. Its temporary bundle is
cleaned up even on failure. The result records the observed bundle hash, not a
reproducible binary promise; temporary paths can affect bundler output.

Version 1 is unchanged because these optional fields survive the qualified old
paths. **Old renderers and geometry remain generic/rectangular.** No retention
claim extends to third-party serializers or future descriptor fields/roles.
The current reader validates the new reserved fields strictly. No document
migration, dependency addition, PR or registry publication is performed.

## Verification record

- Baseline workspace typecheck/check: exit 0.
- Full workspace test suite: exit 0, including 250 Flow tests, seven ELK tests,
  six force tests and seven sample tests; packed-consumer qualification included.
- Final focused architecture/SSR run: ten tests, 198 assertions, exit 0.
- Workspace lint/format/catalog check: exit 0, with advisory warnings.
- Final workspace `bun typecheck`: exit 0 after the tests completed.
- Flow TypeDoc generation with warnings treated as errors: exit 0. Public
  architecture and geometry entries are present in the generated reference.

Two test-only typing errors were corrected during qualification. A literal
geometric use of “shape” triggered the repository's placeholder-name lint rule;
scoped comments explain that domain exception. A concurrent typecheck/test run
also encountered a generated Astro declaration being rebuilt by tarball tests;
the final typecheck is run after the tests, and TypeDoc after typecheck.

Self-review: safe with noted limitations. The root remains dependency-free;
descriptors are detached and validated; unsupported group roles fail atomically;
explicit anchors remain authored; rejection leaves graph/history unchanged.
Default FoldKit architecture artwork and pattern insertion are subsequent
slices. No new visible workbench feature is claimed, so SSR/native semantics and
headless/layout evidence are appropriate here; physical-device, screen-reader
and rendered C4 authoring acceptance remain unqualified.

[Source manifest](../../packages/foldkit-flow/evidence/architecture-sources.json)
records the parent commit and hashes of changed runtime, tests and qualification
driver files. The pinned-core JSON also identifies its exact old commit.

**Recommended next:** C4 preset renderers composed from the public primitives,
with a light/dark system-context workbench example. Qualify visible outline/port
alignment, keyboard editing, resize, selection and Undo before adding the larger
DDD/pattern authoring catalogue.

Final recommendation: **needs follow-up** for rendered authoring qualification.
