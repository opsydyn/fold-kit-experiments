# Zloz domain and compatibility reconciliation

Date: 2026-11-13. Inspected package source: `e9ab5880`, isolated branch
`codex/zloz-context-map`. This updates the D/C/Q inventory and recommendation in
[the November 12 audit](2026-11-12-zloz-core-completion-audit.md); its dated evidence
remains historical. Documentation only: no runtime, manifest or publishing change.

**Recommendation: pursue a bounded headless DDD relationship audit next.**
Current rules can validate one declared DDD relationship and protect edits, but
there is no public batch DDD audit. Reusing those rules would help users inspect
imported/converted architecture models without redesigning storage or connection
semantics. This is a product/engineering inference from the inspected APIs and
the user's architecture-first direction, not measured demand or a validated USP.
Core completion and full React Flow parity remain unestablished.

## What is already delivered

“Implemented locally” means reusable source plus the linked tests/receipts; it
does not mean published, deployed, manually accessible or universally qualified.

| Area                           | Current package contract                                                                                                  | Evidence and bounded conclusion                                                                                                                                                                                                                                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authored edges (E1)            | `ZlozEdge.waypoints`, editing/resolution controls, codec and native geometry precedence                                   | [Contract](../../packages/foldkit-zloz/evidence/edge-waypoints.md), [interaction](../../apps/zloz-demo/evidence/waypoint-controls.md). Portable edits are distinct from transient layout routes.                                                                                                                                                |
| External placement (E2)        | `createPlacement`, `resolvePlacement`, `applyPlacement`, package native/custom placement controls                         | [Package](../../packages/foldkit-zloz/evidence/placement.md), [workbench](../../apps/zloz-demo/evidence/palette.md). Local pointer/keyboard and emulated-touch evidence; OS parsing stays host-owned.                                                                                                                                           |
| Export (E3)                    | `planSvgExport`, `writeSvgExport`, `captureSvgLayout`, `resolveSvgReview`, `resolvePngReview`; optional `renderPngExport` | [Retained SVG](../../apps/zloz-demo/evidence/svg-retained.md), [retained PNG](../../apps/zloz-demo/evidence/png-retained.md). Independent opt-ins, centre label anchors, vector context, exact-artifact consent, stale-result and pixel budgets are implemented. Custom HTML, font ink and collapsed UI reproduction remain explicit limits.    |
| Review/patch lifecycle (P1/P2) | Strict packet readers and modelling-patch decode/dry run/review/Apply                                                     | [Reader](../../apps/zloz-demo/evidence/review-reader.md), [P2 completion](../../apps/zloz-demo/evidence/p2-completion.md). No need to rebuild this lifecycle.                                                                                                                                                                                   |
| Domain vocabulary              | `C4NodeArchitecture`, `DddNodeArchitecture`, `EventStormingNodeArchitecture`                                              | [Definitions](../../packages/foldkit-zloz/src/architecture.ts): four C4, **nine** DDD roles including read-model, four EventStorming roles. C4 internal/external scope exists; it is not an EventStorming external-system card.                                                                                                                 |
| DDD meaning and editing        | `dddRelationshipRules`, `resolveDddRelationship`, `dddRelationshipPolicy`, relationship/side-role controls                | [Resolver](../../packages/foldkit-zloz/src/ddd-relationships.ts), [tests](../../packages/foldkit-zloz/test/ddd-relationships.test.ts), [controls](../../apps/zloz-demo/evidence/ddd-relationship-controls.md). Tactical/strategic conventions, custom catalogues and opt-in live vetoes exist. A resolver/policy is not a model-wide audit.     |
| Read models                    | `resolveDeclaredConsumption`, tactical `feeds`, native read-model role                                                    | [Contract/tests](../../packages/foldkit-zloz/test/declared-consumption.test.ts), [receipt](../../packages/foldkit-zloz/evidence/declared-consumption.md). Logical dependencies only; no event filter or executable runtime promise.                                                                                                             |
| Mapping                        | EventStorming-to-DDD preview, plan, exact loss consent, atomic Apply and portable receipt                                 | [Apply evidence](../../packages/foldkit-zloz/evidence/event-storming-ddd-apply.md). Does not implement EventStorming-to-C4 conversion or production Mermaid import.                                                                                                                                                                             |
| Layout envelope                | `LayoutEdgeLabel`, `LayoutGroupHeaderSpec`, `layoutRequest`, preview/apply; explicit measurement/freshness helpers        | [Labels](../../apps/zloz-demo/evidence/measured-labels.md), [headings](../../apps/zloz-demo/evidence/measured-group-headers.md), [ELK tests](../../packages/foldkit-zloz-elk/test/layout.test.ts). Declared/measured boxes and intrinsic headings exist; continuous automatic layout and arbitrary overflow/collision freedom are not promised. |

