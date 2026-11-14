# Zloz core roadmap and compatibility reconciliation

Delivery follow-up (standalone contract): the approved C1 headless strict/loose mode and standalone v2
wire contract is implemented locally; see [ADR 0092](../adr/0092-stage-explicit-v2-connection-documents.md)
and [qualification](../../packages/foldkit-zloz/evidence/connection-v2.md).
This assessment retains its `7fa7b3d9` inventory. Its original next step was
headless editor adoption, delivered in the follow-up below; portable integration
and native/custom controls remain open. C2–C4/Q/R decisions are unchanged.

Editor follow-up: [ADR 0093](../adr/0093-adopt-connection-mode-in-headless-editor.md)
and [qualification](../../packages/foldkit-zloz/evidence/connection-editor.md)
record fixed-mode headless initialization, live creation/reconnection validation,
contexts and atomic history. Native/custom input and workbench follow below;
portable adapters and broader qualification remain open. The original inventory
below remains its dated baseline; C2–C4 and Q/R gates are unchanged.

Interaction follow-up: [ADR 0094](../adr/0094-adopt-loose-mode-in-native-port-interactions.md)
and [qualification](../../packages/foldkit-zloz/evidence/connection-interactions.md)
record package-owned native/custom behavior and the independent connection
workbench. C1 remains partial at portable and broader qualification boundaries;
canonical model/edition mode contracts are recommended next.

Canonical follow-up: [ADR 0095](../adr/0095-stage-canonical-v2-model-and-edition-documents.md)
and [qualification](../../packages/foldkit-zloz/evidence/model-v2.md) record explicit
v2 models/editions, per-checkpoint modes, compatibility fixtures and whole-document
downgrade review. The canonical contract recommendation is delivered locally;
package-owned v2 initialization/read-only edition review is next. C1 and wider
C/Q/R gates remain partial.

- result: complete
- claim: the remaining roadmap is reconciled against package APIs and bounded evidence at `7fa7b3d9`; opt-in loose connection semantics is the recommended next core feature, not implemented by this assessment.
- evidence: public exports, validators, adapters, literal/consumer tests, ADRs 0078–0091 and linked local receipts; official comparison references checked on 2026-11-14; verification results below.
- remaining uncertainty: compatibility dispositions remain unapproved; comprehensive hydration, performance/device/AT, current CI, registry and hosted acceptance remain open.
- next: approve a bounded headless loose-connection contract and wire-compatibility slice before adding interaction controls.

