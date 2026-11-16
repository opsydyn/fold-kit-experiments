# Foldkit Zloz public contract

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

The optional `/foldkit` entry now supplies `zlozC4Node` and `zlozC4Group` as
explicit shell choices. `ZlozC4NodeOptions` supports inert semantic-content slots,
frame attributes, live controls and optional public body caching. Other families
retain normal fallback rendering. Core `decorationPaths` supplies the cylinder cap
alongside the canonical outline. Presets use scoped theme tokens and authored
bounds; minimal mode retains semantic meaning. DDD artwork, semantic edge
descriptors and atomic pattern builders remain follow-ups. See ADR 0006 and the
package README for the renderer contract.

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

Opt-in `ZlozViewOptions.portAnchorGuides` presents permitted targets during
anchor dragging. `renderPortAnchorGuide` receives resolved world endpoints,
active feedback and detached captured settings. `zlozPortAnchorGuide`
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
Custom handle renderers receive `snappedCorner`; `zlozPortAnchorHandle`
keeps native binding and corner descriptions. Corner attraction shares
the gesture's hysteresis, modifier bypass, protection and one-step Undo.

Generated from the package's public TypeScript entry points. Search for any type
or function, or select a module to inspect signatures, fields and source links.
This reference describes the current source revision. Version 0.1.0 remains a
local release candidate; npm publication has not been performed.

| Module                   | Import                                    | Contract                                                                      |
| ------------------------ | ----------------------------------------- | ----------------------------------------------------------------------------- |
| {@link Core}             | `@opsydyn/foldkit-zloz`                   | Graphs, Model-owned editing, geometry, serialization and layout publication   |
| {@link FoldKit}          | `@opsydyn/foldkit-zloz/foldkit`           | View configuration, shell composition, interaction primitives and diagnostics |
| {@link ELK}              | `@opsydyn/foldkit-zloz-elk`               | Optional compound/port-aware automatic layout                                 |
| {@link Force}            | `@opsydyn/foldkit-zloz-force`             | Optional deterministic force layout                                           |
| {@link ForceEligibility} | `@opsydyn/foldkit-zloz-force/eligibility` | Lightweight support checks                                                    |

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

`ZlozViewOptions<Message>` uses the host's `HtmlBuilder<Message>` and event wrapper.
`renderNode` customizes card contents; `renderNodeShell`/`renderGroupShell` replace
complete shells. Public frames, drag handles, ports and resize handles retain
interaction/measurement bindings while the host owns visual markup and styling.
The default view uses those same primitives.

`ZlozEdgeGeometryPolicy` resolves a shared path and label anchor for decoration,
selection, labels and toolbar placement. `renderEdge` decorates that resolved
path. Ports support legacy cardinal side/offset positions or normalized custom
anchors. `PortPosition` makes those forms mutually exclusive; `portAnchor`,
`portPosition` and `portBoundaryPosition` share their geometry across presentation
and layout. `PortPositionsChanged` applies an undoable batch.
`ZlozDiagnosticOptions` supports individual diagnostics and global minimal mode.
`ZlozBackground` supports dots, squares, no background and host-rendered designs.

`resolveConnectionPreview` and `ZlozConnectionGeometryPolicy` expose incomplete
connection geometry without synthetic edges. `ZlozConnectionFeedback` carries
free/valid/invalid target state from the core. `renderConnection` replaces the
SVG preview while native port interactions, cancellation and Undo remain shared.

`ZlozViewportControlsContext` provides typed navigation actions for custom control
layouts. `zlozViewportControl` provides native button semantics. `ZlozMinimapContext`
provides visible node and camera geometry; use `zlozMinimap` for input and
`zlozMinimapViewport` for an optional, separately styled camera outline. The
`renderViewportControls` and `renderMinimap` hooks use these same contracts.

`portLabels` enables labels for named ports, with ID fallback.
`ZlozPortLabelContext` supplies the port, node, canonical world position,
resolved placement and gap. Compose `zlozPortLabel` in `renderPortLabel`
for custom content and placement. It keeps labels decorative and anchored
independently of the node shell.

`renderPort` receives `ZlozPortRenderContext` for each socket.
Compose `zlozPort` to retain native input and geometry. Custom shells can
append the resolved `ZlozNodeRenderContext.ports` collection as direct
frame children. Undefined keeps the default and null omits the control.

`PortAdded` and `PortRemoved` edit authored ports through the reducer's
transaction boundary. `resolvePortRemoval` returns a
`PortRemovalDecision` that includes all attached edges or a rejection
reason from the existing deletion policy.

