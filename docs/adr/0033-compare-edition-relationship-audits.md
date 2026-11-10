# ADR 0033: Compare edition relationship audits

## Status

Accepted for the approved package and CLI slice, 2026-11-09.
Boundary review: **safe with noted risk**. No new findings means no regression
under the chosen convention, not full compatibility or process correctness.

## Context and decision

ADR 0032 audits one graph. Architecture review also needs an explicit historical
baseline and an explanation of what changed. The pure core function
`compareModelEventStormingRelationships` validates and detaches a model with the
existing capture boundary, selects an owned baseline edition and either an owned
target edition or the current graph, then audits both under the same options.
Missing IDs return a blocked decision; there is no fallback to current, array
order, timestamp, or lineage. Same-edition comparisons are valid and produce no
introduced or resolved findings. Model/graph/archive serialization is unchanged.

Only blocked audit entries are findings. Finding identity is the tuple of edge ID
and diagnostic code, compared as separate values without delimiter ambiguity. Stable IDs and codes
persist across label, presentation, endpoint or reason changes; both before/after
projections remain available. A changed code resolves the old finding and
introduces a new one. Removed edges resolve findings; new or renamed edge IDs
introduce findings. This is a semantic diagnostic delta, not evidence that a
deleted relationship was repaired. Result arrays preserve canonical audit order,
omit host data and include both complete audits and explicit source references.

The Effect CLI adds `relationships compare --baseline <id> [--edition <id>]`
with the existing `--input` and data-only `--rules` boundaries. One catalogue is
used for both sides, so this command does not compare convention versions. Model
input is required. Its additive v1 response uses operation relationships-compare,
status compared and scope model-editions. Top-level diagnostics contain introduced
findings only; persisting and resolved findings are in data. Exit 1 means at least
one introduced finding, exit 0 means none, and exit 2 means rejected input,
configuration or invocation. Both full audits remain available even on exit 0.
The typed `CliAuditRegression` error represents the new exit-1 case. Existing
audit/validation/Mermaid contracts retain their meanings.

## Alternatives and consequences

Comparing human-readable messages would create false regressions after copy or
label changes. Edge ID alone would hide changes in diagnostic category. Comparing
every field would turn presentation changes into semantic findings. A separate
cross-file baseline command would add model provenance ambiguity; this slice uses
owned editions in one portable model. Comparing convention versions, remapping
edge identities, UI controls and writable operations remain outside this slice.

No dependencies, persisted schema changes, publication or deployment. The host
owns edition identity and must supply pure deterministic `roleOf` callbacks when
customizing core interpretation. Rollback is a code revert; no documents are
rewritten. Architecture, delivery and test-quality review are self-review.

## Implementation and verification

- Core comparison and public exports live in `relationship-audit-comparison.ts`
  and `index.ts`; reuse the existing model capture and audit functions.
- Effect command and additive protocol types live in the CLI package. Reuse
  bounded I/O and rule validation rather than introducing another parser.
- Core tests assert independently expected deltas, changed codes, removed edges,
  deterministic order, no mutation, explicit selection and shared conventions.
- CLI and packed-consumer tests verify selection, JSON and 0/1/2 exit contracts
  under Node/Bun, including no-new-findings with incompatible persisting entries.
- Capture an executable evidence transcript and run root lint/format, typecheck,
  workspace tests and the API documentation build before committing.
