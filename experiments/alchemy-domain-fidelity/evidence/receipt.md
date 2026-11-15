# Declaration fidelity spike receipt

- **result:** complete
- **claim:** the approved isolated, pinned declaration-mapping spike is implemented.
  The fixture maps without silent source-fact omissions or business handler calls;
  this is not acceptance of a production adapter or full semantic fidelity.
- **evidence:** Node and Bun tests; two strict TypeScript profiles; fresh outside-
  monorepo npm consumer; independently authored golden source/graph; actual pinned
  static definition verification, identity/loss/revision regression tests, retained
  unsupported-role and strict-optional diagnostics. Root verification is recorded
  below. All assessment/review here is self-review.
- **remaining uncertainty:** omitted-read strict compatibility fails in the pinned
  upstream; native view/stream roles and semantic relationship contracts are absent;
  sagas/API/runtime behaviour, projections beyond inspected types, incremental
  layout, arbitrary input parsing, browser/device/AT, user value and live/provider
  integration are unqualified. Root and core package dependencies are unchanged.
- **next:** add a framework-neutral read-model/declared-consumption contract to core
  before promoting a separate optional adapter. Resolve the strict-optional gate
  before claiming general beta.85 consumer support. Recommendation: **needs review**.

## Observed local results

Node **24.15.0**, Bun **1.4.4**, TypeScript **6.0.3**. Five behavioural tests pass in
each runtime. Supported fixture compiles with `strict` and
`exactOptionalPropertyTypes` in NodeNext and Bundler. The outside-repo consumer
installs exact dependencies without lifecycle scripts, then emits eight nodes and
eight edges under each runtime, with zero handler calls and no Foldkit/React install.

The fixture's `Domain.verify` returns `[]` without hosting it. Source coverage is
8 declarations, 15 relations, 23 represented facts. Two unsupported native roles
are visibly labelled; eight relationship semantics remain explicitly untyped.
A missing source blocks graph output. Actual golden graph round-trips through core
serialization and can be captured/compared as editions without graph Undo entries.
A second edition adds exactly two declaration nodes with no false semantic changes
among existing nodes. Layout movement remains separately observable.

The strict-optional negative probe exits2 with the exact `definition.read`
incompatibility, retained separately from positive compilation. An early revision-
metadata test failed for false semantic changes; the final test passes after moving
revision provenance to the manifest. A missing-dist first test attempt was setup,
not a behavioural regression claim. Early lint errors were corrected without
relaxing project rules; the only narrow suppression marks test-only handler-count
instrumentation outside an application Model.

Commands: `npm test`, `bun run test:bun`, `npm run qualify`, `npm run test:consumer`.
Root: `bun typecheck`, `bun run check`, `bun run test`. The independent experiment
is intentionally not added to the root workspace or CI dependency graph; rerun its
commands explicitly when changing it. No production source or package version was
changed. Root tests therefore complement, rather than replace, the spike checks.

## Review and recommendation

Architecture/boundary self-review: **safe with noted risk** for a trusted, isolated
experiment. Production adoption remains on hold. Declaration metadata is not
permission or authenticated provenance; importing arbitrary project code would
execute its top level and is outside this design.

Test-quality self-review: the golden graph detects semantic coercion, endpoint and
identity errors; independent expected additions detect wrong edition changes;
rejection tests cover collisions, limits and missing references. The actual
revision-noise regression demonstrates the history assertion detects a plausible
fault. Poison handlers/static verification establish the tested extraction path,
not a sandbox or a proof against all possible JavaScript execution.

Delivery self-review: separate lockfile and exact versions keep the experiment
recoverable. No release/hosting/provider action occurred. Rollback is a revert of
this experiment, ADR and roadmap documentation. Recommendation: **needs review**.
