# ZLOZ public contract

## Headless architecture nodes

`ZlozNodeArchitecture` separates C4 and DDD roles from `ZlozNodeAppearance`.
Use `architectureNodePresets` and `createArchitectureNode` to create detached,
validated standalone nodes, preserving caller IDs, ports and host `data`.
`NodeArchitectureChanged` and `NodeAppearanceChanged` commit one Undo step,
respect read-only/gesture gates and the independent `canChangeNodeArchitecture`
and `canChangeNodeAppearance` host policies. Pass null to remove a descriptor.
Semantic changes preserve the authored appearance. No-ops preserve revision.

`nodeShapeGeometry` supplies a local SVG outline and safe content bounds;
`nodeShapeBoundaryPoint` and `nodeShapeContainsPoint` use world coordinates.
Rectangle, rounded-rectangle and cylinder defaults drive canonical port geometry
when explicitly selected. `portAnchor(port, node)` is node-aware;
`portAnchor(port)` retains its legacy envelope meaning. Explicit anchors always
win. `PortAnchorReset` restores the same side at offset 0.5, using existing port
edit policies and Undo. Shape snapping still authors normalized envelope points.

Group roles/appearances retain the portless rectangular-boundary invariant.
Version 1 documents accept these optional validated descriptors. The qualified
pre-change reader retains them through its existing edits but uses generic
rendering and geometry. See ADR 0005 for compatibility and geometry decisions.

The `/effect-ui` entry renders C4 through `graphSurface` with
`architectureNotation: true`. Customize artwork through `notationParts` and live
chrome through the node and group shell options. Core `decorationPaths` supplies
cylinder caps alongside the canonical outline. See ADR 0006 and the package
README for the renderer contract.

## Read models and declared consumption

DDD `read-model` nodes and tactical `feeds` edges model an explicit source-to-read-model
dependency. {@link Core.resolveDeclaredConsumption | resolveDeclaredConsumption} accepts the strict two-ID
{@link Core.ZlozDeclaredConsumption | ZlozDeclaredConsumption}, with syntax guarded by {@link Core.isDeclaredConsumption | isDeclaredConsumption}.
It returns a frozen logical relationship/source role or rejection; it never invents
ports, event filters, runtime delivery or permission to edit. Existing DDD controls,
policies, renderer and v1 snapshots compose the same descriptors.
See ADR 0065 and the package README for compatibility and authoring boundaries.

## Port anchor contracts

Keyboard point selection uses `PortAnchorTargetStepped` and the pure
`resolvePortAnchorTargetStep` helper. `PortAnchorTargetStep` supports
next/previous with wraparound and first/last; `PortAnchorTargetStepResult`
reports an empty set or a `PortAnchorPointTarget` with index/count. Current
per-port rules and priority apply to each atomic action. The optional
`portAnchorKeyboardTargets` view mapping supplies Page Down/Up and Home/End,
native help, shortcut metadata and named status feedback. Exact nudging,
protection, text editing and Undo retain their contracts.

`PortAnchorSnapPriority` selects `corners-first` (the default) or
`midpoints-first`. Configure `EditorOptions.portAnchorSnapPriority`, the
idle-only `PortAnchorSnapPriorityChanged` fact, or a per-port `priority`
override. Captured settings preserve that order through previews/bypass;
edges remain the final fallback. Pure resolver/helper validation, permitted
target filtering, within-kind hysteresis, guides and Undo retain their contracts.

Opt-in `portAnchors.guides` presents permitted targets during
anchor dragging. `renderPortAnchorGuide` receives resolved world endpoints,
active feedback and detached captured settings. `portAnchors.renderGuide`
supplies native geometry for custom paint. The package owns an inert
decorative overlay, respecting alignment diagnostics, minimal mode,
bypass and current edit protection. `portAnchorSnapGuideTargets` exposes
normalized `PortAnchorSnapGuide` geometry to headless consumers.