E1–E3/P1–P2 implementation chains are delivered within these documented limits.
Their cross-browser, device, hydration and performance qualification is not closed
by that statement. The private Alchemy descriptor workflow is a separate adapter
stream; it does not add core domain roles or close SDK/provider compatibility.

## Domain decisions still needed

Status describes the inspected implementation. A proposed disposition below is
**not an approved exclusion or an implemented API**. These rows remain open until
implementation evidence or explicit scope approval satisfies the closure criteria.

| ID                              | Observed package boundary                                                                                                                                                                                             | Proposed disposition and closure                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1a — wider workshop vocabulary | EventStorming supports command/domain-event/policy/actor. DDD read-model is a different family. No first-class workshop external-system/hotspot/lane roles were found.                                                | **Defer after D2, pending approval.** Separate semantic participants (e.g. external systems) from annotations (hotspots) and layout/ownership frames (lanes). Decide the first required roles, strict codec/history behavior, relationship conventions and renderer controls before adding them. Arbitrary `data`/custom artwork is an extension point, not parity. |
| D1b — EventStorming → C4        | Existing public mapping/conversion APIs target DDD. C4 rendering and Mermaid C4 projection are present.                                                                                                               | **Investigate later, pending approval.** Define actor/person and system/container candidates, explicit choices, identity/provenance and loss reporting before conversion. Do not infer one C4 container per workshop card. Existing DDD consent machinery is a pattern to reuse, not an already-delivered C4 mapper.                                                |
| D2 — DDD audit catalogue        | Batch `auditEventStormingRelationships` and edition comparison interpret causal conventions; DDD edges are reported unrelated. `resolveDddRelationship` validates individual DDD declarations under configured rules. | **Implement next, recommended.** First audit authored DDD edge conventions using that resolver. Cover incompatible participants, unknown/custom convention and same-context strategic relations. Respect optional side-role absence; add no inferred meaning or universal DDD correctness rules. CLI/UI/comparison follow after the headless report is qualified.   |

The distinction is directly protected by
[the mixed-family regression](../../packages/foldkit-zloz/test/ddd-relationships.test.ts):
DDD meaning survives causal policies/controls and remains unrelated to the causal
audit. Re-labelling that existing audit as DDD-complete would be incorrect.

## Compatibility decisions still needed

Official React Flow references were rechecked on 2026-11-13. This is a bounded
behavioural comparison, not a prop-by-prop audit or parity percentage.

