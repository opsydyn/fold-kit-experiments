# ADR 0103: Qualify v2 portable adapter boundaries as one batch

## Status

Accepted within the approved compatibility batch, 2026-11-15. Follows
[ADR 0102](0102-complete-v2-history-workflows.md). Architecture, delivery and
quality reviews are self-review.

## Context and contract

Canonical v2 models retain a mode on current, archived and origin checkpoints.
The remaining adapters have different responsibilities. A geometry request can
carry mode without creating another model wire format. Mermaid is already a
loss-aware projection. Patches, conversion receipts and portable review packets
embed validated v1 snapshots and reproduce their results using strict-only
validators. Passing unwrapped graphs into those contracts would erase authoring
semantics or reject otherwise valid models as malformed.

Complete the compatibility decision batch with a public, read-only capability
report, real layout and Mermaid adoption, bounded Effect CLI validation/inspection,
explicit incompatibility exits, old-reader regression coverage and installed
consumer evidence. Do not expand this into new patch/receipt/packet schemas or
claim universal v2 portability. No release, deployment, dependency change or npm
publishing is authorized by this batch.

## Decisions

- `assessPortableCompatibilityV2` captures/validates a whole canonical model and
  reports every checkpoint, including an origin-only loose checkpoint. It checks
  strict compatibility through the existing downgrade planner and publishes
  findings, not a prospective downgraded document, consent or Apply authority.
  `scope: format-capability-only` excludes engine eligibility and live permissions.
- Layout requests add optional explicit `connectionMode`; absence means strict for
  existing authored requests. Editor-created requests include current mode and use
  mode-aware detachment. Native Apply/preview require matching mode as well as
  existing request identity/revision/lifecycle checks. Geometry commits preserve
  full-frame Undo. ELK uses the shared validator; force now does too. Engine limits,
  geometry, routing and existing policy responsibilities remain unchanged.
- Keep graph-only `exportMermaid` strict. Add `exportConnectionMermaid` with a v2
  bundle protocol (`foldkit-zloz-mermaid/v2`), explicit mode and existing ordered
  identity records. Its source remains a projection: loose future-connection rules
  and viewport omission produce loss findings and reject by default. `report`
  consents to projection loss, never invalid graphs or port rewrites. V2 bundle
  mode is not omitted; the finding describes source-only fidelity.
- CLI `validate` supports v1 and v2, preserving old v1 JSON response shape and
  adding mode/version fields for v2. Mermaid selects the explicit v2 adapter for
  v2 documents. `compatibility inspect` requires a full v2 model and returns the
  package report as structured JSON. Same bounded streams, fatal UTF-8 decoding
  and strict version-specific readers apply. No new I/O or network capability.
- Preserve `readDocument`/`readGraph` as existing v1 adapter seams. New
  `readPortableDocument` exposes a discriminated v1/v2 union. Legacy operations
  first validate v2 data, then return `adapter-version-required` with exit 1.
  Invalid data and unsupported malformed envelopes keep exit 2. No caught defect
  is relabeled as conversion success.

## Wire decisions and remaining native adoption

| Boundary            | Decision in this batch                                               | Native v2 completion requirement                                                                          |
| ------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Layout              | Mode-aware transient request; result geometry cannot change mode     | Qualified locally with real ELK/force and core Undo; existing engine limits apply                         |
| Mermaid             | Separate v2 projection bundle; v1 graph export remains strict        | Qualified locally; general import and roundtrip model reconstruction remain outside export                |
| Modelling patches   | Retain v1 source/revision/provenance/Apply contract                  | A new wire version must bind checkpoint mode, operations, dry-run and live Apply together                 |
| Conversion receipts | Retain v1 source/target evidence; no live authority                  | New receipt version and exact source/target validation across mapping, Apply and reopen                   |
| Review packets      | Retain v1 snapshots and deterministic audit/projection recomputation | New packet version with mode-aware audit comparison, v2 projections and reader support                    |
| Relationship audits | Retain strict graph/v1 model validators                              | Mode-aware graph validation and checkpoint comparison; domain rules must remain independent of port kinds |

An explicit downgrade remains the existing separate, reviewable operation. A
strict-compatible loose graph still loses future authoring semantics. An
incompatible checkpoint anywhere blocks whole-model downgrade. No adapter extracts
only the current graph to bypass an archived/origin conflict.

## Boundary review and alternatives

Verdict: **safe with noted risk**. Core owns mode, validation, layout transaction
and capability findings. Mermaid depends on public core codecs, not internal
validators. CLI owns bounded input, command selection and structured exits; it
never mutates a document. Static capabilities are not runtime permission proofs.

Rejected: widening v1 validators (old readers would reinterpret data), implicit
strict downgrade (authoring semantics disappear), a boolean allow-loose switch on
v1 Mermaid (protocol could hide different semantics), and introducing all three
portable wire schemas without their coupled audit/Apply/reopen invariants.
Additive request fields may affect consumers comparing whole request objects; old
handwritten requests still default to strict. V2 Mermaid bundles require consumers
to handle the new protocol explicitly.

## Implementation and evidence

Core: new capability module/root types, shared layout request and frame behavior.
Adapters: explicit Mermaid v2 entry and shared force validation. CLI: versioned
reader, command selection and incompatibility error. Tests: actual loose edges,
origin-only loss, atomic layout Undo/stale mode, real engines, strict legacy
rejection, CLI stdout/exits, installed Node/Bun consumer types/runtime.

See [batch evidence](../../packages/foldkit-zloz/evidence/portable-compatibility-v2.md).
Run `bun run check`, `bun typecheck`, `bun run test` and API docs. Restore original
source after any targeted mutation. No screenshot is required for this headless
and CLI slice; existing mounted history evidence remains a prior qualification.

Next: implement the native v2 audit, patch, receipt and packet wire contracts as a
single separately bounded authoring/review batch, retaining old readers.