`PortAnchorSnapTargets` supplies `allowedEdges`, `allowedCorners` and
`allowedMidpoints` on per-port overrides, captured settings and pure snap
options. Absent lists allow all; empty lists disable one target kind.
The resolver filters before acquisition and retention. Settings validation
normalizes names and detaches arrays, including active renderer feedback.
Lists affect attraction while free placement, bypass and exact edits remain
available. No graph fields or input-resource state are added.

Per-port rules use `EditorPolicy.portAnchorSnap`, returning partial
`PortAnchorSnapOverrides`. Missing fields inherit editor preferences; zero
disables an individual rule. `resolvePortAnchorSnapSettings` merges and
validates the four effective CSS-pixel values. A drag captures the detached
`PortAnchorSnapSettings` once; active handle contexts expose `snapSettings`
without repeating the callback. Current edit protection, bypass and Undo
remain authoritative. No graph format changes are introduced.

Edge-midpoint attraction is opt-in through
`EditorOptions.portAnchorMidpointSnapDistance` and the idle-only
`PortAnchorMidpointSnapDistanceChanged` fact. `resolvePortAnchorSnap` accepts
`midpointDistance`/`previousMidpoint` and returns an optional `midpoint`
(`PortSide`). Custom handles receive `snappedMidpoint`, sharing the native
binding, description, hysteresis, bypass and Undo transaction. Priority is
corners, then midpoints, then edges by default; all radii are independent.

Port anchor corner attraction is opt-in through
`EditorOptions.portAnchorCornerSnapDistance` and the idle-only
`PortAnchorCornerSnapDistanceChanged` fact. `resolvePortAnchorSnap` accepts
`cornerDistance`/`previousCorner` and returns an optional `PortCorner`.
Custom handle renderers receive `snappedCorner`; `portAnchors.renderHandle`
keeps native binding and corner descriptions. Corner attraction shares
the gesture's hysteresis, modifier bypass, protection and one-step Undo.

