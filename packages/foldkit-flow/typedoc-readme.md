# FoldKit Flow public contract

Generated from the package's public TypeScript entry points. Search for any type
or function, or select a module to inspect signatures, fields and source links.
This reference describes the current source revision. Version 0.1.0 remains a
local release candidate; npm publication has not been performed.

| Module                   | Import                                    | Contract                                                                      |
| ------------------------ | ----------------------------------------- | ----------------------------------------------------------------------------- |
| {@link Core}             | `@opsydyn/foldkit-flow`                   | Graphs, Model-owned editing, geometry, serialization and layout publication   |
| {@link FoldKit}          | `@opsydyn/foldkit-flow/foldkit`           | View configuration, shell composition, interaction primitives and diagnostics |
| {@link ELK}              | `@opsydyn/foldkit-flow-elk`               | Optional compound/port-aware automatic layout                                 |
| {@link Force}            | `@opsydyn/foldkit-flow-force`             | Optional deterministic force layout                                           |
| {@link ForceEligibility} | `@opsydyn/foldkit-flow-force/eligibility` | Lightweight support checks                                                    |

## State and editing

`FlowGraph`, `FlowNode`, `FlowEdge` and `Port` describe JSON-compatible documents.
The host owns `EditorState`; `createEditor` initializes it and `updateEditor`
applies typed `EditorEvent` facts. Gestures, selection, viewport and bounded history
stay in that Model. Commands and persistence belong to the consuming application.

`parseGraph`/`serializeGraph` handle versioned documents. `FlowError` reports invalid
graphs, edits and layouts. Browser measurements report content height without
replacing authored widths. Layout publication uses `LayoutRequest`, `LayoutResult`
and revision checks through `layoutRequest`/`applyLayout`.

## Presentation composition

`FlowViewOptions<Message>` uses the host's `HtmlBuilder<Message>` and event wrapper.
`renderNode` customizes card contents; `renderNodeShell`/`renderGroupShell` replace
complete shells. Public frames, drag handles, ports and resize handles retain
interaction/measurement bindings while the host owns visual markup and styling.
The default view uses those same primitives.

`FlowEdgeGeometryPolicy` resolves a shared path and label anchor for decoration,
selection, labels and toolbar placement. `renderEdge` decorates that resolved
path. Ports support legacy cardinal side/offset positions or normalized custom
anchors. `PortPosition` makes those forms mutually exclusive; `portAnchor`,
`portPosition` and `portBoundaryPosition` share their geometry across presentation
and layout. `PortPositionsChanged` applies an undoable batch.
`FlowDiagnosticOptions` supports individual diagnostics and global minimal mode.
`FlowBackground` supports dots, squares, no background and host-rendered designs.

`resolveConnectionPreview` and `FlowConnectionGeometryPolicy` expose incomplete
connection geometry without synthetic edges. `FlowConnectionFeedback` carries
free/valid/invalid target state from the core. `renderConnection` replaces the
SVG preview while native port interactions, cancellation and Undo remain shared.

`FlowViewportControlsContext` provides typed navigation actions for custom control
layouts. `flowViewportControl` provides native button semantics. `FlowMinimapContext`
provides visible node and camera geometry; use `flowMinimap` for input and
`flowMinimapViewport` for an optional, separately styled camera outline. The
`renderViewportControls` and `renderMinimap` hooks use these same contracts.

`portLabels` enables labels for named ports, with ID fallback.
`FlowPortLabelContext` supplies the port, node, canonical world position,
resolved placement and gap. Compose `flowPortLabel` in `renderPortLabel`
for custom content and placement. It keeps labels decorative and anchored
independently of the node shell.

`renderPort` receives `FlowPortRenderContext` for each socket.
Compose `flowPort` to retain native input and geometry. Custom shells can
append the resolved `FlowNodeRenderContext.ports` collection as direct
frame children. Undefined keeps the default and null omits the control.

`renderEdgeLabel` and `renderEdgeLabelEditor` replace the badge and active editor
at the resolved edge anchor. Compose `flowEdgeLabelBadge`, `flowEdgeLabelForm`,
`flowEdgeLabelInput` and `flowEdgeLabelCancel` to retain native interactions and
Model-owned editing.

`FlowTheme` configures the editor's scoped CSS tokens and native control
scheme. Use `flowLightTheme` and `flowDarkTheme` as presets or pass a partial
`FlowThemeTokens` object. `themeClassName` continues to support host CSS classes.

`renderWorldOverlay` receives `FlowWorldOverlayContext` and renders host
content inside the camera transform. `flowWorldOverlayItem` anchors
arbitrary FoldKit content at a world position and can opt into input.

`nodeToolbar` enables actions anchored to one selected node or group. The
toolbar stays at screen size. `FlowNodeToolbarOptions` controls placement
and gap, and `renderNodeToolbar` receives `FlowNodeToolbarContext` for
custom content. Use `flowContextAction` to render the native action buttons.

`renderEdgeToolbar` replaces the selected-edge controls inside Flow's positioned
frame. `FlowEdgeToolbarContext` provides the selected edge, label anchor and
typed actions. Compose `flowEdgeToolbarButton` and `flowEdgePathStyleSelect`
for native controls.

`renderContextMenu` replaces the contents of the positioned context panel.
`FlowContextMenuContext` distinguishes node and edge actions and provides
group sizing where applicable. `flowContextAction` and
`flowContextDimensionInput` carry native control semantics.

