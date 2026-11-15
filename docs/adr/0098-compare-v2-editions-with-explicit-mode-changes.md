# ADR 0098: Compare v2 editions with explicit mode changes

## Status

Accepted for the approved headless comparison slice, 2026-11-15. Follows
[ADR 0097](0097-fork-v2-editions-with-pinned-provenance.md).
Architecture, delivery and test-quality reviews are self-review.

## Decision

Expose `compareEditionsV2` with `ZlozHistoryComparisonV2` and
`ZlozHistoryModeChangeV2`. Validate, detach and deeply freeze both explicit
checkpoints using `captureEditionV2`. Each graph is validated in its checkpoint's
own strict/loose mode. No lookup, ownership inference, editor mutation or Apply
is performed. Equal edition IDs are allowed: callers choose both inputs.

Report mode separately as either `unchanged` with its mode, or `changed` with
strict→loose or loose→strict. The discriminated type excludes equal-mode changed
records. Aggregate `semanticChanged` includes mode or authored graph meaning;
`layoutChanged` includes graph presentation only. Retain checkpoint metadata and
camera in the pins but exclude them from these graph/mode flags. These flags do
not assert byte equality or camera equivalence.

Reuse the existing stable-ID node/edge diff behind an internal helper. Preserve
its ordering, JSON-key insensitivity, semantic/layout separation and induced edge
geometry changes. Mode-only transitions produce empty node/edge arrays, never
synthetic changes or rewritten ports. Freeze arrays, records and the result;
caller-owned data remains mutable and detached.

The v1 comparison now uses the existing legacy snapshot-mode guard before
comparing either side. Explicit v2 (including strict) and loose snapshots reject
rather than silently losing intent. Ordinary v1 comparisons preserve result
shape and caller references. This does not prevent hosts from manually unwrapping
a graph and discarding its mode. No wire format or package version changes.

## Alternatives and boundary review

Boundary verdict: **safe with noted risk**. Core owns validation and pure
comparison. Reusing the graph diff avoids divergent semantics; an internal graph
helper does not enter the root public API. Passing v2 through v1 comparison or
encoding mode as a fake graph element would hide or distort checkpoint meaning.
A combined version-erasing API would weaken the explicit compatibility boundary.

The legacy guard intentionally tightens previously silent structural acceptance;
hosts with explicit v2 snapshots must use the v2 entry point. Comparison remains
read-only data, not authority to restore, convert or change an editor's mode.
V2 presentation/ghosts, append, restore/playback, CLI/workbench adoption and wider
C/Q/R qualification remain separate. C1 stays partial. No npm publication.

## Evidence and next

See [qualification](../../packages/foldkit-zloz/evidence/history-comparison-v2.md)
for tests, installed consumers, mutation sensitivity and repository checks.
Next: package-level v2 comparison presentation with explicit mode feedback and
history ghosts before cross-mode restore/playback adoption.
