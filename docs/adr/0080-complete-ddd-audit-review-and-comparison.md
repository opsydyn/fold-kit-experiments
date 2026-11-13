# ADR 0080: Complete the DDD audit review and comparison workflow

## Status

Accepted for the approved combined delivery slice, 2026-11-13. Extends ADRs 0078
and 0079 using the existing causal comparison, controls and history-review pattern.
Architecture, boundary, delivery and test-quality reviews are self-review.

## Decision

Core owns `compareModelDddRelationships`, which captures the model and audits the
chosen owned baseline edition and explicit target edition/current graph under one
DDD catalogue. Findings match by authored edge ID and code. A changed code resolves
the old finding and introduces the new one; persisting retains both projections.
Presentation changes preserve finding identity. No-new-findings means no regression,
not compatibility. Unknown selectors block; origin editions are not implicitly owned.
No graph, snapshot, edition, Undo or codec changes.

Add package-owned DDD review controls for standalone current/edition audit and
optional baseline comparison. Baseline null means single-target review, never an
implicit baseline. Controls include filters, reasons, labels and exact finding
navigation requests for edge or source/target node. Recompute against live input,
selection, filters and host policies before navigation. Bind requests to model,
selection, finding data and category so stale controls cannot navigate changed
findings. Return explicit source identity and reveal events, never restore history.
Optional FoldKit views are unstyled, independently composable and omit/replaceable;
labels, reasons, native keyboard controls and count visibility are first class.

Effect CLI adds `ddd compare --baseline ID [--edition ID] [--rules FILE]`.
`ddd-compare` is additive to protocol v1. Exit 0 means no introduced findings,
1 means a regression, 2 means invalid input/rules/selector/invocation. Audited
incompatibility remains `ddd audit` exit 1. Reuse bounded UTF-8 document/rule reading
and one JSON record framing. CLI has no graph writes or browser dependency.

Astro composes public APIs in the History sidebar. Navigation pauses playback and
opens the relevant immutable edition or current graph while preserving working
model/Undo. Examples add owned synthetic editions without replacing working data.
Minimal mode/diagnostics hide optional counts, not reasons or functional controls.

## Alternatives and consequences

Keeping UI/comparison separate prolongs an incomplete review journey. Converting
causal contracts into a generic audit framework would broaden compatibility risk;
family-specific adapters reuse existing mechanisms and retain distinct report types.
The cost is deliberate parallel vocabulary in public APIs. No DDD inference,
mandatory side roles, topology certification, new rule semantics, DDD packets,
workshop vocabulary expansion, EventStorming-to-C4 conversion, dependencies,
publishing, deployment or provider activation belongs to this slice.

## Implementation and verification

- Core comparison and review modules, root exports and optional FoldKit view entry.
- Literal DDD model fixtures and independent expected delta outcomes; source
  detachment, strict selectors, custom conventions, stale/filtered/policy rejection.
- Native/custom/omitted views and node/edge navigation, including diagnostics counts.
- Effect command/protocol and real installed Node/Bun process 0/1/2 tests.
- Workbench typed messages/state, guarded updates, light/dark/browser evidence,
  read-only edition navigation and preserved working graph/Undo.
- Root check/typecheck/tests, API docs, package consumer checks, evidence receipt
  and reconciled roadmap before commit. No npm publication.

Rollback before release is a revert/rebuild; authored documents are unchanged.
Revisit if users require different finding identity or shared cross-family packets.