Generated from the package's public TypeScript entry points. Search for any type
or function, or select a module to inspect signatures, fields and source links.
This reference describes the current source revision. The four public Zloz packages
are published on npm as a linked version family; the CLI and Alchemy workspaces
remain private. Headless ELK jobs use Node 22+; see the
[ELK runtime qualification](https://github.com/opsydyn/fold-kit-experiments/blob/main/packages/foldkit-zloz-elk/README.md#worker-ownership)
for the observed standalone Bun lifecycle limitation.

| Module                   | Import                                    | Contract                                                                    |
| ------------------------ | ----------------------------------------- | --------------------------------------------------------------------------- |
| {@link Core}             | `@opsydyn/foldkit-zloz`                   | Graphs, Model-owned editing, geometry, serialization and layout publication |
| Effect UI                | `@opsydyn/foldkit-zloz/effect-ui`         | Graph surface, composition, and interaction controls                        |
| {@link ELK}              | `@opsydyn/foldkit-zloz-elk`               | Optional compound/port-aware automatic layout                               |
| {@link Force}            | `@opsydyn/foldkit-zloz-force`             | Optional deterministic force layout                                         |
| {@link ForceEligibility} | `@opsydyn/foldkit-zloz-force/eligibility` | Lightweight support checks                                                  |

## State and editing

`ZlozGraph`, `ZlozNode`, `ZlozEdge` and `Port` describe JSON-compatible documents.
The host owns `EditorState`; `createEditor` initializes it and `updateEditor`
applies typed `EditorEvent` facts. Gestures, selection, viewport and bounded history
stay in that Model. Commands and persistence belong to the consuming application.

`parseGraph`/`serializeGraph` handle versioned documents. `ZlozError` reports invalid
graphs, edits and layouts. Browser measurements report content height without
replacing authored widths. Layout publication uses `LayoutRequest`, `LayoutResult`
and revision checks through `layoutRequest`/`applyLayout`.

## Presentation composition

`graphSurface` takes an Effect UI builder, current editor, and
`GraphSurfaceOptions`. A host maps `BrowserInput` to messages and resolves those
facts with `updateEditor` and the current policy. Node/group shell and
port options customize presentation while the canvas owns its input bindings
and placement. Authored geometry supplies outlines, sockets and routes.
`renderEdge` and `renderConnection` change decorative paths.
Use `viewportControl`, `historyMinimap`, `endpointField`, and the
`resolveZlozDiagnostics` result to compose a native host layout. See the
[package migration guide](https://github.com/opsydyn/fold-kit-experiments/tree/main/packages/foldkit-zloz#effect-ui-canvas-and-migration)
for option mappings.

## Endpoint chooser contracts

`Core.resolveEdgeReconnection` derives `ZlozEdgeReconnectionContext` for an edge
and source/target end. `ZlozEdgeEndpointChoice` supplies stable endpoint values,
labels, current/hidden flags, eligibility reasons and typed reconnection events.
`ZlozEdgeReconnectionOptions.scope` chooses visible alternatives (default) or all
authored ports; the current endpoint is retained. No graph or draft state is added.

Use `endpointField` for a native select, search, and protection reasons.
Pass `edgeEditing.reconnection` with the selected-edge toolbar to expose native
endpoint choices on the canvas. Recompute with the current Model and policies
before applying a reconnection.

## Connection creation contracts

`Core.resolveConnectionCreation` derives `ZlozConnectionCreationContext` from the
current editor and policy. Source/target fields expose stable candidate values,
typed `PortActivated` events and protection reasons. Source selection stages the
existing `EditorState.connection`; target selection uses the existing creation
path and fresh ID allocation. Policy callbacks must be pure and supplied to the
reducer as well as the resolver. `ZlozConnectionCreationOptions.scope` defaults
to visible alternatives, retains a hidden pending source and supports explicit
all-authored-port scope.

Use `endpointField` with the source and target contexts. The host owns the
selection and maps the control's events to the editor. Escape and cancellation
clear the pending source without adding history.

## Searchable endpoint contracts

`Core.resolveEndpointChoices` projects creation or reconnection entries through
`ZlozEndpointSearchOptions.query`. `ZlozEndpointChoices` contains filtered entries,
node groups, the original query, actual match count and no-results feedback.
`ZlozSearchableEndpoint` is the minimal structural input: endpoint, label,
current flag and optional node label. Matching is literal, case-insensitive and
token-based across labels/IDs. Current entries are retained; permissions/events
are preserved and still validated by the reducer.

Configure a host-owned query with `endpointField`'s `search` option.
Node grouping and labels can be customized through `groupByNode` and
`groupLabel`. Native feedback retains current selection and policy reasons.

## Package boundaries

The core has no runtime dependencies or browser requirement. Effect UI and Effect are
optional view peers; ELK and force layout are separately installed adapters.
Policies and view configuration are functions outside serialized documents.
Outside-box anchors and arbitrary routing normals are not part of the
current contract.

Custom shells may compose `createZlozNodeBodyCache()` directly around decorative
artwork/labels with explicit immutable arguments. The workbench Orbit example
keeps drag/resize/collapse controls, frames and native/custom sockets outside the
slot. Automatic retention still excludes whole custom-shell contexts. Reuse the
same body constructor across cached/live modes to preserve element identity.

PNG export has a browser-free plan/review lifecycle in core, composable native
controls under `/effect-ui`, and optional real encoding/download IO under `/browser`.
Review fidelity findings and rasterization loss before rendering. Preview and
download use identical PNG bytes; stale source/settings and live protection block
publication. See the package README and ADR 0063 for resource limits and ownership.

## Read-only DDD relationship audit

{@link Core.auditDddRelationships | auditDddRelationships} produces a detached
{@link Core.ZlozDddRelationshipAudit | ZlozDddRelationshipAudit} using the existing
{@link Core.ZlozDddRelationshipOptions | DDD convention options}. Every authored
edge is represented in UTF-16 ID order as typed-compatible, blocked or unrelated.
No DDD meaning is inferred from untyped or other-family edges. Compatible means
zero blocked DDD edges under the catalogue, not full typing or universal correctness.
Graph structure and convention errors reject separately from semantic findings.
Source/Undo and wire formats are unchanged. The optional Effect CLI now exposes
`zloz ddd audit` with structured reports, DDD rule files and explicit 0/1/2 exits.
{@link Core.compareModelDddRelationships | compareModelDddRelationships} compares
owned baseline/target editions or the current graph under one catalogue. Findings
match edge ID and code; no-new-findings does not imply compatibility.
{@link Core.resolveDddAuditControls | resolveDddAuditControls} and
{@link Core.resolveDddAuditRequest | resolveDddAuditRequest} expose standalone and
comparison review, live protection and fresh node/edge navigation. The optional
`dddAuditControls` from `/effect-ui` composes native or custom
views with omit/replace hooks and count visibility. Workbench and Effect CLI
`ddd compare` demonstrate the same package contracts. Source/Undo are preserved;
causal commands and packets keep their EventStorming scope.

## EventStorming workshop semantics

{@link Core.EventStormingNodeArchitecture | EventStormingNodeArchitecture} now
separates causal external-system participants, portless hotspots with required
authored open/resolved status, and portless organizational lane groups.
{@link Core.resolveEventStormingNodeSemantics | resolveEventStormingNodeSemantics}
returns participant/annotation/frame meaning without inferring DDD/C4 ownership.
Existing membership, world geometry, strict codecs, history and Undo apply.

{@link Core.eventStormingWorkshopRelationshipRules | eventStormingWorkshopRelationshipRules}
is the opt-in causal catalogue for external systems. The original catalogue remains
unchanged for portable builtin-packet compatibility; hotspots/lanes are not causal
roles. DDD preview leaves these roles unmapped until explicit retention/mapping and
loss acceptance. Effect UI renders these roles through `graphSurface` with architecture notation enabled. Portable SVG still
requires a host adapter or explicit fidelity fallback. See the README and
ADR 0081 for exact role/kind/port, status, conversion and compatibility boundaries.

## Workshop editing and presentation

{@link Core.createEventStormingWorkshopPattern | createEventStormingWorkshopPattern}
provides an illustrative native starter. Use
{@link Core.resolveEventStormingWorkshopControls | resolveEventStormingWorkshopControls}
and {@link Core.resolveEventStormingWorkshopRequest | resolveEventStormingWorkshopRequest}
for fresh selected-node role/status edits with live protection and ordinary Undo.
{@link EffectUI.workshopControls | workshopControls}
composes explicit native status buttons, role selectors and visible reasons, with
replace/omit hooks. {@link EffectUI.workshopStatusButton | workshopStatusButton}
and {@link EffectUI.workshopSelect | workshopSelect} support custom layouts.
Native node/lane content, semantic descriptions, header geometry, body caching and
scoped light/dark tokens remain independent of diagnostics. See the README and
ADR 0082 for exact freshness, selection, policy and portable-export limits.

## V3 group-port authoring and canonical models

Use {@link Core.createGroupEditorV3} and the source-bound
{@link Core.planGroupConnectionV3} / {@link Core.planGroupOperationV3} planners
for group endpoints and complete atomic Undo. The distinct
{@link Core.createGroupWorkbenchV3} / {@link Core.updateGroupWorkbenchV3}
controller composes with {@link EffectUI.groupSurfaceV3} and
{@link EffectUI.groupInspectorV3}. Custom content/controls, live policies,
light/dark tokens and diagnostics remain composable.

{@link Core.captureModelDocumentV3} and its strict codecs preserve independent
checkpoint modes/capabilities/cameras. V3 history supports detached read-only
review, comparison, restore, additive merge and provenance-preserving forks.
{@link Core.assessPortableCompatibilityV3} independently reports adapter limits;
ported checkpoints refuse whole-model downgrade. No bare-graph cast makes a
legacy entry v3-compatible. See README and batch evidence for native interaction,
portable adapter, advanced-tool and human acceptance limits.

## Native v3 compound layout

{@link Core.groupLayoutRequestV3} captures the complete source document. Compose
it with optional {@link ELK.createElkGroupLayoutV3} in a Command, then
{@link Core.applyGroupLayoutV3} using the current editor, active request and live
policy. Authored group ports/endpoints, modes, capabilities and camera survive;
complete validated geometry is one Undo transaction. Stale/partial output and
current protection vetoes publish nothing.

{@link Core.applyGroupWorkbenchLayoutV3} integrates accepted transient routes into
the native controller. {@link Core.groupWorkbenchRoutesV3} exposes only routes
matching the current document and uncollapsed idle projection. Existing legacy
layout APIs remain version-fixed. See the ELK README and native qualification for
fixed-position compound port behavior, connector leads and worker/runtime limits.

## Native v3 SVG export

{@link Core.planGroupSvgExportV3} and {@link Core.writeGroupSvgExportV3} validate
the full document, retain source mode/capability and project nested groups and
authored sockets. {@link Core.captureGroupSvgLayoutV3} binds retained routes to
that complete source and a renderer key. Native custom adapters receive the full
immutable source; safe primitives, fonts, output budgets and explicit fidelity
findings share the qualified SVG writer.

Compose {@link Core.resolveGroupSvgReviewV3} and
{@link Core.updateGroupSvgReviewV3} with shared review state and
{@link EffectUI.svgReview}. Exact-artifact loss consent and current policy are
checked before returning a detached download payload for a Command. Export never
edits history. SVG is static artwork, not an editable model codec; other adapters
remain separately scoped. See README and native SVG evidence.

## Native v3 PNG export

{@link Core.planGroupPngExportV3} uses the same validated full-document SVG and
findings, adding explicit rasterization loss and bounded integer output.
{@link Core.resolveGroupPngReviewV3} / {@link Core.updateGroupPngReviewV3} compose
with shared PNG review state and {@link EffectUI.pngReview}; consent, full-source
freshness and live protection guard render, completion and download.

`renderGroupPngExportV3` is the optional browser encoder. It rebuilds
the native SVG and checks reviewed bytes before allocation. It supports abort,
deadline and resource cleanup; preview/download use identical PNG bytes.
SSR import is safe and calls report unsupported without browser APIs. Pixels
retain no editable semantics; server PNG, broad performance and human acceptance
remain unqualified. See README and native PNG evidence for limits.

Native v3 session clipboard uses {@link Core.copyGroupSelectionV3},
{@link Core.groupPasteRequestV3}, {@link Core.planGroupPasteV3} and
{@link Core.applyGroupPasteV3}. Full-source and live policy checks protect explicit
node/edge/scoped-port remapping and one full-document Undo. Mode/capability
mismatches block rather than silently convert. External-parent detachment and
crossing-edge omissions produce findings. Opaque metadata references are not
rewritten. {@link EffectUI.groupClipboardV3} supplies optional composable
controls with visible reasons, including minimal mode. Session clipboard has no OS
clipboard IO and is not persisted in models or history.

Native v3 Mermaid is available through {@link Mermaid.exportGroupMermaidV3} and
{@link Mermaid.resolveGroupMermaidReviewV3} /
{@link Mermaid.updateGroupMermaidReviewV3}. Group port artwork and exact attachment
are explicit projection losses; native identity/mode/capability remain in the
separate v3 bundle. Full-source/output consent and current policy guard downloads.
{@link MermaidEffectUI.groupMermaidReviewV3} composes highlighted source, findings,
consent and download with nullable slots and required reasons in minimal mode.
`zlozThemeStyle` shares scoped token mapping with optional adapters.
No production Mermaid import, runtime renderer or native packet writer is implied.
