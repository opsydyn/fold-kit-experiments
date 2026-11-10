# Edition-aware relationship audit comparison

## result

complete

## claim

The public core package and Effect CLI compare causal findings against an explicit
model-owned baseline, targeting the current graph or a chosen edition. Reports
separate introduced, resolved and persisting findings and retain both full audits.
The comparison exit gate concerns new findings; the existing audit gate still
concerns all incompatibilities. No input documents are rewritten.

## evidence

- Root `bun typecheck`, `bun run check` and `bun run test` passed. The API
  documentation build passed. Existing workspace warnings/skips remain.
- Core tests assert independently expected deltas, changed codes, repaired and
  removed edges, canonical order, no mutation, reverse/same-edition comparisons,
  explicit target selection, missing IDs, origin exclusion and shared conventions.
  Changed endpoints and readable reasons remain persisting when edge ID/code
  match, with both versions retained. Inferred/unrelated entries do not invent
  findings. Invalid rule catalogues still reject.
- Real packed consumers passed under Node and Bun, including dependency-free
  core imports, public type narrowing, CLI file/stdin input, custom conventions,
  full JSON responses, 0/1/2 exits and model file preservation. Bundler and
  NodeNext consumer typechecks passed. The CLI suite passed 16 tests with 228
  assertions, including existing I/O, validation and Mermaid regressions.
- The [executable evidence script](relationship-comparison.mjs) produced a
  [passing transcript](relationship-comparison-results.json) for 26 Node/Bun
  scenarios, with runtime versions recorded. Assertions cover current/explicit
  targets, reverse/same comparisons, introduced/resolved/persisting findings,
  custom rules, rejected selectors/documents/configuration/invocation and JSON
  stream framing. The transcript projects the complete responses into compact
  source/count/diagnostic records. Fixture bytes remained unchanged during audit
  commands; later formatting normalizes only fixture whitespace.
- Before implementation, the core test failed on the missing comparison export;
  command tests failed because the comparison command was unavailable. The
  implemented paths passed. Lint rejected Effect success placeholders; they were
  replaced with explicit Result selection followed by Effect boundary handling,
  without suppressions. One intermediate direct test invocation overlapped a
  workspace build cleaning dist and could not load the core; the sequential full
  workspace run subsequently passed.
- Architecture, delivery and test-quality review were self-review. Dependency
  direction remains CLI → core. No UI policy or transport behavior entered the
  core, no new dependency was added and persisted formats remain unchanged.

## remaining uncertainty

Findings are identified by stable edge ID and diagnostic code, not semantic
equivalence across renamed IDs. Removing an edge resolves its finding for this
comparison without certifying the design. No-new-findings can retain existing
incompatibilities. Both sides use one convention; convention-version comparison
and callback determinism are host responsibilities. Only owned editions are
selected; lineage is not traversed. No new UI, browser, benchmark, hosted CI,
deployment or registry publication evidence is claimed.

## next

Recommendation: **needs review** for the local commit. Next bounded slice:
composable audit comparison controls, demonstrated in the workbench, with
baseline/target selection and edge reveal on the corresponding history side.
