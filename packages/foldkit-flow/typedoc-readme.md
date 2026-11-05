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

`renderEdgeLabel` and `renderEdgeLabelEditor` replace the badge and active editor
at the resolved edge anchor. Compose `flowEdgeLabelBadge`, `flowEdgeLabelForm`,
`flowEdgeLabelInput` and `flowEdgeLabelCancel` to retain native interactions and
Model-owned editing.

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
bounds and the viewport.

## Package boundaries

The core has no runtime dependencies or browser requirement. FoldKit/Effect are
optional view peers; ELK and force layout are separately installed adapters.
Policies and view configuration are functions outside serialized documents.
Outside-box anchors, arbitrary routing normals and a complete overlay
composition API are not part of the current contract.