`PortLabelChanged` edits a port's display text while preserving its
endpoint ID, anchor and connections. Pass `undefined` to clear the label.
Hosts manage drafts and submit one event per saved edit; the reducer
validates the graph and records one Undo transaction.

`EditorPolicy.canEditPort` receives a `PortEditCandidate` for add, label,
position and removal operations. `portEditReason` shares normalized
protection reasons with host controls. Pass `canEditPort` as the fourth
argument to `resolvePortRemoval` to combine port and attached-edge
protection. Position batches are atomic when any changed port is locked.

`portInspectorContext` and `portAdditionContext` resolve Option-wrapped
`ZlozPortInspectorContext` and `ZlozPortAdditionContext` for host layouts.
`ZlozPortInspectorOptions` scopes reason IDs and customizes guard copy.
Compose `zlozPortAddButton`, `zlozPortRemoveButton`,
`zlozPortLabelEditButton`, `zlozPortLabelForm`, `zlozPortLabelInput`,
`zlozPortLabelSave`, `zlozPortLabelCancel`, and `zlozPortProtectionReason`.
Hosts own drafts through `ZlozPortLabelFormMessages`; the package retains
native interaction and links each control to its resolved reason.

`ZlozPortPositionDraft` represents unvalidated offset or X/Y text.
`portPositionDraft`, `updatePortPositionDraft`, `portPositionFromDraft`
and `portPositionEditorContext` support host-owned position authoring.
Compose `zlozPortPositionEditButton`, `zlozPortPositionModeSelect`,
`zlozPortPositionSideSelect`, `zlozPortPositionInput`,
`zlozPortPositionForm`, `zlozPortPositionSave`, and `zlozPortPositionCancel`.
Save uses the existing atomic `PortPositionsChanged` event; controls
respect `positionControl` and retain native numeric validation.

`portAnchorHandles` opts selected nodes into direct anchor dragging.
`ZlozPortAnchorHandleContext`, `ZlozPortAnchorHandleOptions` and
`ZlozPortAnchorHandleRenderer` customize `zlozPortAnchorHandle` through
`renderPortAnchorHandle`. `PortAnchorDragStarted` starts a captured,
normalized preview; release commits one Undo transaction and cancellation
restores its graph. `PortAnchorNudged` supplies the keyboard equivalent.
The view's `canEditPort` resolves control state while the reducer rechecks
current policy throughout the gesture.

`EditorOptions.portAnchorSnapDistance` enables nearest-edge attraction in
CSS pixels; zero defaults to free placement. Use
`PortAnchorSnapDistanceChanged` to update the session preference while
idle. `resolvePortAnchorSnap`, `PortAnchorSnapOptions` and
`PortAnchorSnapResult` expose the core calculation. Active handle contexts
publish `snappedSide` for composable feedback. Numeric edits and keyboard
nudges retain exact placement.

`EditorOptions.portAnchorSnapHysteresis` adds an optional CSS-pixel release
and edge-switch margin; zero preserves nearest-edge behavior.
`PortAnchorSnapHysteresisChanged` updates it while idle. The resolver's
`hysteresis` and `previousSide` options retain only an already acquired
edge, while the ordinary snap radius still controls acquisition.

`ZlozViewOptions.portAnchorSnapBypassModifier` opts into an `Alt`,
`Control`, `Meta` or `Shift` mapping. `ZlozPortAnchorSnapBypassModifier`
describes those choices. `PortAnchorSnapBypassChanged` replays the Model's
last raw point for stationary key transitions; pointer start/move facts
can also carry bypass state. Handle contexts expose `snapBypassed` and
the configured mapping. Preferences and one-step Undo remain unchanged.

`renderEdgeLabel` and `renderEdgeLabelEditor` replace the badge and active editor
at the resolved edge anchor. Compose `zlozEdgeLabelBadge`, `zlozEdgeLabelForm`,
`zlozEdgeLabelInput` and `zlozEdgeLabelCancel` to retain native interactions and
Model-owned editing.

`ZlozTheme` configures the editor's scoped CSS tokens and native control
scheme. Use `zlozLightTheme` and `zlozDarkTheme` as presets or pass a partial
`ZlozThemeTokens` object. `themeClassName` continues to support host CSS classes.

`renderWorldOverlay` receives `ZlozWorldOverlayContext` and renders host
content inside the camera transform. `zlozWorldOverlayItem` anchors
arbitrary FoldKit content at a world position and can opt into input.

`nodeToolbar` enables actions anchored to one selected node or group. The
toolbar stays at screen size. `ZlozNodeToolbarOptions` controls placement
and gap, and `renderNodeToolbar` receives `ZlozNodeToolbarContext` for
custom content. Use `zlozContextAction` to render the native action buttons.

