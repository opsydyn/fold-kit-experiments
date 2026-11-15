# Headless modelling-patch contract — local qualification, 2026-11-13

- **result:** complete
- **claim:** core exposes bounded data-only patch proposals with source identity/revision/content and provenance, producing frozen dry-run graphs, before/after changes, policy blockers and authored-data loss findings without editor mutation or Apply.
- **evidence:** independent literal v1 fixture, 12 focused tests, a detected depth-guard mutation, real installed Node/Bun and Bundler/NodeNext consumer checks, actual dry-run JSON, root checks/tests and TypeDoc; commands below.
- **remaining uncertainty:** object boundary only; raw text/duplicate-key/byte framing and CLI dry run are future work. No Apply, consent acceptance, architectural audit, identity authentication, hostile-JavaScript isolation, wall-clock performance, UI/device/AT, publication, PNG or Alchemy claim.
- **next:** needs review; define the strict versioned patch text decoder before exposing Effect CLI dry run, then separately design guarded atomic Apply.

## Contract and boundary review

[ADR 0060](../../../docs/adr/0060-preview-bounded-modelling-patches-before-apply.md)
records the six-operation vocabulary, source/provenance, validation and preview
semantics. `captureModellingPatch` and `dryRunModellingPatch` live in the dependency-free
core. The shared structural node/edge/graph guards are module-internal exports,
not new package entry points. Existing graph/model/packet formats and validators
retain their behaviour. There is no adapter, editor, Effect or browser import in
the new module; no dependency or lint configuration change.

A proposal pins the complete authored graph plus host-supplied model ID, unique
session/incarnation ID and monotonic revision. Navigation does not invalidate a
graph-only proposal; Undo revision changes do. Actor/reason/reference provenance
is unsigned data. Matching source claims or a reviewable preview never establishes
permission. All future Apply paths must rebuild/recheck live source, lifecycle,
granular editor/host policy and consent, then publish provenance and one Undo.

All six operations are explicit. Adds require absence; replacements/removals
require presence. IDs are never allocated or silently renamed. Each entity is
targeted once; removals never cascade, drop connections or detach children. Final
combined validation permits cross-operation dependencies without accepting an
invalid final graph. Replacements retain array position; additions append in
operation order. Graph-level JSON extensions survive the proposal unchanged.

The object boundary validates exact envelope fields and bounded JSON, rejects
accessors/non-data values and detaches/freezes source, operations and provenance.
Object keys normalize by code-unit order, preserving distinct Unicode-equivalent
keys; arrays retain order. The candidate and callback arguments are owned/frozen.
Invalid proposals return structured findings without a candidate. Valid protected
proposals still disclose their exact candidate, changes and losses. Empty/equal
proposals are informational no-ops. Deletions disclose removed entities;
replacements list overwritten/omitted prior top-level fields. These conservative
losses are not consent and do not assert irrecoverability: source values remain
in the proposal. Live review hooks are separate from EditorPolicy and convention
audits. Host callback exceptions propagate rather than becoming validation data.

Architecture/boundary, delivery and test-quality reviews are **self-review**, verdict
**safe with noted risk**. No independent review or hosted acceptance is claimed.
Rollback before publication is a local revert without model migration.

## Reproducible evidence

- [Independent literal proposal](../test/fixtures/modelling-patch-v1.json).
- [Focused tests](../test/modelling-patch.test.ts).
- [Actual reviewable, protected and stale results](modelling-patch-example.json).
- [Result generator](modelling-patch-example.ts), using the public source entry:

```sh
bun packages/foldkit-zloz/evidence/modelling-patch-example.ts
```

The literal renames a DDD bounded context, retaining its semantics and owner data.
Expected loss is exactly the prior `label` field; protected output retains the
same complete graph and provenance with a policy error. A different current
revision rejects without returning a graph. There is no screenshot because this
slice has no UI change.

## Verification and failures resolved

- Baseline `bun typecheck` and `bun run check`: exit 0.
- Final `bun typecheck`: all workspaces, exit 0. A final focused core typecheck
  also passed after the additional extension-preservation test and clearer limit
  message. Existing repository hints/warnings are not a zero-warning claim.
- Final `bun run check`: lint/format/catalog/skill checks, exit 0; existing warnings remain.
- Final `bun run test`: all workspace suites, exit 0. Core: **498 pass**, including
  **12 patch tests**. Existing skipped tests remain skipped.
- `bun run --filter @opsydyn/foldkit-zloz docs`: public TypeDoc, exit 0.
- Packed consumer: actual offline npm installation, no workspace links or unwanted
  runtime peers, Bundler/NodeNext compilation, Node/Bun execution of preview,
  exact loss fields, provenance freezing, source freshness and original graph
  preservation. The expanded standalone consumer also passed independently.

Tests cover exact literal output, every operation, stale model/session/revision/
graph, Undo freshness, complete before/after changes, deletion dependencies,
missing/existing/duplicate targets, invalid wiring/geometry, lost semantic/data
fields, no-op/additional fields, deep ownership, policy/blank reasons/exceptions,
malformed and excessive data, accessors without getter execution, Unicode key
ordering and graph extension retention. The original editor graph/Undo/revision
remain untouched.

The initial red run failed because exports were absent. Interim checks found type
narrowing and test fixture typing issues, corrected without weakening validation.
Lint exceptions are restricted to the explicit dependency-free object boundary;
no repository-wide rule was relaxed. Self-review found and fixed extension loss
and Unicode key-order comparison before final verification. A targeted temporary
mutation removed the depth guard: the otherwise-valid deeply nested proposal
became `reviewable`, and the test failed expecting `rejected`. The guard was
restored; the complete focused suite passed afterward.

The first full test run found a variable name collision in the expanded standalone
consumer. Renaming the test-local value resolved it; the real packed consumer and
complete workspace suite then passed. Shared-dist builders, full workspace tests
and TypeDoc ran sequentially; lint and no-emit source checks are independent.
Recommendation: **needs review**.
