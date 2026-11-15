# EventStorming-to-DDD mapping preview — local qualification, 2026-11-11

result: complete

claim: The headless Zloz root exposes an advisory mapping preview with proposals,
explicit ambiguity/retention, per-ID choices, DDD compatibility and prospective
semantic-loss disclosures; graph, identities and history remain unchanged.

evidence: Focused behavior tests, installed root consumer checks and sequential
workspace qualification described below. All final commands exited 0.

remaining uncertainty: Local package evidence only. No UI, conversion, provenance
persistence, C4 mapping, publishing or deployment. Suggestions are Zloz conventions,
not certification of a domain model. Architecture/delivery/test review is self-review.

next: needs review; then compose a read-only workbench preview with explicit choices,
ambiguity and loss reasons before conversion actions.

## Scope and ownership

Continued from `8bd3c23` in isolated `codex/zloz-context-map`, keeping other
workstreams untouched. See [ADR 0041](../../../docs/adr/0041-preview-event-storming-ddd-mappings.md).
`previewEventStormingDddMapping` lives in the dependency-free core and reuses
architecture validation, structural graph validation and the existing logical DDD
resolver. Root exports are qualified through the installed package. No dependency,
schema, codec, adapter or renderer changes.

The preview reports source IDs and detached source descriptors, not a converted
graph, event or authorization token. Node proposals do not infer aggregates,
contexts, parents or ports. Only explicitly authored causal emits receives a default
DDD edge proposal, checked against proposed endpoint roles. Explicit choices can
resolve workshop intent or retain it. Existing DDD edges are checked but cannot be
remapped through this API. Other families and unrelated graph elements stay intact.
Every proposed workshop descriptor replacement has a prospective disclosure.

## Tests and review

The initial focused test failed because the root API did not exist; implementation
then satisfied the behavioral assertions. The focused suite verifies:

- Independent expected default proposals, multi-candidate command ambiguity,
  single-candidate policy ambiguity and unmapped actors.
- Explicit choices and null retention, with no implicit causal/untyped inference.
- Compatibility against all proposed endpoints; incompatible roles, unknown
  conventions and custom DDD rules return informative edge decisions.
- Preservation and validation of already-authored DDD relationships.
- Rejection of duplicate/missing/foreign choices, invalid descriptors, invalid
  node kind, malformed graph and invalid conventions even on empty scope.
- Determinism, stable source IDs, exact serialized graph preservation, unchanged
  editor Undo history and detached source/target descriptions and role arrays.
- Description inheritance for explicit edges and deliberate empty-string replacement.

Installed Node and Bun consumers exercise the real root export. Bundler and
NodeNext type checks qualify the public result type; a negative type fixture proves
that a preview does not expose an executable graph.

Self-review: boundaries are **safe with noted risk**. Default suggestions remain
fallible and explicit choices are not edit permissions. A later converter must
recompute against the selected model, reject stale input, check live host policy and
lifecycle, obtain loss consent and preserve provenance in one undoable transaction.
Tests do not qualify conversion or UI behavior. No superiority or parity claim.

The initial typecheck completed with no type errors; sandbox-local Vite socket
warnings were observed. A baseline format check completed after the new test had
been created and reported its unformatted content, so it is not evidence of a
pristine pre-edit lint pass. Final lint first caught two conditional empty spreads;
these were replaced with an explicit description-preservation helper and tested.
No rule was suppressed for this feature.

## Final command results

Host-captured final results, run sequentially after the final source changes:

- `bun test packages/foldkit-zloz/test/event-storming-ddd-preview.test.ts`: 9 pass,
  0 fail, 44 assertions.
- `bun run check`: exit 0; repository/advisory warnings remain, including pure-core
  callback-control-flow and fixture non-null-assertion warnings. No suppressed rules.
- `bun typecheck`: exit 0 across all workspaces.
- `bun run test`: exit 0 across all workspaces. Zloz core: 380 pass, 0 fail,
  including the packed Node/Bun consumers and both TypeScript resolution modes.
  Existing skipped tests elsewhere remain skipped.
- `bun run --filter @opsydyn/foldkit-zloz docs`: exit 0.

The final evidence Markdown was formatted and followed by another root check and
`git diff --check`. No browser acceptance is claimed for this headless API.