`renderEdgeToolbar` replaces the selected-edge controls inside Zloz's positioned
frame. `ZlozEdgeToolbarContext` provides the selected edge, label anchor and
typed actions. Compose `zlozEdgeToolbarButton` and `zlozEdgePathStyleSelect`
for native controls.

`renderContextMenu` replaces the contents of the positioned context panel.
`ZlozContextMenuContext` distinguishes node and edge actions and provides
group sizing where applicable. `zlozContextAction` and
`zlozContextDimensionInput` carry native control semantics.

`renderConnections` replaces the visible connection entries inside the named
group. `ZlozConnectionsContext` carries the filtered edges and their selection,
labels and available actions. Compose `zlozConnectionButton` and
`zlozContextTrigger` for native interaction.

`renderResizeReadout` replaces the badge content within Zloz's positioned
status region. `ZlozResizeReadoutContext` carries the Model node, formatted
dimensions, and resize phase. The effective measurements preference gates it.

`renderAlignmentGuide` replaces the SVG for an eligible snap guide.
`ZlozAlignmentGuideContext` provides world endpoints, gesture phase, and
viewport for screen-size styling. Effective diagnostics gate the hook.

`renderSelectionMarquee` replaces the decoration inside the positioned
box-selection frame. `ZlozSelectionMarqueeContext` provides normalized world
bounds, viewport, the current `BoxSelectionMatch` rule, and pending node IDs.
Node and group shells receive `selectionPreview` separately from selection.

`zoomAreaControl` enables the one-shot **Zoom to area** control.
`ZlozViewportActions.zoomArea` exposes the typed toggle for custom controls.
`renderZoomAreaMarquee` receives the pending camera fit's normalized world
bounds and viewport in `ZlozZoomAreaMarqueeContext`.

`previousViewControl` enables **Back to previous view**.
`ZlozViewportActions.previousView` exposes the same action for custom
controls. The reducer restores the session checkpoint from the last
camera fit independently of graph history.

`renderCanvasHelp` and `renderCanvasStatus` customize guidance and notices
inside the existing accessible description and polite live region. The
contexts provide default copy and the effective visibility preference.

`resolveDeletion` and `EditorPolicy.canDelete` evaluate the complete set of
items a deletion would remove. Pass the same callback to the view to expose
the rejection reason through its action descriptors.

`ZlozWheelNavigation` configures wheel zoom, two-axis panning with modifier
zoom, or native page scrolling through `ZlozViewOptions.wheelNavigation`.
`ZlozViewOptions.doubleClickZoom` independently enables background
double-click zoom, with a default or caller-supplied multiplier.
`ZlozViewOptions.spaceToPan` enables temporary background panning while
Space is held on the focused canvas.
`ZlozViewOptions.middleButtonPan` independently enables background panning
with the middle mouse button.

`ZlozViewOptions.connectionDropRadius` enables nearby targeting for new
connections. `ZlozViewOptions.reconnectionDropRadius` overrides it for
reconnection drags. Both use CSS pixels. The browser adapter sends ordered
candidates and the editor applies the normal connection policy.

`EditorOptions.connectionSnapHysteresis` sets the distance advantage in
CSS pixels needed to replace the current nearby target. Zero disables it.
`ConnectionSnapHysteresisChanged` updates the preference while idle.
`NearbyTarget` extends an endpoint with optional measured distance so
existing endpoint-only input remains supported. The reducer owns retention
and rechecks eligibility on every move.

`EditorPolicy.canMoveNode` controls drag and keyboard movement. Zloz checks
all nodes in the move, including group descendants, before changing the graph.
Use `ZlozViewOptions.canMoveNode` to show locked handles.

`EditorPolicy.canResizeNode` controls explicit dimension edits, including
ancestors grown by those edits. Pass the same callback to
`ZlozViewOptions.canResizeNode` to disable resize controls.

`EditorPolicy.canSelectNode` and `EditorPolicy.canSelectEdge` govern which items
can be selected. Pass the same callbacks to `zlozView` so the controls and
marquee preview agree with the reducer.

`FitSelectionClicked` frames selected visible nodes and edges.
`fitSelectionControl` enables the stock button, and
`ZlozViewportActions.fitSelection` supplies the action for custom controls.

`NodeRevealRequested` centers a node, opens collapsed ancestors, and honors
the editor's zoom limits and Fit view timing. `revealableNodes` provides the
eligible nodes for host search controls.

`EdgeRevealRequested` frames a connection's endpoints and applicable
stored route. `revealableEdges` includes collapsed connections and excludes
those hidden by the editor's visibility settings.

