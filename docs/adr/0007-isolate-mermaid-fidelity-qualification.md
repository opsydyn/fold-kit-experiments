# ADR 0007: Isolate the Mermaid fidelity spike

## Status

Accepted for the user-approved bounded spike on 2026-11-08. This selects pinned
qualification dependencies, not a production parser or a published adapter API.
Revisit at the next adapter decision, or by 2026-11-22. Follows ADR 0003's pure
core boundary and the approved Mermaid/agent/edition assessment.

## Decision

Use a private `experiments/mermaid-fidelity` project outside the active Bun
workspaces, with an independent npm lockfile. Consume the packed public Flow core
and pin `mermaid-ast` 0.8.2 for a restricted import prototype. Qualify official
`@mermaid-js/parser` 2.0.1 as a negative control and Mermaid 12.3.0 as the syntax
oracle. TypeScript 6.0.3 and Effect 4.1.0 provide local compilation and an explicit
runtime schema for out-of-band identity metadata. No dependency enters core or
the Astro app; no production export, provider, writable CLI or edition storage
is introduced.

The minimum artifact is a dozen authored fixtures, a small SDK prototype and a
read-only stdin/stdout driver, tested on Node and Bun. Input is bounded in size.
Unsupported structure/semantics reject with no graph. Known presentation losses
must be explicit and can be rejected by caller policy. Source declarations that
the candidate silently drops require a conservative statement-level feature
gate; this is not a replacement Mermaid grammar. Multiline/unsupported metadata
outside the declared subset is rejected rather than guessed.

Identity means stable node, named edge and port IDs, not equal array ordering,
layout or full document fidelity. Implicit edge IDs must be reported as generated
and stable only within unchanged endpoint-pair occurrence order. Exported Mermaid
uses safe aliases plus a validated identity map; source alone cannot preserve
arbitrary Flow IDs/ports. The map contains only identity/kind/endpoints, not a
hidden full graph. A mismatched map rejects. Canonical Flow JSON stays separate.

Early probes already show the candidate includes `@` in named edge IDs, its
renderer drops edge IDs, and its AST drops node `style` declarations. Use only
its public parse API behind a pinned normalization boundary; do not use its
renderer as a fidelity-preserving exporter. Our emitter must quote/encode labels
and name edges explicitly. These limitations prevent a general parser endorsement.

The official parser rejects the flowchart type. Official Mermaid's public parse
API fails headlessly on DOMPurify in the initial Node probe. Use a local browser
oracle for independent syntax acceptance of original/generated text, not for AST
extraction or conversion. Do not patch browser globals into the SDK.

## Alternatives and boundaries

- Adding Mermaid/CLI to core would compromise the qualified dependency-free root.
- Depending on Mermaid's private diagram database would not qualify a public AST
  boundary and would entangle conversion with runtime internals.
- Writing/forking a full grammar exceeds the approved appetite.
- Export-first remains a valid reduced outcome if the restricted import contract
  fails; the spike can conclude that a parser is not production-ready.

Boundary review: **safe with noted risk**. Parser input is treated as data;
callbacks/links are never executed. The experiment returns values and diagnostics
only, keeps Flow metadata namespaces intact and validates produced graphs with
the public core. The existing localhost C4 preview is left running.

## Verification

- [x] Pin versions/integrities and record the core tarball identity.
- [x] Qualify parser behavior and independent Mermaid syntax acceptance.
- [x] Check labels/Unicode, named and generated IDs, parallel edges, cycles,
      subgraphs/boundary edges, styles/callbacks, unsupported outlines and bad syntax.
- [x] Import → core edit → export → reimport preserves declared identities/facts;
      strict loss policy rejects and mismatched maps produce no graph.
- [x] SDK/read-only CLI outputs match on Node and Bun.
- [x] Run standalone tests/typechecks and required workspace gates, write a
      qualification report and recommend the next bounded slice before committing.

Recovery is deleting/reverting the isolated experiment; no document migration or
published consumer is involved. No upstream parser source is vendored here.

The [qualification report](../assessments/2026-11-08-flow-mermaid-fidelity-spike.md)
records the completed spike and the export-first recommendation. A further valid
leading-comment case is rejected by the AST candidate. Production import adoption
remains unqualified.