Date: 2026-11-14. Source baseline: `7fa7b3d9`, isolated branch
`codex/zloz-context-map`. This documentation-only assessment supersedes the current
inventory/recommendation in [November 13's reconciliation](2026-11-13-zloz-domain-compatibility-reconciliation.md).
The [November 12 audit](2026-11-12-zloz-core-completion-audit.md) remains the original
closure framework. Historical receipts retain their own revisions and limits.
This review approves no new feature, blanket exclusion, dependency, release or deployment.

## What the completed chain now supports

The approved domain slices are implemented locally. Their functional completion
must not be confused with closing C1–C4/Q1–Q4, publication or universal modelling
correctness. Four C4, nine DDD and seven EventStorming node roles are present in
[the architecture contract](../../packages/foldkit-zloz/src/architecture.ts).
A further vocabulary/rule catalogue is a new scope decision, not an automatically
reopened obligation to support every possible modelling notation.

| Criterion                           | Public package API / owner                                                                                                                                         | Evidence and current disposition                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1–E3 editor floor                  | Core authored waypoints, placement, SVG planning/writing/review and PNG review; optional Foldkit controls and browser rasterizer                                   | [Waypoints](../../apps/zloz-demo/evidence/waypoint-controls.md), [palette](../../apps/zloz-demo/evidence/palette.md), [retained SVG](../../apps/zloz-demo/evidence/svg-retained.md), [retained PNG](../../apps/zloz-demo/evidence/png-retained.md). Approved functional chains delivered locally; no new implementation needed to close those same chains. Export fidelity limits and Q qualification remain.                                                                                      |
| P1/P2 portable review and patches   | Optional Mermaid `parseReviewPacket` and reader controls; core `parseModellingPatch`, `dryRunModellingPatch`, `resolveModellingPatchReview`, `applyModellingPatch` | [Packet reader](../../apps/zloz-demo/evidence/review-reader.md), [patch completion](../../apps/zloz-demo/evidence/p2-completion.md). Reviewed data, exact freshness/consent, atomic Apply and provenance are delivered for the approved scopes. No automatic writable agent, collaboration or storage runtime follows from this.                                                                                                                                                                   |
| D1a workshop vocabulary             | `resolveEventStormingNodeSemantics`, `createEventStormingWorkshopPattern`, role/status controls; Foldkit participant/hotspot/lane renderers                        | [Semantic contract](../../packages/foldkit-zloz/evidence/event-storming-workshop.md), [native controls](../../apps/zloz-demo/evidence/workshop.md), [SVG/PNG artwork](../../apps/zloz-demo/evidence/workshop-export.md). External-system, open/resolved hotspot and organizational lane support now joins the original four roles. Approved semantic/render/export slice delivered; lanes do not imply runtime ownership.                                                                          |
| D1b C4 mapping and Apply            | `previewEventStormingC4Mapping`, `createEventStormingC4ConversionPlan`, `resolveEventStormingC4ConversionConsent`, `applyEventStormingC4Conversion`                | [Plan](../../packages/foldkit-zloz/evidence/event-storming-c4-conversion-plan.md), [atomic Apply](../../packages/foldkit-zloz/evidence/event-storming-c4-apply.md), [workbench](../../apps/zloz-demo/evidence/c4-apply.md). Explicit mappings/placements, ambiguity/losses, source provenance, current policies/lifecycle and one Undo are delivered. C4 containment is explicit system→container or container→component in existing group boundaries, not inferred from lanes or pixel enclosure. |
| D1b portable receipt and inspection | `serializeEventStormingC4Conversion`, `parseEventStormingC4Conversion`; Effect CLI `c4 receipt inspect`; app file I/O and detached comparison                      | [Portable receipt](../../apps/zloz-demo/evidence/c4-receipt.md), [CLI](../../packages/foldkit-zloz-cli/evidence/c4-receipt-inspect.md). Strict source/choices/target validation, download, read-only Before/After and change navigation are delivered locally. CLI exits 0/1/2 for valid/incompatible/invalid input. CLI 1 MiB and workbench 5 MiB limits are explicit; oversized downloads are refused. Imported acceptance never grants Apply authority.                                         |
| D2 DDD audit/review/delta           | `auditDddRelationships`, `compareModelDddRelationships`, `resolveDddAuditControls`, `resolveDddAuditRequest`; CLI `ddd audit/compare`                              | [Package audit](../../packages/foldkit-zloz/evidence/ddd-relationship-audit.md), [full workflow](../../apps/zloz-demo/evidence/ddd-audit.md), [CLI](../../packages/foldkit-zloz-cli/evidence/ddd-audit.md). Approved authored tactical/strategic/read-model convention audit and review/deltas delivered. Mixed families remain unrelated; no inferred DDD meaning or universal architecture-correctness claim.                                                                                    |

Source and evidence establish these bounded package capabilities, not a validated
USP or measured customer demand. Astro composes state and Commands; it is not the
sole implementation of the modelling rules. C4/DDD receipts, review packets, model
archives and patches remain distinct contracts.

## Remaining compatibility criteria

The IDs C1–C4 below name compatibility rows; C4 here is not the C4 notation family.
Official references were checked on 2026-11-14. This is a bounded behavioural
comparison, not a prop-by-prop React Flow audit or parity percentage.

| Criterion                         | Current package evidence                                                                                                                                                                                                                                                                                                                                                                   | Still required / proposed disposition                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1 — connection kinds             | [Graph validation](../../packages/foldkit-zloz/src/graph.ts) and [connection validation](../../packages/foldkit-zloz/src/connection-validation.ts) require output→input; no persisted loose mode is exported.                                                                                                                                                                              | **Recommend implementing next, pending approval.** React Flow documents [Strict and Loose modes](https://reactflow.dev/api-reference/types/connection-mode). An opt-in contract needs a wire/default/migration decision plus shared validation, policies, creation/reconnection and portable-edit coverage. A renderer or permissive callback cannot widen the current graph invariant.                                                                                |
| C2 — group semantics              | Groups are portless, require `kind: 'group'`, and children use world coordinates; [core](../../packages/foldkit-zloz/test/core.test.ts), [layout](../../packages/foldkit-zloz/test/layout.test.ts) and [ELK](../../packages/foldkit-zloz-elk/test/layout.test.ts) tests cover declared nested behavior.                                                                                    | **Still open.** [React Flow sub-flows](https://reactflow.dev/learn/layouting/sub-flows) use parent-relative positions and permit other node types as parents; its convenience group type has no handles. Propose retaining world coordinates as an intentional difference, subject to explicit scope approval. Drawable group endpoints need their own geometry/storage/interaction decision or an approved deferral; logical DDD frame references do not supply them. |
| C3 — layout envelope              | `LayoutEngine` is Promise-based. [ELK](../../packages/foldkit-zloz-elk/README.md) supports compound graphs/fixed ports/label and header hints; [force eligibility](../../packages/foldkit-zloz-force/src/eligibility.ts) allows nonempty, flat, group-free graphs up to 100 nodes. Stale suppression is separate from stopping engine computation; caller owns worker lifetime.            | **Envelope acceptance still open.** Propose accepting documented bounds and deferring Dagre until a concrete workflow needs it. [React Flow's layout guide](https://reactflow.dev/learn/layouting/layouting) presents external engines, not its own engine; lack of Dagre is not alone a missing built-in editor API. Broader scale, worker cancellation and collision freedom are not established.                                                                    |
| C4 — rotation and whiteboard      | No authored-angle geometry or native lasso/freehand/eraser contracts found in the inspected public graph/event exports.                                                                                                                                                                                                                                                                    | **Open item-specific decisions.** Propose deferral behind architecture editing value, not an approved exclusion. Rotation requires transformed ports/hit/resize/selection/export geometry; whiteboard tools need their own gesture/data/protection/Undo and accessible alternatives. The [example catalogue](https://reactflow.dev/examples) includes these workflows; examples are not all built-in APIs.                                                             |
| C4 — multi-connection convenience | P2 already supports multiple `edge.add`/replace/remove operations in one [patch contract](../../packages/foldkit-zloz/src/modelling-patch.ts) and [guarded Apply](../../packages/foldkit-zloz/src/modelling-patch-apply.ts), with live endpoint/connection checks and one commit. [Tests](../../packages/foldkit-zloz/test/modelling-patch-apply.test.ts) qualify atomic edits and vetoes. | **Partially covered, dedicated interaction open.** Correct the older blanket statement that no atomic batch foundation exists. This is not a qualified selection-driven fan-out chooser or native multi-connect gesture. If pursued, compose the existing transaction machinery and add explicit target/rejection/rollback evidence rather than another batch engine.                                                                                                  |
| C4 — production Mermaid import    | Optional [Mermaid exports](../../packages/foldkit-zloz-mermaid/src/index.ts) expose export, packets and strict packet readers, not arbitrary-source import. [Pinned November 8 spike](2026-11-08-flow-mermaid-fidelity-spike.md) is private historical research with parser/grammar/fidelity limits.                                                                                       | **Open, propose deferral pending renewed qualification.** Do not promote the prototype or describe packet/receipt reading as parsing Mermaid. A production subset needs bounded grammar, identity/ambiguity/loss policy and a refreshed differential corpus before Apply. No current parser-version or hostile-input performance claim is made here.                                                                                                                   |
| C4 — server image creation        | Standalone SVG writing is server-safe; PNG encoding uses the optional browser entry, with [Node/SSR-safe import checks](../../packages/foldkit-zloz/test/package.test.ts) and explicit unsupported results outside a browser.                                                                                                                                                              | **Open host decision.** Propose retaining pure server SVG and deferring a first-class server PNG adapter pending a chosen runtime/font/resource owner and pixel/byte/deadline budgets. A browser screenshot or browser PNG does not qualify server rasterization.                                                                                                                                                                                                      |

None of these proposed dispositions is accepted merely because this reconciliation
was approved. C1 implementation is the recommended next feature; C2–C4 still need
explicit implement/retain/defer/exclude decisions before bounded core closure.
Automatic storage, collaboration and executable team/dataflow runtimes remain
separate planning streams; they are not silently counted as delivered.

Wire identity is separate from branding. [Accepted ADR 0015](../adr/0015-migrate-the-public-package-family-to-zloz.md)
retains graph v1, Mermaid `flowId` and `foldkit-flow-mermaid/v1`, storage/input/theme
hooks and deprecated aliases for compatibility; public package names are Zloz.
These are existing accepted preservation rules, not new scope exclusions. A future
mode or protocol migration needs an explicit reader/version strategy, not a global
text replacement. Current receipts and packet/model archives keep distinct envelopes.

## Adapter and release compatibility

The [private Alchemy adapter](../../packages/foldkit-zloz-alchemy/README.md) separates
portable descriptor projection from trusted `/domain` inspection. Its manifest is
private and pins the SDK pair to beta.85; other versions remain unqualified. The
README records strict-optional negative probes and a branch-core versus registry
artifact warning. That is a recorded gate, not a fresh registry check or a claim
that every package labelled 0.3.0 has the same capabilities. Native read-model and
`resolveDeclaredConsumption` contracts do not implement stream processing or a
Domain runtime. No broader SDK/provider compatibility is granted by core receipts.

**R1 remains open:** the inspected CLI manifest is 0.1.0, lacks the requested
`private: true`, and retains public publish configuration. The current
[publish workflow](../../.github/workflows/publish.yml) does exclude CLI from its
choice allowlist, while [local pack tooling](../../tools/pack-zloz.ts) explicitly
accepts CLI for consumer qualification. Those are different facts: local packing
is not publication, and the allowlist is not the requested manifest guard.
Reconcile that guard/pack/release policy in the release stream before any release.
No manifest, workflow, registry or deployment is changed by this document.

## Qualification gates still open

| Gate                            | Evidence now available                                                                                                                                                                                                                   | Closure still needed                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1 — package/rendering          | Scoped receipts and current checks exercise packed Node/Bun consumers, literal codecs, declaration contracts, SSR strings and local mounted interactions. New C4 receipts/CLI have independent literal fixtures and installed consumers. | A declared supported-version/entry matrix with linked TypeDoc/export review and explicit Zloz SSR→client hydration/interaction acceptance. Older architecture compatibility evidence is scoped to its pinned old bundle; it does not establish every new role/receipt/adapter with all old artifacts. SSR strings and mounted demos do not alone close hydration. |
| Q2 — performance                | Historical camera/chooser/cache scripts and receipts exist; force eligibility is explicit.                                                                                                                                               | Agree representative flat/nested/custom/live-policy/history budgets, then refresh revision/machine/browser/sample/warm-cold measurements. No fresh timings, paint, memory or matched competitor benchmark was run here.                                                                                                                                           |
| Q3 — accessibility/device, last | Native controls, keyboard/recovery, reduced-motion, themes/Minimal mode and bounded Chromium evidence exist per slice.                                                                                                                   | Comprehensive keyboard/manual AT, zoom/contrast, touch and declared browser/physical-device matrix after functional work, as requested. Local automation and emulated touch are not comprehensive acceptance. Keep accessible interaction mandatory in every new feature.                                                                                         |
| Q4 — scope/evidence closure     | Approved E/P and D1a/D1b/D2 implementation paths now have bounded receipts; this report identifies partial and absent compatibility features.                                                                                            | Explicit C1–C4 dispositions and linked acceptance of all retained boundaries, plus Q1–Q3. Full React Flow parity, performance superiority and a validated USP remain unestablished.                                                                                                                                                                               |

## Recommended next core feature

**Pursue opt-in loose connection semantics, conditional on approval; start with the
headless contract and wire-compatibility decision.** This addresses the explicit
C1 gap and the user's stated engineer/designer freedom: ordered graph connections
can use an explicitly permitted port pair without forcing extra input/output-only
visual plumbing. Strict output→input stays the default. This is a product inference
from the current invariant and user direction, not evidence that customers have
failed a measured task. Shared-handle authoring demand and usability baselines are unknown.

Compare the alternatives: a new batch engine would duplicate P2; drawable groups
require a wider geometry/endpoint contract; another layout adapter has no demonstrated
missing workflow here; Mermaid import still has an unqualified parser/grammar
boundary. Continuing receipt variants would not resolve an outstanding editor-floor
criterion. The current workaround is strict ports/extra port choices or a separate
host representation; arbitrary `data` or view hacks cannot change persisted validity.

Proposed appetite: one engineer-day for a **contract/compatibility slice**, including
literal fixtures and tests, not the full interaction rollout. Proposed scope:

1. Specify an explicit persisted connection-mode/capability contract and wire-version
   or migration decision. Do not pick EditorOptions-only looseness while the same
   graph fails core decoding, patches or clipboard. Current names here are conceptual,
   not newly exported APIs.
2. Define accepted/rejected source/target port-kind combinations under strict and
   opt-in modes, keeping ordered edge identity and DDD/causal meaning independent
   of visual port kinds. Loose does not imply a symmetric relationship or no policies.
3. Share the headless decision across graph validation, creation/reconnection and
   live per-port/whole-edge policy checks. Inventory port edits, clipboard/patterns,
   patches, conversions/receipts, layout, history and exports before broad rollout.
4. Prove literal legacy strict documents retain their existing behaviour. Unsupported
   future modes reject explicitly; old readers must not silently reinterpret a loose
   graph as valid strict data. Downgrade or conversion loss must be explicit.
5. Add deterministic endpoint-matrix, stale/read-only/busy/policy rejection and
   no-partial-edit/one-Undo tests at the applicable public boundary, plus packed
   Node/Bun and strict TypeScript consumers for the accepted contract.

Stop/reshape if the scope requires ported groups, undirected edge semantics or a
silent breaking change to v1. Bring the wire decision back explicitly rather than
hiding it in renderer callbacks. UI/custom controls, keyboard/pointer/touch evidence
and broader portable integration follow the headless decision; no implementation
is authorized by this assessment. Later product acceptance should test shared-port
architecture authoring while strict graphs and protection reasons remain intact;
no unassisted task result is claimed today.

## Verification and limits

Only this assessment, the roadmap and a supersession pointer in the November 13
assessment change. No runtime tests are added for a documentation-only reconciliation.
Current verification on 2026-11-14: `bun typecheck`, `bun run check` and
`bun run test` all completed with exit 0. Local inspection checked **232 relative
link targets** across the three changed documents and **19 named package exports**;
CLI/private-adapter manifest boundaries were checked separately. Existing configured
warnings/skips remain; the checks do not refresh historical visual, performance or
manual acceptance evidence. Logs are `/private/tmp/zloz-roadmap-20261114-types.log`,
`/private/tmp/zloz-roadmap-20261114-final-check.log` and
`/private/tmp/zloz-roadmap-20261114-tests.log`. Architecture/boundary/product and
evidence review are self-review. Official references above support only their
stated comparisons. No new browser, hydration, manual AT/device, benchmark,
current CI/PR/registry or deployed evidence was produced by this slice.

Recommendation: **needs review** for the proposed feature and scope dispositions.