`renderConnections` replaces the visible connection entries inside the named
group. `FlowConnectionsContext` carries the filtered edges and their selection,
labels and available actions. Compose `flowConnectionButton` and
`flowContextTrigger` for native interaction.

`renderResizeReadout` replaces the badge content within Flow's positioned
status region. `FlowResizeReadoutContext` carries the Model node, formatted
dimensions, and resize phase. The effective measurements preference gates it.

`renderAlignmentGuide` replaces the SVG for an eligible snap guide.
`FlowAlignmentGuideContext` provides world endpoints, gesture phase, and
viewport for screen-size styling. Effective diagnostics gate the hook.

`renderSelectionMarquee` replaces the decoration inside the positioned
box-selection frame. `FlowSelectionMarqueeContext` provides normalized world
bounds, viewport, the current `BoxSelectionMatch` rule, and pending node IDs.
Node and group shells receive `selectionPreview` separately from selection.

`zoomAreaControl` enables the one-shot **Zoom to area** control.
`FlowViewportActions.zoomArea` exposes the typed toggle for custom controls.
`renderZoomAreaMarquee` receives the pending camera fit's normalized world
bounds and viewport in `FlowZoomAreaMarqueeContext`.

`previousViewControl` enables **Back to previous view**.
`FlowViewportActions.previousView` exposes the same action for custom
controls. The reducer restores the session checkpoint from the last
camera fit independently of graph history.

`renderCanvasHelp` and `renderCanvasStatus` customize guidance and notices
inside the existing accessible description and polite live region. The
contexts provide default copy and the effective visibility preference.

`resolveDeletion` and `EditorPolicy.canDelete` evaluate the complete set of
items a deletion would remove. Pass the same callback to the view to expose
the rejection reason through its action descriptors.

`FlowWheelNavigation` configures wheel zoom, two-axis panning with modifier
zoom, or native page scrolling through `FlowViewOptions.wheelNavigation`.
`FlowViewOptions.doubleClickZoom` independently enables background
double-click zoom, with a default or caller-supplied multiplier.
`FlowViewOptions.spaceToPan` enables temporary background panning while
Space is held on the focused canvas.
`FlowViewOptions.middleButtonPan` independently enables background panning
with the middle mouse button.

`FlowViewOptions.connectionDropRadius` enables nearby targeting for new
connections. `FlowViewOptions.reconnectionDropRadius` overrides it for
reconnection drags. Both use CSS pixels. The browser adapter sends ordered
candidates and the editor applies the normal connection policy.

`EditorOptions.connectionSnapHysteresis` sets the distance advantage in
CSS pixels needed to replace the current nearby target. Zero disables it.
`ConnectionSnapHysteresisChanged` updates the preference while idle.
`NearbyTarget` extends an endpoint with optional measured distance so
existing endpoint-only input remains supported. The reducer owns retention
and rechecks eligibility on every move.

`EditorPolicy.canMoveNode` controls drag and keyboard movement. Flow checks
all nodes in the move, including group descendants, before changing the graph.
Use `FlowViewOptions.canMoveNode` to show locked handles.

`EditorPolicy.canResizeNode` controls explicit dimension edits, including
ancestors grown by those edits. Pass the same callback to
`FlowViewOptions.canResizeNode` to disable resize controls.

`EditorPolicy.canSelectNode` and `EditorPolicy.canSelectEdge` govern which items
can be selected. Pass the same callbacks to `flowView` so the controls and
marquee preview agree with the reducer.

`FitSelectionClicked` frames selected visible nodes and edges.
`fitSelectionControl` enables the stock button, and
`FlowViewportActions.fitSelection` supplies the action for custom controls.

`NodeRevealRequested` centers a node, opens collapsed ancestors, and honors
the editor's zoom limits and Fit view timing. `revealableNodes` provides the
eligible nodes for host search controls.

`EdgeRevealRequested` frames a connection's endpoints and applicable
stored route. `revealableEdges` includes collapsed connections and excludes
those hidden by the editor's visibility settings.

`FlowSnapshot`, `serializeSnapshot`, and `parseSnapshot` add an optional
camera to the version 1 graph document. Graph-only v1 files remain valid.

`FlowViewOptions.nodeViewCache` accepts a per-canvas FoldKit lazy slot to
retain built-in node and port views across eligible camera-only updates.
With culling, the slot tracks the currently mounted node set.

`FlowViewOptions.viewportCulling` opts into mounting canvas items near the
measured viewport. `FlowViewportCulling` accepts a CSS-pixel overscan value.
The minimap, Fit view, and Connections list retain the full visible graph.

`FlowVisibility` stores hidden node and edge IDs in the editor session. Set it
at initialization or replace it with `VisibilityChanged`. Canvas, minimap,
Connections, and marquee use the same filtered presentation.

`EditorPolicy.canConnectPort` locks individual outputs and inputs. Pass it to
`flowView` to disable the matching controls, including composed `flowPort`
buttons. New connections check both ports. Reconnection checks the replacement
port and preserves the fixed endpoint.

`EditorPolicy.canReconnect` locks individual source or target ends. Pass
the same callback to `FlowViewOptions.canReconnect` to omit locked handles.
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

## Package boundaries

The core has no runtime dependencies or browser requirement. FoldKit/Effect are
optional view peers; ELK and force layout are separately installed adapters.
Policies and view configuration are functions outside serialized documents.
Outside-box anchors and arbitrary routing normals are not part of the
current contract.