`ZlozSnapshot`, `serializeSnapshot`, and `parseSnapshot` add an optional
camera to the version 1 graph document. Graph-only v1 files remain valid.

`ZlozViewOptions.nodeViewCache` accepts a per-canvas FoldKit lazy slot to
retain built-in node and port views across eligible camera and chooser updates,
including pending connection creation. The staged source is a lazy input, so
changing/cancelling it refreshes native port feedback; unrelated filtering can
reuse the layer. With culling, the slot tracks the mounted set and pins the source.
The whole-layer slot still excludes custom ports and port policies.

`createZlozNodeBodyCache()` creates a per-canvas `ZlozNodeBodyCache` for
`ZlozViewOptions.nodeBodyCache`. Bodies retain their title, context/resize controls
and content while native/custom ports and port policies evaluate live. Both cache
options may be supplied; the whole layer is preferred where eligible. Weak node
identities avoid an accumulating string-ID registry. Stable body wrappers retain
native control order and focused inputs across eligibility changes. Custom shells,
node-body policies, context panels and editing gestures keep live fallback behavior.

`ZlozViewOptions.viewportCulling` opts into mounting canvas items near the
measured viewport. `ZlozViewportCulling` accepts a CSS-pixel overscan value.
The minimap, Fit view, and Connections list retain the full visible graph.

`ZlozVisibility` stores hidden node and edge IDs in the editor session. Set it
at initialization or replace it with `VisibilityChanged`. Canvas, minimap,
Connections, and marquee use the same filtered presentation.

`EditorPolicy.canConnectPort` locks individual outputs and inputs. Pass it to
`zlozView` to disable the matching controls, including composed `zlozPort`
buttons. New connections check both ports. Reconnection checks the replacement
port and preserves the fixed endpoint.

`EditorPolicy.canReconnect` locks individual source or target ends. Pass
the same callback to `ZlozViewOptions.canReconnect` to omit locked handles.
The reducer rechecks permission on commit, and `canConnect` still validates
the proposed connection.

`EditorOptions.zoomLimits` and `EditorOptions.fitViewPadding` configure the
camera shared by input, toolbar actions, and Fit view. Hosts can replace both
with `ViewportConstraintsChanged` or pass `ZoomLimits` to the geometry helpers
`zoomAt` and `fitViewport`.

`EditorOptions.fitViewDuration` opts into animated Fit view. The editor owns
`FitViewTransition` and handles `FitViewAnimationFrame` events from the
FoldKit view, including the browser's reduced-motion preference. Direct
navigation cancels the transition.

## Endpoint chooser contracts

`Core.resolveEdgeReconnection` derives `ZlozEdgeReconnectionContext` for an edge
and source/target end. `ZlozEdgeEndpointChoice` supplies stable endpoint values,
labels, current/hidden flags, eligibility reasons and typed reconnection events.
`ZlozEdgeReconnectionOptions.scope` chooses visible alternatives (default) or all
authored ports; the current endpoint is retained. No graph or draft state is added.

The FoldKit entry exports `zlozEdgeEndpointField`, `zlozEdgeEndpointSelect` and
`zlozEdgeEndpointReasons`, with `ZlozEdgeEndpointOptions` for ID scoping and
native option text. Pair select and reasons with the same prefix. Custom widgets
can use the pure context directly. Recompute with the current Model and use the
same policies in `updateEditor`; preflight does not authorize a later mutation.

`ZlozViewOptions.edgeReconnection` opts into endpoint controls when `edgeToolbar`
is enabled. Pass `canConnect`, `canConnectPort` and `canReconnect` for consistent
candidate feedback. `ZlozEdgeToolbarContext.reconnection` exposes the same
contexts to custom toolbars. Protection descriptions remain available in minimal
mode. Ordinary native select keys and Tab exit remain available.

## Connection creation contracts

`Core.resolveConnectionCreation` derives `ZlozConnectionCreationContext` from the
current editor and policy. Source/target fields expose stable candidate values,
typed `PortActivated` events and protection reasons. Source selection stages the
existing `EditorState.connection`; target selection uses the existing creation
path and fresh ID allocation. Policy callbacks must be pure and supplied to the
reducer as well as the resolver. `ZlozConnectionCreationOptions.scope` defaults
to visible alternatives, retains a hidden pending source and supports explicit
all-authored-port scope.

The FoldKit entry exports `zlozConnectionCreation`, `zlozConnectionCreationField`,
`zlozConnectionCreationSelect`, `zlozConnectionCreationReasons` and
`zlozConnectionCreationCancel`. `ZlozConnectionCreationViewOptions` controls ID
scoping and native option labels. Pair the select and reasons with the same
prefix. The target resets to a focusable placeholder after creation; Escape and
the cancel action clear the pending source without adding history. State hints
remain informational while explicit operation restrictions disable editing.