| ID                      | Current Zloz behavior and evidence                                                                                                                                                                                                                                                                                                                                                                             | Comparison and recommended disposition                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1 — connections        | [Structural graph validation](../../packages/foldkit-zloz/src/graph.ts) and [connection validation](../../packages/foldkit-zloz/src/connection-validation.ts) enforce source output → target input. Public `ZlozEdge` documents that invariant. There is no loose mode.                                                                                                                                        | React Flow documents [Strict and Loose connection modes](https://reactflow.dev/api-reference/types/connection-mode). **Propose retaining strict defaults and scheduling loose-mode design separately.** A view callback cannot widen the persisted graph invariant. Any implementation needs a direction/port-kind, codec, creation/reconnection, policy, clipboard and compatibility decision. Remains open pending approval.                                                  |
| C2 — groups             | Groups require `kind: 'group'`, world-coordinate children and no ports. [Core tests](../../packages/foldkit-zloz/test/core.test.ts) cover descendant moves/Undo, membership, copy/paste, collapse, extent/expansion and resizing. [DDD tests](../../packages/foldkit-zloz/test/ddd-relationships.test.ts) reject invented group ports; logical context references do not invent drawable endpoints.            | React Flow uses [parent-relative child positions and also permits other node types as parents](https://reactflow.dev/learn/layouting/sub-flows); its default group type has no handles. **Propose retaining world coordinates as a documented difference.** Drawable groups require a separate endpoint/geometry/storage contract. Existing nested/export fixtures are useful evidence, not universal grouped-UI equivalence. No approval to exclude ported groups is inferred. |
| C3 — layout support     | [ELK](../../packages/foldkit-zloz-elk/README.md) maps fixed ports and nested graphs to ELK Layered; [force eligibility](../../packages/foldkit-zloz-force/src/eligibility.ts) is nonempty, flat, at most 100 nodes. Author bends/pathStyle override transient routes. Public `LayoutEngine` is a Promise, not an AbortSignal/worker cancellation API. Host request/revision checks suppress stale publication. | React Flow presents [external layout libraries](https://reactflow.dev/learn/layouting/layouting), not a built-in layout engine. **Propose accepting the documented ELK/force envelope and deferring Dagre unless a concrete workflow needs it.** Dropping a request or interrupting a Command does not stop ELK computation; caller-owned worker lifetime remains explicit. No universal algorithm or scale parity claim. Final envelope acceptance remains open.               |
| C4 — advanced catalogue | No public native contract was found for rotation-aware geometry, lasso/freehand/eraser or atomic multi-connection creation. No production Mermaid import/parser export was found in [the Mermaid entry](../../packages/foldkit-zloz-mermaid/src/index.ts). SVG writing is server-safe; PNG rasterization needs the optional browser entry.                                                                     | The [example catalogue](https://reactflow.dev/examples) includes whiteboard tools and browser/server image workflows, some Pro examples. They are not all built-in editor APIs. **Propose individual deferrals below, pending approval**, rather than a blanket “extensible, therefore equivalent” claim.                                                                                                                                                                       |

Advanced-catalogue disposition must stay item-specific:

| Candidate                     | Proposed priority / why                                                                                                                         | Evidence required if pursued                                                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Rotation-aware nodes          | Defer after architectural review/audit value; CSS transforms do not implement rotated geometry.                                                 | Authored angle, transformed port/edge/resize/hit/selection/fit/export geometry, codecs and one Undo.                                   |
| Lasso, freehand, eraser       | Defer as whiteboard scope; rectangle selection and normal deletion are not substitutes.                                                         | Headless gesture/selection/annotation contracts, protected/atomic erase, pointer/touch/keyboard alternatives and visual qualification. |
| Multi-connection conveniences | Defer until a concrete architecture editing flow is chosen. Single-connection choosers already exist; general custom UI is not batch semantics. | Atomic batch preview/apply, every-edge live policy, duplicate/cycle conventions where specified, rollback and one Undo.                |
| Production Mermaid import     | Defer parser/round-trip work; current strict packet reading and identity metadata do not parse arbitrary Mermaid source.                        | Bounded parser/decode policy, supported syntax, identity/ambiguity and explicit conversion losses before Apply.                        |
| Server image creation         | Retain pure standalone SVG writing; defer a first-class headless PNG host adapter. Browser PNG is delivered locally.                            | Runtime/resource ownership, fonts/custom vectors, reproducibility and pixel/byte/deadline limits in the declared server environment.   |

[ADR 0038](../adr/0038-define-ddd-relationship-contracts.md) already distinguishes
logical portless references from drawable graph edges and preserves strict ports.
Retaining that implementation is not a new architecture decision; accepting its
limits for a bounded parity claim is the still-open scope decision.

No domain/compatibility row is closed merely by this recommendation. Automatic
persistence, collaboration/team runtimes and provider activation remain separate
streams; their absence from this core slice does not make them completed features.

## Recommended next core feature: headless DDD relationship audit

**Pursue, conditional on feature approval.** Architecture authors currently have
individual resolver calls and optional editing vetoes, while imported/converted
DDD graphs lack a reusable read-only batch report. The proposed feature connects
existing meaning to review without changing the editor grammar.

Compare alternatives: loose connections affect a structural wire invariant;
workshop-role expansion and C4 conversion need more semantic decisions; another
layout algorithm duplicates coverage before a demonstrated need. A DDD audit
reuses an existing explicit rule catalogue and is directly useful to the model
review/agent workflow. Its value is inferred; usage frequency and task-success
baseline are unknown. It is not a superiority claim over another editor.

Proposed appetite: one package-only implementation session, capped at one
engineer-day including tests/docs and installed-consumer checks. A later CLI,
workbench and edition-comparison slice needs its own bounded scope.

Proposed contract (names are illustrative, **not public exports yet**):

- `auditDddRelationships(graph, options)` consumes a structurally validated graph
  and the existing DDD convention catalogue. State the input-validation boundary
  explicitly; malformed wire syntax belongs to decoding, not invented audit meaning.
- Represent every authored edge in deterministic UTF-16 edge-ID order. Typed DDD
  edges resolve as compatible/blocked under the chosen convention; untyped and
  other-family edges are explicitly unrelated, with no causal or DDD inference.
- Return detached data-only identity, endpoint, descriptor/convention key, code,
  reason and summary fields. A “compatible” convention report must not imply all
  edges are DDD-typed or that the architecture is universally correct.
- Reuse current blocked decisions such as incompatible roles, unknown convention
  and same-context strategic relations. Do not add mandatory side roles, cycle
  rules, aggregate ownership inference, executable consumption or topology advice
  without a separate agreed convention. `feeds` uses current explicit source roles.
- Leave source, graph/Undo, editions, editor policies and all wire formats unchanged.
  Auditing is read-only and does not grant Apply permission or silently fix models.

Acceptance evidence for the first slice:

1. Literal expected reports for valid tactical/strategic/feeds links, incompatible
   participants, unknown custom conventions, self-context strategic links and
   unrelated mixed-family/untyped edges.
2. Custom catalogue changes affect the report; invalid catalogues reject even on
   empty graphs. Test deterministic ordering under graph-array reordering,
   detachment and unchanged source/editor history.
3. Actual packed Node/Bun runtime and strict TypeScript consumers work without UI
   peers. Root check/typecheck/tests pass. No invented DDD findings or renderer-only
   implementation counts as completion.

Stop/reshape if useful findings require new storage, inferred domain semantics or
a second grammar inconsistent with `resolveDddRelationship`. Do not silently spend
the slice on new roles, CLI/UI, patch Apply, loose connections or SDK integration.
Primary future product check: can a reviewer identify the deliberately invalid
DDD links and explain the convention reason without editing the graph? Baseline,
comparison cohort and real-user task results are not measured in this audit.

## Qualification and release gates remain separate

| Gate                                    | Evidence now available                                                                                                                                                                                                                                                                                                                                       | Still needed before bounded completion                                                                                                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1 — packages/rendering                 | Current root tests include installed core/optional-adapter consumers and literal codec fixtures; native view tests include SSR string rendering.                                                                                                                                                                                                             | Explicit TypeDoc/export review and declared SSR→client hydration/interaction proof without mismatch. Browser-mounted demos and SSR string assertions alone do not close hydration.                                  |
| Q2 — performance                        | Chooser/camera benchmark scripts and historical receipts exist. Measurement/export changes have correctness evidence.                                                                                                                                                                                                                                        | Agreed workload budgets, current source/machine/browser and sample/warm/cold conditions for flat/nested/custom/policy/history paths. No new timing, paint, memory or matched competitor measurements were run here. |
| Q3 — comprehensive accessibility/device | Slice-specific native-control, keyboard, reduced-motion and local Chromium evidence exists.                                                                                                                                                                                                                                                                  | Comprehensive manual AT, keyboard/recovery, device/browser, zoom/contrast and theme/minimal matrix after functional work, as requested. Keep accessible interaction in every feature now.                           |
| Q4 — scope/evidence closure             | This report identifies implemented chains and item-specific open decisions.                                                                                                                                                                                                                                                                                  | Explicit approval for proposed retained differences/deferrals, D1/D2/C1–C4 disposition and linked acceptance receipts. No automatic core-complete declaration.                                                      |
| R1 — publication guard                  | The inspected isolated CLI manifest still lacks the requested `private: true` guard and retains public publish/pack configuration. [ADR 0036](../adr/0036-publish-the-zloz-package-family-to-npm.md) is marked **Proposed**, states unpublished CLI intent, and does **not** explicitly require that field; the older audit's attribution is corrected here. | Separate release-tooling/manifest reconciliation before any release; do not edit another stream or infer main/registry status from this branch. No publication is authorized.                                       |

## Work receipt

- result: complete
- claim: remaining domain/compatibility gaps are reconciled against current package source and evidence; a bounded DDD audit is recommended, not implemented or approved by this document.
- evidence: inspected `e9ab5880` public entries, implementations, linked tests/receipts and the dated official comparison references; root check/typecheck/full tests and local link/export checks pass.
- remaining uncertainty: proposed scope decisions are unapproved; no fresh browser, hydration, manual AT, benchmarks, current CI/registry or hosted qualification. Existing visual receipts retain their stated revisions and limits.
- next: approve a headless DDD relationship audit using the current resolver/catalogue, then add optional review/CLI/comparison surfaces separately.

Only this assessment, the roadmap and a historical-audit continuation pointer
change. No runtime tests are added for documentation. Current command logs:
`/private/tmp/zloz-gap-reconciliation-{check,types,tests}.log`. Existing advisories
and configured skips remain; a passing suite does not refresh historical visual,
performance or manual acceptance evidence.

Recommendation: **needs review** for the proposed feature and scope dispositions.
