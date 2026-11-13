# Zloz core completion audit

Audit date: 2026-11-12. Inspected source: `03e972b`, isolated branch
`codex/zloz-context-map`. This is a source and evidence reconciliation, not a
feature implementation or release qualification. It supersedes the priorities in
[the November 8 assessment](2026-11-08-zloz-core-parity-and-domain-roadmap.md),
whose inventory remains historical.

**Core is not complete, and full React Flow parity is not established.** The
EventStorming-to-DDD conversion lifecycle is implemented locally; repeating that
work would miss the remaining editor and portability gaps. The recommended next
slice at the audit baseline was a headless authored edge-waypoint contract,
before its editing UI. The E1 delivery update below records subsequent progress.

## Scope and evidence rules

The comparison reference is React Flow's public [API](https://reactflow.dev/api-reference)
and [example catalogue](https://reactflow.dev/examples), inspected on this date.
This is a bounded behavioural inventory, not exhaustive prop-by-prop equivalence.
React-specific hooks are compared by user capability, not export spelling. The
catalogue includes free and Pro examples: an example is not automatically a
built-in core API. In particular, external
[drag/drop](https://reactflow.dev/examples/interaction/drag-and-drop) is host
integration, [image download](https://reactflow.dev/examples/misc/download-image)
uses `html-to-image`, and
[editable edges](https://reactflow.dev/examples/edges/editable-edge) are a Pro
example. These are still relevant user workflows for Zloz.

Evidence has separate meanings:

- **Source present:** a public export and implementation exist at the inspected revision.
- **Recorded qualification:** linked tests/receipts cover their stated revision and scope.
- **Current verification:** this documentation slice's root checks, recorded below.
- **Released/deployed:** requires independent artifact/host evidence; not checked here.

Core, ELK, force and Mermaid manifests identify 0.3.0; that does not prove these branch additions
are in a registry artifact. Historical PR, CI and registry observations in earlier
roadmap revisions are not current release status. No npm publishing or deployment
is authorized. CLI publication remains deferred, but its 0.1.0 manifest lacks
`private: true` (R1). Do not describe that guard as present.

## Public contracts and ownership

The [core entry point](../../packages/foldkit-zloz/src/index.ts) owns reusable
semantics, geometry, immutable state transitions, codecs and comparison. The
optional [Foldkit entry point](../../packages/foldkit-zloz/src/foldkit.ts) owns
composable rendering and interaction helpers. Layout, Mermaid and CLI adapters
remain optional. Astro owns application composition, file IO, downloads and
transient workflow state; it must not be the only implementation of reusable
modelling rules.

“Implemented” below means package source exists with bounded evidence, not
exhaustive interaction, accessibility, deployment or competitive qualification.

| Capability                           | Public contract / owner                                                                                                                                      | Evidence and remaining limit                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Graph editing and navigation         | Core `createEditor`, `updateEditor`, `screenToWorld`, `fitViewport`, `fitNodes`; public `EditorEvent`                                                        | [Reducer tests](../../packages/foldkit-zloz/test/core.test.ts), [navigation tests](../../packages/foldkit-zloz/test/navigation.test.ts). Selection, drag/resize, clipboard, snapping, pan/zoom and Undo/Redo exist. Full device/AT coverage remains Q3.                                                                                                                    |
| Connection creation and reconnection | Core `resolveConnectionCreation`, `resolveEdgeReconnection`, `resolveEndpointChoices`; live policy and port controls                                         | [Creation tests](../../packages/foldkit-zloz/test/connection-creation.test.ts), [validation tests](../../packages/foldkit-zloz/test/connection-validation.test.ts), [protected workbench](../../apps/zloz-demo/evidence/protected-orbit.md). Output-to-input only; loose mode is C1.                                                                                       |
| Groups and sub-flows                 | Core `ZlozNode.parentId`, `extent`, `expandParent`, group events and reducer                                                                                 | [Core tests](../../packages/foldkit-zloz/test/core.test.ts), [layout tests](../../packages/foldkit-zloz/test/layout.test.ts). Nested containment, growth and collapse exist; world coordinates and portless groups differ from React Flow (C2).                                                                                                                            |
| Edge presentation                    | Core `edgePath`, `resolveEdgeGeometry`, `resolveConnectionPreview`; Foldkit shells, labels and custom geometry                                               | [Geometry receipt](../../apps/zloz-demo/evidence/edge-geometry.md), [preview receipt](../../apps/zloz-demo/evidence/connection-preview.md). Composable visuals are implemented; persistent authored waypoints are E1.                                                                                                                                                      |
| Design freedom and diagnostics       | Foldkit `zlozView`, composable node/group/edge controls, `zlozLightTheme`, `zlozDarkTheme`, `resolveZlozDiagnostics`                                         | [Composition](../../apps/zloz-demo/evidence/composition.md), [theme tests](../../packages/foldkit-zloz/test/theme.test.ts), [diagnostics tests](../../packages/foldkit-zloz/test/diagnostics.test.ts). Native/custom controls must retain live protections and independent minimal-mode preferences.                                                                       |
| Canvas chrome and backgrounds        | Core `minimapGeometry`; Foldkit `zlozView` overview preference, `ZlozBackground` dots/squares/custom rendering                                               | [Mini map receipt](../../apps/zloz-demo/evidence/minimap-toggle.md), [background tests](../../packages/foldkit-zloz/test/background.test.ts). Decorative grids, snapping and diagnostics visibility are independent controls; overview geometry is reusable.                                                                                                               |
| Layout engines                       | Core `layoutRequest`, `applyLayout`; adapters `createElkLayout`, `createForceLayout`, `supportsForceLayout`                                                  | [Core layout tests](../../packages/foldkit-zloz/test/layout.test.ts), [ELK source](../../packages/foldkit-zloz-elk/src/index.ts), [force eligibility](../../packages/foldkit-zloz-force/src/eligibility.ts). ELK supports compound graphs; force is bounded to flat graphs of 1–100 nodes. No shipped Dagre adapter.                                                       |
| Large graph rendering                | Foldkit culling and retained node/body composition with live ports/controls                                                                                  | [Body-cache receipt](../../apps/zloz-demo/evidence/orbit-body-cache.md), [camera benchmark](../../apps/zloz-demo/evidence/camera-benchmark.md). Historical internal measurements are not current performance budgets or React Flow comparisons (Q2).                                                                                                                       |
| Architecture notation and patterns   | Core `createArchitectureNode`, shape geometry, `insertPattern`, DDD/context-map resolvers; Foldkit C4/DDD/EventStorming renderers                            | [Architecture types](../../packages/foldkit-zloz/src/architecture.ts), [DDD renderers](../../apps/zloz-demo/evidence/ddd-renderers.md), [pattern receipt](../../apps/zloz-demo/evidence/pattern-insertion.md), [context map](../../apps/zloz-demo/evidence/context-map.md). Four C4, eight DDD and four EventStorming roles; broader workshop/C4 mapping scope remains D1. |
| DDD relationship editing             | Core `resolveDddRelationship`, `dddRelationshipPolicy`, `resolveDddRelationshipControls`, `resolveDddRelationshipRequest`; optional native controls          | [Contract receipt](../../packages/foldkit-zloz/evidence/ddd-relationships.md), [controls receipt](../../apps/zloz-demo/evidence/ddd-relationship-controls.md). Tactical/strategic meaning, side roles, visible reasons and Undo exist; causal audit is not a universal DDD audit.                                                                                          |
| Editions, ghosts and playback        | Core `createHistoryReview`, `updateHistoryReview`, `compareEditions`, `resolveHistoryChangeFocus`, `resolveHistoryChangeStep`; playback/scrubber helpers     | [History](../../apps/zloz-demo/evidence/history.md), [playback](../../apps/zloz-demo/evidence/edition-playback.md), [side continuity](../../apps/zloz-demo/evidence/receipt-side.md). Local read-only comparison, stepping, reduced-motion handling and ghosts exist.                                                                                                      |
| Restore, forks and full models       | Core model codecs, fork and restore transactions                                                                                                             | [Model codec tests](../../packages/foldkit-zloz/test/model-document.test.ts), [restore](../../apps/zloz-demo/evidence/edition-restore.md), [forks](../../apps/zloz-demo/evidence/model-forks.md). Durable model identity/editions/origin differ from graph-only snapshots and review packets.                                                                              |
| EventStorming-to-DDD lifecycle       | Core `previewEventStormingDddMapping`, `createEventStormingDddConversionPlan`, `resolveEventStormingDddConversionConsent`, `applyEventStormingDddConversion` | [Preview](../../packages/foldkit-zloz/evidence/event-storming-ddd-preview.md), [plan](../../packages/foldkit-zloz/evidence/event-storming-ddd-conversion-plan.md), [atomic Apply](../../packages/foldkit-zloz/evidence/event-storming-ddd-apply.md). Identity, ambiguity, exact-plan loss consent, provenance, live policy checks and one Undo are implemented.            |
| Conversion receipt reopening         | Core `serializeEventStormingDddConversion`, `parseEventStormingDddConversion` and public history primitives; app receipt workflow                            | [Read-only receipt review](../../apps/zloz-demo/evidence/receipt-review.md), [focus](../../apps/zloz-demo/evidence/receipt-focus.md), [step](../../apps/zloz-demo/evidence/receipt-step.md). Strict full before/after receipt decoding exists. File picker, retained registry and review UI are app-owned composition, not a turnkey package receipt controller.           |
| Audit and review packet creation     | Optional Mermaid `createReviewPacket`; Effect CLI `relationships audit`, `relationships compare`, `review packet`                                            | [Audit comparison](../../packages/foldkit-zloz-cli/evidence/relationship-comparison.md), [packet receipt](../../packages/foldkit-zloz-cli/evidence/review-packet.md), [public exports](../../packages/foldkit-zloz-mermaid/src/index.ts). Creation is implemented; strict packet reopening is P1. Audits currently interpret EventStorming causal conventions.             |
| Mermaid projection                   | Optional `exportMermaid`; CLI `mermaid export`                                                                                                               | [Nested subgraphs](../../apps/zloz-demo/evidence/mermaid-subgraphs.md), [export source](../../packages/foldkit-zloz-mermaid/src/export-mermaid.ts). Nested C4 container projection and loss/identity reporting exist. No production Mermaid import/parser API is exported.                                                                                                 |

## Remaining feature contracts

These are completion obligations to plan and qualify, not approval to implement
all features in one slice. A row is closed only by public API, tests and a linked
receipt, or by an explicit approved scope decision. A renderer callback or an
app-only demonstration does not close a missing reusable contract.

### E1 — authored edge waypoints (first)

Original audit gap: `EditorState.routes` stores layout results; at `03e972b`,
`ZlozEdge` had no authored waypoint field. A route returned by ELK is not a portable
user edit.

**Delivery update:** the approved headless waypoint contract is implemented on this
branch; see [ADR 0049](../adr/0049-author-portable-edge-waypoints.md) and
[package qualification](../../packages/foldkit-zloz/evidence/edge-waypoints.md).
The subsequent approved interaction slice adds composable pointer/keyboard
controls and local light/dark/minimal evidence; see
[ADR 0050](../adr/0050-compose-waypoint-interaction-controls.md) and
[workbench qualification](../../apps/zloz-demo/evidence/waypoint-controls.md).
Comprehensive qualification gates remain open. These updates do not retroactively
change the original audit baseline.

Completion requires:

- A headless authored-geometry model and editing events, with finite-coordinate
  validation, deterministic identity and a documented serialization/version choice.
- Explicit precedence and lifecycle for authored points versus layout routes,
  endpoint moves, reconnects, node/group moves, clipboard and deletion.
- One geometry contract shared by rendering, hit targets, labels, previews and
  relevant overview geometry; no private Astro geometry implementation.
- Atomic commit, cancel, read-only/busy/policy rejection and one Undo per edit;
  rejected and stale requests leave state intact.
- Composable pointer and keyboard handles, protection reasons and feedback that
  respect themes, diagnostics and bypass where applicable. Stage these after the
  headless contract rather than coupling model design to a particular handle UI.
- Literal portable fixtures, regression tests and packed Node/Bun consumer proof;
  workbench light/dark/minimal evidence for the eventual interactive slice.

### E2 — palette and external insertion

`NodeAdded`, `screenToWorld` and atomic pattern insertion provide primitives;
they do not supply a complete reusable external-drop workflow. Complete with a
package placement resolver covering coordinate transforms, grid/anchor snapping,
ID allocation, live policies, stale/busy rejection, preview/cancel and one Undo.
Provide pointer/touch placement and an equivalent keyboard placement flow. Astro
may own the palette content and native file/drag adapters. Tests must exercise
nested/scrolled/zoomed placement and rejected insertion without mutation; record
light/dark/custom palette evidence.

**Delivery update:** the approved headless contract now supplies scoped sessions,
normalized palette/external graph sources, explicit coordinate/parent targets,
grid/node-frame snapping, detached preview and guarded atomic Apply. See
[ADR 0051](../adr/0051-plan-and-apply-headless-placement.md) and
[package qualification](../../packages/foldkit-zloz/evidence/placement.md).
The approved interaction follow-up adds native/custom package controls, a scoped
DOM input resource and workbench mouse/keyboard/Chromium touch evidence. See
[interaction qualification](../../apps/zloz-demo/evidence/palette.md). Physical-device
and manual AT acceptance remain unobserved; Chromium emulation is not device parity.
OS file/MIME parsing remains host-owned; no arbitrary HTML import is claimed.

### E3 — image export

Define an optional reusable SVG/PNG export boundary, with explicit bounds,
viewport versus whole-model scope, theme/background, fonts and custom HTML/SVG
content handling. Unsupported content, external assets and fidelity losses must
be reported rather than silently omitted. Export must preserve the model/Undo.
Qualify emitted files with real browser captures and representative groups, ports,
labels and custom nodes. A developer screenshot script is not the public API.

**Delivery update:** the approved contract slice adds pure package SVG planning,
explicit region/theme/background/font/asset inputs and custom-renderer fidelity
findings. See [ADR 0052](../adr/0052-plan-portable-svg-export.md) and
[local contract qualification](../../packages/foldkit-zloz/evidence/svg-export.md).
The follow-up bounded writer now emits canonical SVG and binds typed vector adapters,
with actual light/dark/custom/crop/transparent file/browser qualification. See
[ADR 0053](../adr/0053-write-svg-through-typed-primitives.md) and
[writer evidence](../../packages/foldkit-zloz/evidence/svg-writer.md). Package-level
review/download controls now expose exact-artifact loss acceptance, live protection,
composable findings/controls and native/custom light/dark/minimal workbench views.
See [ADR 0054](../adr/0054-review-svg-before-host-download.md) and
[download qualification](../../apps/zloz-demo/evidence/svg-review.md).
Selected trusted TrueType font bytes now have structural validation, bounded
embedding and asset-targeted failures; review approval binds the resulting bytes.
See [ADR 0055](../adr/0055-embed-bounded-truetype-font-resources.md) and
[font qualification](../../packages/foldkit-zloz/evidence/svg-font.md).
Headless default glyph coverage now checks formats 4/12 against emitted text,
reports missing mappings as consent-controlled losses, and preserves unknown
mapping/sequence status. Malformed mappings block. See
[ADR 0056](../adr/0056-report-default-glyph-coverage-for-emitted-text.md) and
[coverage evidence](../../packages/foldkit-zloz/evidence/svg-font-coverage.md).
Broader font formats, other resources, shaping/browser/font qualification and PNG remain open.
Planning output alone remains distinct from emitted-file evidence.

### P1 — strict portable review packet reopening

`foldkit-zloz-review` v1 packets contain chosen snapshots, conventions, audit delta
and Mermaid projections. They are not full model archives and are not
`foldkit-zloz-ddd-conversion` receipts. Package-level creation and strict v1 decoding are now public. The decoder bounds
JSON input, validates owned snapshots/identities and recomputes the full audit and
Mermaid wire content, returning detached frozen data or explicit rejection. See
[ADR 0057](../adr/0057-decode-portable-review-packets-strictly.md) and
[qualification](../../packages/foldkit-zloz-mermaid/evidence/review-packet-parse.md).
Effect CLI `review validate` and `review inspect` now reuse the strict decoder with
bounded UTF-8 file/stdin IO, retained findings and explicit validity/error exit codes.
See [ADR 0058](../adr/0058-inspect-review-packets-through-effect-cli.md) and
[command qualification](../../packages/foldkit-zloz-cli/evidence/review-packet-read.md).
Read-only workbench opening remains incomplete.
The delivered decoder provides strict data-only validation and explicit format/version
errors, bounded input, structural and cross-field consistency checks, recomputed
findings/projections and malformed/tampered/literal-fixture tests. Next add a
read-only workbench opening flow that preserves the
last good review on failure. Opening is not consent to edit or import a model.

### P2 — reviewed modelling patches and dry runs

No public patch lifecycle is implemented. Define a bounded operation vocabulary,
stable IDs, expected source revision/provenance and data-only validation. Dry run
must report the exact prospective graph, policy blockers and losses without
mutation. Apply must recheck live authority/source, reject stale or partial plans
atomically, retain provenance and commit as one Undo. Package tests, portable
fixtures, packed consumer and Effect CLI dry-run evidence must precede a guarded
workbench Apply. Automatic writable agents and external system writes remain
outside this contract.

## Open domain and compatibility decisions

These rows remain open; this audit does not silently approve exclusions or expand
runtime scope. Each needs a bounded decision with rationale, public contract
consequences and evidence before core completion can be declared.

| ID  | Unresolved boundary              | Closure criterion                                                                                                                                                                                                                                                                                                                                                       |
| --- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Workshop vocabulary and mappings | Current EventStorming roles are command/domain-event/policy/actor. Decide support for read models, external systems, hotspots and lanes, plus EventStorming-to-C4 mapping. The DDD lifecycle does not close C4 conversion. Include ambiguity, source identity and explicit losses in any accepted extension; record a reasoned approved deferral for anything excluded. |
| D2  | DDD audit coverage               | Typed tactical/strategic validation and side-role editing exist; current causal audit is EventStorming-scoped. Decide which additional DDD findings belong in the supported audit catalogue, with configurable conventions and literal expected findings. Do not label current audit as complete DDD analysis.                                                          |
| C1  | Connection compatibility         | Decide whether strict output-to-input remains the supported contract or add loose connections. Document migration, validation and policy consequences; test accepted/rejected endpoint combinations.                                                                                                                                                                    |
| C2  | Group compatibility              | Decide whether world-coordinate children and portless groups remain intentional differences. Qualify nested movement, layout, containment, copy/paste, collapse and export. Any drawable group endpoints need a separate geometry/storage decision.                                                                                                                     |
| C3  | Layout support envelope          | Publish tested compound-ELK and bounded flat-force capabilities, route ownership and async cancellation/staleness guarantees. Decide whether Dagre/other algorithms are required; an algorithm-specific adapter is not automatically a missing built-in React Flow capability.                                                                                          |
| C4  | Advanced example catalogue       | Explicitly disposition rotation-aware geometry, lasso/freehand/eraser, multi-connection conveniences, production Mermaid import and server-side image creation. Record implement/defer/exclude with rationale and comparison limits. These are unestablished parity, not delivered through general extensibility.                                                       |

Automatic persistence, shared collaboration and executable dataflow/team runtimes
remain separate planning streams. They are not implemented core features and no
infrastructure activation is authorized. Document their exclusion from any bounded
core claim; a claim of full React Flow example parity would need a broader audit.

## Qualification and completion gates

A completed feature row needs a reusable public contract, documented defaults and
extension points, meaningful regression coverage and a receipt naming the source
revision, commands, fixtures and limits. Public input changes need literal wire
fixtures and an explicit compatibility decision. Editing needs live policy,
read-only/busy/stale/cancel handling and atomic Undo/Redo. Visual features need
light/dark/custom/minimal-mode examples with retained protection reasons.

| Gate                                                    | Required evidence before core completion                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1 — package and rendering qualification                | Fresh packed Node/Bun consumer checks across core and optional adapters, TypeDoc/export review and canonical graph/snapshot/model/receipt compatibility fixtures. Existing [package tests](../../packages/foldkit-zloz/test/package.test.ts) and server-rendered view tests provide partial evidence; separately demonstrate SSR plus client hydration/interaction without mismatch. A `renderToString` assertion alone is not hydration qualification.                                                             |
| Q2 — representative performance                         | Refresh benchmark commands after the directory rename and record exact revision, machine/browser, fixtures, sample counts and warm/cold conditions. Cover flat and nested graphs, live ports/policies, custom bodies, creation/reconnect chooser and history ghosts. Agree budgets before evaluating results; distinguish listener-to-DOM from paint and memory. Historical receipts and the force 100-node bound are not universal scale guarantees. A superiority claim requires a matched React Flow comparison. |
| Q3 — comprehensive accessibility and interaction (last) | After functional work, record keyboard-only workflows, focus/recovery, screen-reader names/reasons/live feedback, touch, reduced motion, zoom, contrast and light/dark/minimal mode across the declared browser/device matrix. Include disabled/protected controls, waypoint/palette alternatives, history ghosts/playback and read-only receipt review. Unit assertions and one Chromium screenshot cannot close this gate. Accessible controls remain a requirement in every earlier slice.                       |
| Q4 — parity decision record and evidence closure        | Close E1–E3 and P1–P2, resolve D1–D2/C1–C4 explicitly, and link acceptance receipts. Check each retained behavioural comparison against the dated reference. Keep accepted differences visible. No undocumented exclusions, parity percentage or validated USP claim.                                                                                                                                                                                                                                               |

**Definition of core complete:** all required feature rows and Q1–Q4 pass, with
open scope decisions resolved by explicit approval and no unacknowledged evidence
gaps. This audit defines the closure process; it does not grant those approvals.
Keep release readiness separate: reviewed commits/PR, green CI, package identity,
artifact/provenance and consumer checks precede any separately authorized publish
or deployment. Local checks cannot prove hosted acceptance or registry state.

**Alchemy Domain remains deferred by user decision until core completion.** No
adapter, dependency adoption or qualification is scheduled ahead of these gates;
completion does not itself authorize adopting or deploying an integration.

### R1 — release guard discrepancy

[ADR 0036](../adr/0036-publish-the-zloz-package-family-to-npm.md) requires the CLI
to remain unpublished with `private: true`. The inspected
[CLI manifest](../../packages/foldkit-zloz-cli/package.json) omits that field and
contains public publish configuration and a pack-check script. Restore the guard
in a separately scoped manifest/release-tooling change, verify pack selection and
release allowlists, and test that the CLI cannot enter a publish plan. This audit
records the discrepancy without changing manifests; current registry state was
not checked. R1 must close before any release, independently of core feature gates.

## Work receipt

- **result:** complete
- **claim:** documentation reconciliation is complete; core remains incomplete.
  Package ownership, remaining gaps and explicit closure criteria replace stale
  priorities; no runtime or publication change.
- **evidence:** inspected public exports/model/events and the linked source,
  tests and dated receipts at `03e972b`; current command results are below.
- **remaining uncertainty:** no fresh browser/AT/performance, hosted, registry or
  CI qualification; scope decisions above remain open. Positioning is a hypothesis,
  not a proven advantage over React Flow.
- **next:** define and test E1's headless authored edge-waypoint contract, including
  serialization and layout precedence, before adding composable editing handles.

Recommendation: **needs review** for the open domain and compatibility decisions.

### Current documentation-slice verification

Host command results on 2026-11-12 in the isolated worktree:

- `bun run check`: exit 0; existing lint and skill-version warnings remain.
- `bun typecheck`: exit 0; Astro reported sandbox websocket binding warnings,
  which do not establish server/browser acceptance.
- `bun run test`: initial sandbox run stopped at the packaging fixture because
  Bun could not write its cache (`EPERM`); full rerun with cache access exited 0.
  Existing skipped tests remain skipped; this is not comprehensive manual a11y.
- Local Markdown link targets and named core exports checked; all resolve.
  Unrelated roadmap sections preserved; only two documentation files changed.

No new runtime tests were added for this documentation-only slice. Existing
receipts remain revision-specific; current tests do not refresh their visual,
performance or assistive-technology observations.