`ZlozViewOptions.connectionCreation` enables the default panel independently of
diagnostics. `renderConnectionCreation` replaces it with custom FoldKit markup
using the same context and primitives. No new persistence schema or browser
dependency enters the core.

## Searchable endpoint contracts

`Core.resolveEndpointChoices` projects creation or reconnection entries through
`ZlozEndpointSearchOptions.query`. `ZlozEndpointChoices` contains filtered entries,
node groups, the original query, actual match count and no-results feedback.
`ZlozSearchableEndpoint` is the minimal structural input: endpoint, label,
current flag and optional node label. Matching is literal, case-insensitive and
token-based across labels/IDs. Current entries are retained; permissions/events
are preserved and still validated by the reducer.

Both native chooser option types accept `query`, `groupByNode` and `groupLabel`.
Grouping defaults off and uses node identity rather than label identity. Pass the
same query to select and reasons primitives. `zlozEndpointSearchInput`,
`zlozEndpointSearchClear` and `zlozEndpointSearchFeedback` compose Model-owned
queries with native keyboard semantics. Pair input and feedback prefixes through
`ZlozEndpointSearchViewOptions`; Escape clears only the query and the Clear button
keeps focus after clearing. No graph state or persisted document fields are added.

## Package boundaries

The core has no runtime dependencies or browser requirement. FoldKit/Effect are
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
controls under `/foldkit`, and optional real encoding/download IO under `/browser`.
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
{@link FoldKit.zlozDddAuditControls | zlozDddAuditControls} composes native or custom
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
loss acceptance. Native artwork is now available through
{@link FoldKit.zlozEventStormingNode | zlozEventStormingNode} and
{@link FoldKit.zlozEventStormingGroup | zlozEventStormingGroup}. Portable SVG still
requires a host adapter or explicit fidelity fallback. See the README and
ADR 0081 for exact role/kind/port, status, conversion and compatibility boundaries.

## Workshop editing and presentation

{@link Core.createEventStormingWorkshopPattern | createEventStormingWorkshopPattern}
provides an illustrative native starter. Use
{@link Core.resolveEventStormingWorkshopControls | resolveEventStormingWorkshopControls}
and {@link Core.resolveEventStormingWorkshopRequest | resolveEventStormingWorkshopRequest}
for fresh selected-node role/status edits with live protection and ordinary Undo.
{@link FoldKit.zlozEventStormingWorkshopControls | zlozEventStormingWorkshopControls}
composes explicit native status buttons, role selectors and visible reasons, with
replace/omit hooks. {@link FoldKit.zlozWorkshopStatusButton | zlozWorkshopStatusButton}
and {@link FoldKit.zlozWorkshopSelect | zlozWorkshopSelect} support custom layouts.
Native node/lane content, semantic descriptions, header geometry, body caching and
scoped light/dark tokens remain independent of diagnostics. See the README and
ADR 0082 for exact freshness, selection, policy and portable-export limits.

## V3 group-port authoring and canonical models

Use {@link Core.createGroupEditorV3} and the source-bound
{@link Core.planGroupConnectionV3} / {@link Core.planGroupOperationV3} planners
for group endpoints and complete atomic Undo. The distinct
{@link Core.createGroupWorkbenchV3} / {@link Core.updateGroupWorkbenchV3}
controller composes with {@link FoldKit.zlozGroupWorkbenchV3},
{@link FoldKit.zlozGroupInspectorV3}, {@link FoldKit.zlozGroupActionV3} and
{@link FoldKit.zlozGroupDragHandleV3}. Custom content/controls, live policies,
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
{@link FoldKit.zlozSvgReview}. Exact-artifact loss consent and current policy are
checked before returning a detached download payload for a Command. Export never
edits history. SVG is static artwork, not an editable model codec; other adapters
remain separately scoped. See README and native SVG evidence.

## Native v3 PNG export

{@link Core.planGroupPngExportV3} uses the same validated full-document SVG and
findings, adding explicit rasterization loss and bounded integer output.
{@link Core.resolveGroupPngReviewV3} / {@link Core.updateGroupPngReviewV3} compose
with shared PNG review state and {@link FoldKit.zlozPngReview}; consent, full-source
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
rewritten. {@link FoldKit.zlozGroupClipboardV3} supplies optional composable
controls with visible reasons, including minimal mode. Session clipboard has no OS
clipboard IO and is not persisted in models or history.
