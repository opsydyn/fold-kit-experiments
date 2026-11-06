# FoldKit Flow

Graph editing with state owned by your application. The pure TypeScript core has
no runtime dependencies. The optional `/foldkit` entry renders HTML nodes and SVG
edges through your existing FoldKit builder. ELK is available separately as
`@opsydyn/foldkit-flow-elk`.

Version 0.1.0 is a local release candidate; npm publication has not been performed.

## Install

After publication:

```sh
npm install @opsydyn/foldkit-flow
# Only for the native view:
npm install foldkit@0.170.0 effect@4.1.0 @effect/platform-browser@4.1.0
```

For this checkout, use the checked tarball described in
[the publication guide](https://github.com/opsydyn/fold-kit-experiments/blob/main/docs/releases/foldkit-flow.md). ESM only, Node 22+
for tooling. The view is for browsers; pure imports do not access browser globals.
The tested view baseline is FoldKit 0.170.0 / Effect 4.1.0. Both are optional peers.

## Core

```ts
import { createEditor, updateEditor, serializeGraph, parseGraph } from '@opsydyn/foldkit-flow';
import type { FlowGraph } from '@opsydyn/foldkit-flow';

const graph: FlowGraph = {
  nodes: [
    {
      id: 'source',
      label: 'Source',
      position: { x: 40, y: 40 },
      size: { width: 180, height: 90 },
      ports: [{ id: 'out', kind: 'output', side: 'right', offset: 0.5 }],
    },
  ],
  edges: [],
};
const editor = createEditor(graph);
const selected = updateEditor(editor, { type: 'NodeSelected', id: 'source', additive: false });
const moved = updateEditor(selected, { type: 'SelectionNudged', delta: { x: 20, y: 0 } });
const document = serializeGraph(moved.graph);
const restored = createEditor(parseGraph(document));
```

Keep the editor in your Model. Nodes have stable IDs, positions, positive dimensions
and named input/output ports. Port offsets are fractions of the chosen side. Edges
refer to both node and port IDs. Optional node/edge `data` accepts finite JSON data.
Functions reject duplicate IDs, invalid sizes and missing/wrong-direction endpoints
with `FlowError`. JSON syntax errors remain `SyntaxError`.

`updateEditor(state, event, { canConnect })` lets the application reject a proposed
connection with a reason or accept it with `null`. Cycles are allowed by the core.
Exact duplicate connections are ignored with a notice. The policy is supplied by
the host on each update; it is not serialized into the Model.

Each completed drag, keyboard nudge, graph edit or accepted layout is one undo
transaction. Escape restores the pre-drag positions. The default history limit is
100 (configurable from 0 to 1000). Measurements update dimensions without creating
history entries. Undo and measurements advance the revision used to reject stale
layout results. Selection, viewport, gestures and history are excluded from saved
documents. Applications own storage and migration beyond document version 1.

## FoldKit view

```ts
import { flowView } from '@opsydyn/foldkit-flow/foldkit';
import type { EditorEvent, EditorState } from '@opsydyn/foldkit-flow';
import type { HtmlBuilder } from 'foldkit/html';

function view(h: HtmlBuilder<EditorEvent>, editor: EditorState) {
  return flowView(h, editor, {
    id: 'my-flow',
    label: 'Workflow editor',
    onEvent: (event) => event,
    renderNode: (node, builder) => builder.p([], [node.label]),
  });
}
```

Use a document-unique `id`. Custom nodes use the parent's builder and normal
FoldKit messages. Inputs, textareas, selects and editable content keep their normal
behaviour. Add `data-flow-no-drag` to custom interactive areas as needed. Native
input and ResizeObserver resources are acquired by Mount and released on unmount;
input observation stops while DevTools displays a historical view. Resuming input
cancels any unfinished gesture retained in that Model snapshot.

- Drag node titles; Shift-click titles to select several. Drag the background to pan.
- Scroll over the surface to zoom around the pointer (0.1–4× by default). The surface owns touch
  gestures; this initial version supports one pointer, not pinch zoom.
- Tab to titles; Enter/Space selects and arrow keys move. Shift uses larger steps.
- Activate an output port, then an input port, by mouse or keyboard to connect.
- Escape cancels. Delete removes selected nodes and their incident edges together.
- Cmd/Ctrl+Z undoes; Shift+Cmd/Ctrl+Z or Ctrl+Y redoes. Text fields retain native undo.
- Connection buttons below the surface provide keyboard selection of edges.

The view measures node content. Width is controlled by `node.size.width`; height
follows content, with a 64px minimum. Fit through `fitViewport(graph, editor.surface)`
after the surface has reported dimensions. Zoom limits can prevent fitting extremely
large graphs. When replacing a document on an existing mounted surface, preserve
`editor.surface` (as the example's load handler does). Read-only editors retain
selection and viewport navigation.

Styles use ordinary HTML, inline geometry, and optional CSS variables:
`--flow-background`, `--flow-node-background`, `--flow-node-color`. No CSS import or
module registration is needed. Custom node content must remain accessible.

## Optional layout

Create a `layoutRequest(editor, uniqueRequestId)`, store it as the active request,
then run your chosen `LayoutEngine` in a Command. On completion pass the **current
active request** to `applyLayout(editor, active, result)`. The result is accepted
only if the request ID and revision still match and no gesture is active. Clear
the active request when loading/replacing a document; request IDs must not be reused
while old results can still arrive. Rendering never starts layout work.

Manual positioning has no layout dependency. The adapter receives a detached
snapshot; it cannot mutate the Model. All node positions are required exactly
once. Routes are optional, keyed by edge ID; node movement invalidates them and
the view uses straight lines until another arrange result is applied.

## Example and checks

Run `bun run --filter @opsydyn/web dev` and open `/flow` for custom text controls,
connections, ELK arrange, undo, save and reload. Storage belongs to that example.

```sh
bun run --filter @opsydyn/foldkit-flow typecheck
bun run --filter @opsydyn/foldkit-flow test
bun run --filter @opsydyn/foldkit-flow pack:check
```

Initial scope: flat graphs, click-to-connect, single-pointer editing and bounded
history. Collaboration, execution,
virtualization and general layout algorithms are future work. Automated browser
checks do not establish assistive-technology or physical-touch acceptance.

Use `NodeWidthChanged` to commit an authored width while the view continues to
measure content height. `EdgeDataChanged` commits application-owned JSON metadata.
Both participate in undo/redo and graph serialization. The FoldKit view's
`edgeAppearance` callback can read edge data to customize stroke, width and dash
pattern. The editor still highlights the selected edge.

Use `renderEdge(context, h)` for custom SVG decoration along `context.path`.
The context includes the edge, label position, selection state, resolved
stroke, width and dash array, and an arrow marker reference. Return
`undefined` to draw the built-in edge. Keep custom SVG decorative and draw it
along the supplied path so Flow's hit area, reconnect handles, and editable
label stay aligned. The SVG is hidden from assistive technology. Put
interactive controls in the host view.

Edge labels appear at the midpoint of the rendered path, including routed
edges. Select an unlabeled connection and choose **Add label**, or activate
an existing label to edit it. Enter saves, Escape cancels, and saving a blank
label removes it. Saving is one undo step. Read-only views display saved labels.

Use `renderEdgeLabel` for a custom badge and `renderEdgeLabelEditor` for an
inline editor. Each hook receives the edge, selection state, endpoint
description, and the same world anchor used by the default label. The editor
also receives the current draft. The view positions both in a protected HTML
layer on the canvas, so pointer and keyboard input inside a label can be used
without triggering canvas gestures.

```ts
// Import these primitives from @opsydyn/foldkit-flow/foldkit.
renderEdgeLabel: (context, h) =>
  flowEdgeLabelBadge(h, context, onEvent, [h.Class('relation-badge')], [
    context.edge.label || 'Add label',
  ]),
renderEdgeLabelEditor: (context, h) =>
  flowEdgeLabelForm(h, context, onEvent, [h.Class('relation-editor')], [
    flowEdgeLabelInput(h, context, onEvent, []),
    h.button([h.Type('submit')], ['Apply label']),
    flowEdgeLabelCancel(h, context, onEvent, [], ['Discard']),
  ]),
```

Pass the same `onEvent` mapping used by `flowView`. The badge is a native edit
button in editable views and static text in read-only views. The form handles
submit and Escape, while the input reads and updates the Model draft. Return
`undefined` from either hook to use the default. Return `null` from
`renderEdgeLabel` to hide the badge while retaining any enabled Rename action.
The hooks require a resolved label anchor. Saved labels and selected editable
unlabeled edges are eligible for the badge hook.

Set an edge's optional `pathStyle` to `straight`, `stepped`, or `smooth`.
These styles draw between the current ports and take precedence over layout
routes. `EdgePathStyleChanged` saves the style in one undo step. Pass
`pathStyle: null` in that event to restore automatic routing. Automatic uses the
layout route when available and a straight line otherwise.

Supply `renderWorldOverlay` to draw annotations and domain visuals in diagram
coordinates. Its context includes the visible nodes and edges, selection,
viewport, and measured surface. The layer shares the node transform and is
clipped to the canvas. Return `null` or `undefined` to omit it. Overlay
visibility is controlled by the host, including in minimal mode.

Use `flowWorldOverlayItem` from `@opsydyn/foldkit-flow/foldkit` to anchor
HTML at a world point. Decorative items pass pointer input through by
default. Set `interactive: true` for native controls that handle their
own input while Flow's canvas gestures and shortcuts stay out of the way.

```ts
renderWorldOverlay: (_context, h) =>
  flowWorldOverlayItem(h, { position: { x: 180, y: 60 } }, [], [
    h.span([], ['Review required']),
  ]),
```

With `nodeToolbar: true`, selecting one visible node or group shows **Duplicate
node** and **Delete node**. The toolbar follows the node in screen space and
keeps its size as you zoom. Supply `nodeToolbar: { placement: 'bottom', offset: 12 }`
to choose a side and a gap in CSS pixels. The default places it above the
node and switches below when the node is near the top. The canvas clips the
toolbar at its edges.

`renderNodeToolbar` receives the visible node, viewport, screen-space anchor,
and action descriptors. Compose native buttons with `flowContextAction`, or
use your own FoldKit controls. Return `undefined` for the default contents
or `null` to suppress the toolbar for that selection. Deletion uses the same
`canDelete` policy as the keyboard and context actions. The toolbar is an
editing control, so it can appear in minimal mode when enabled.

Enable `edgeToolbar: true` to show Rename, path style, and Delete edge
controls beside a single selected edge. In the Connections list, activate an
edge and press Up Arrow to focus its actions. The toolbar uses native controls
and stays the same size as the canvas zooms. Deleting from the toolbar removes
only that edge and can be undone.

With `edgeToolbar: true`, supply `renderEdgeToolbar` to arrange, style, or
omit individual actions. Its context contains the selected edge, the shared
label anchor in world coordinates, and the typed actions `rename`,
`deleteEdge`, and `changePathStyle`. Use the package primitives or send the
events through the same `onEvent` mapping as the canvas.

```ts
// Import these primitives from @opsydyn/foldkit-flow/foldkit.
renderEdgeToolbar: (context, h) =>
  h.div([h.Class('edge-actions')], [
    flowEdgePathStyleSelect(h, context, onEvent, []),
    flowEdgeToolbarButton(h, context.actions.deleteEdge, onEvent, [], ['Delete edge']),
  ]),
```

The positioned frame keeps the same screen-space placement as the default
toolbar and offers up to 256 px of width. Arrow Up from the selected connection
focuses the first available control in DOM order, or the group itself when
there are no eligible controls. Return `undefined` for the default layout or
`null` to hide the toolbar and its keyboard shortcut for that edge.

With `contextActions: true`, use `renderContextMenu` to replace the contents of
the node, group, or edge context panel. The context is discriminated by
`kind` and contains the selected item, surface point, and typed actions.
Group contexts include fit, aspect ratio, and dimension editing. The package
still owns panel placement, the accessible group, and input handling.

```ts
// Import the primitives from @opsydyn/foldkit-flow/foldkit.
renderContextMenu: (context, h) =>
  h.div([h.Class('context-panel')], [
    ...(context.kind === 'edge'
      ? [flowContextAction(h, context.rename, onEvent, [], ['Rename'])]
      : [flowContextAction(h, context.duplicate, onEvent, [], ['Duplicate node'])]),
    flowContextAction(h, context.close, onEvent, [], ['Close']),
  ]),
```

Use `flowContextDimensionInput` for a native number field with the current
value, grid step, and disabled state. The group's `showMeasurements` flag
carries the effective diagnostics preference. Return `undefined` to use the
default content. On opening, Flow focuses the first focusable control or the
panel itself. Escape returns focus to the canvas. Clicking or moving focus
outside dismisses the panel.

Use `renderConnections` to arrange the visible edges in a custom list. The
context provides their selected state, endpoint labels, optional context
actions, and whether the list is compact or read-only. Flow owns the named
Connections group and its compact disclosure, and calls the renderer only
when the list is open. Edges hidden inside collapsed groups are filtered
before the renderer runs.

```ts
// Import these primitives from @opsydyn/foldkit-flow/foldkit.
renderConnections: ({ entries }, h) =>
  h.ul([], entries.map((entry) =>
    h.li([h.Key(entry.edge.id)], [
      flowConnectionButton(h, entry, onEvent, [], [entry.label]),
      ...(entry.contextAction
        ? [flowContextTrigger(h, entry.contextAction, onEvent, [], ['⋯'])]
        : []),
    ]),
  )),
```

The selection button includes Arrow Up to the active toolbar and Shift+F10
or the Context Menu key when context actions are available. Return
`undefined` for the default list.

Use a group's **Collapse** and **Expand** buttons to change its canvas
presentation. A collapsed group hides its descendants and internal edges.
Connections that cross the boundary remain visible and attach to the compact
group. Expand the group to access its individual ports. Collapsing and
expanding also work in read-only views. They are editor-session actions and
leave saved documents and undo history intact.

Set `resizeHandles: true` on the FoldKit view to enable pointer resizing.
Card handles adjust width while height follows content. The drag range is 140
to 320 graph units, extended to include an existing width outside that range.
Escape or pointer cancellation restores the starting width. Releasing commits
one undo step. Provide a keyboard control via `NodeWidthChanged` when enabling
handles in an editable view.

Selected expanded groups show four corner handles and four midpoint side handles.
Corners adjust width and height; unlocked sides adjust only their own axis.
The opposite corner stays anchored and children keep their canvas positions. Shrinking stops at the contents
plus 24 units of padding, with a minimum of 224 × 96 (or the starting dimensions
when already tighter). Parent containment clamps
growth unless `expandParent` enables ancestor expansion. Focus the handle and use
arrow keys to adjust by 5 graph units, or Shift+Arrow by 20. With grid snapping
on, these steps are one and four grid intervals respectively. Each keyboard action
is one undo step; pointer drags commit once and Escape restores the original
bounds. Hosts can dispatch `GroupResizeNudged` with an `id` and `{ x, y }` delta.
Collapsed and read-only groups cannot be resized.

Drag from an output port to see a preview and highlight an eligible input.
You can also activate an output and then an input with Enter or Space.
The editor announces completion or cancellation in its status region.

Send `EdgeReconnected` with an edge ID, the end to replace, and the new port.
The editor checks port direction, duplicates, and the connection policy before
committing one undo step. The policy receives the proposed edge and the graph
with the previous version of that edge removed.

### Scoped themes and Pleat

Pass `theme: flowLightTheme` or `theme: flowDarkTheme` to a FoldKit view.
The presets cover the canvas, nodes, groups, ports, edges, and interaction
feedback. Each also sets the color scheme for native controls within that
editor. The presets and the typed token contract are exported by
`@opsydyn/foldkit-flow/foldkit`.

```ts
import { flowDarkTheme, type FlowTheme } from '@opsydyn/foldkit-flow/foldkit';

const theme: FlowTheme = {
  ...flowDarkTheme,
  tokens: { ...flowDarkTheme.tokens, selection: 'var(--app-accent)' },
};
```

Explicit `theme.tokens` take precedence over class values for the same
tokens. Supply a partial token object to inherit the other variables from
the host. The editor's theme can change on any render without recreating
its state.

Set `themeClassName` on a Flow view to scope a theme to that editor. Existing
CSS variables still inherit from ancestors. A host using Pleat can combine a
class from `cssClass()` with a CSS class that maps its semantic theme tokens
to the Flow variables. Pleat owns the host theme and style registration.

| Part        | CSS variables                                                                                                                            |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Canvas      | `--flow-background`, `--flow-canvas-border`, `--flow-grid-line`, `--flow-grid-dot`                                                       |
| Node        | `--flow-node-background`, `--flow-node-color`, `--flow-node-border`, `--flow-node-radius`                                                |
| Ports       | `--flow-input-port`, `--flow-output-port`, `--flow-port-border`, `--flow-control-color`                                                  |
| Edges       | `--flow-edge`, `--flow-edge-width`                                                                                                       |
| Interaction | `--flow-selection`, `--flow-valid-target`, `--flow-resize-background`, `--flow-resize-readout-background`, `--flow-resize-readout-color` |

For example, given a Pleat theme that exposes the app's semantic CSS tokens:

```css
.release-flow-theme {
  --flow-background: var(--app-surface);
  --flow-node-background: var(--app-panel);
  --flow-node-color: var(--app-text);
  --flow-selection: var(--app-accent);
}
```

Pass `themeClassName: 'release-flow-theme'` in the Flow view options. To apply
a Pleat style directly to the root as well, append its `cssClass(style)` result.
A per-edge `edgeAppearance` stroke or width takes precedence over the default
edge tokens, and the selection token controls the selected stroke.
See [Pleat's FoldKit and theme APIs](https://github.com/Manzanita-Research/pleat#theming).

Select an edge to expose its available endpoint handles. Drag a handle to a
compatible port to reconnect the edge. Escape or dropping elsewhere cancels.

Set `connectionDropRadius: 32` on the view to snap connection and reconnection
drops within 32 CSS pixels of a rendered port center. The default is zero.
The preview and release use the first eligible nearby port in distance order.
An exact port hit takes priority and can show its normal rejection reason.
The distance stays constant in screen space as the canvas zooms.

Pass `canConnectPort(endpoint, graph)` to both `updateEditor` and `flowView`
to lock individual ports. Return a reason to block the port or `null` to allow
it. Locked outputs cannot start new wires, and locked inputs reject drops.
Existing edges stay visible. Reconnecting an edge checks the destination port
for the end being moved. Use `canReconnect` to lock the edge end itself and
`canConnect` for rules that depend on the proposed pair.

The view disables locked port buttons, including custom shells that use
`flowPort`. Use `data-flow-port-locked` to style them. The reducer checks the
policy again before committing pointer, keyboard, and direct connection edits.

Pass the same `canReconnect` callback to `updateEditor` and `flowView` to
lock specific edge ends. The callback receives the existing edge, the end
(`'source'` or `'target'`), and the full graph. Return a reason to lock the
end or `null` to allow an attempt. Locked handles are omitted. The reducer
checks again during a drag and before committing, including for direct
`EdgeReconnected` events from an inspector. Allowed targets still go
through port validation and `canConnect`.

```ts
const canReconnect: EditorPolicy['canReconnect'] = (edge, end) =>
  edge.id === 'approval' && end === 'source' ? 'Approval source is locked.' : null;
```

Hosts can offer the same edit through keyboard controls using `EdgeReconnected`.

A node with `kind: 'group'` draws a boundary. Set a node's `parentId` to a
group ID to make it a member. Groups can contain other groups. Positions
remain in canvas coordinates, including inside a group. Dragging or nudging a
group moves its descendants once, even when some are also selected. Deleting
a group deletes its descendants and their connections in one undo step.

Drag a node or group title into an expanded boundary to change its parent.
The deepest eligible group under the pointer highlights as the drop target.
Drop outside all eligible boundaries to move the selection to the canvas root.
Only the roots of the dragged selection change parent, so nested contents stay
together. Position and membership share one undo step. Escape cancels the drag.

Group membership is explicit. Layout engines can return an optional size on a
group position to fit the boundary to its children. The ELK adapter arranges
both flat and nested graphs.

`SelectionGrouped` wraps selected siblings in a new boundary sized to their
contents. `SelectionUngrouped` removes selected boundaries and promotes their
contents to the nearest remaining parent. Both preserve canvas positions and
connections and commit one undo step.

Shift-drag the canvas background to draw a selection box. Releasing selects
fully enclosed nodes and replaces the previous selection. If the box encloses
a group and its children, the group represents them in the selection. Escape
cancels without changing the prior selection. Box selection leaves the graph
and undo history intact.

Set `minimap: true` to show the diagram overview after the canvas is measured.
The rectangle shows the current viewport. Click the overview to center the
canvas on that point at the current zoom. This changes only the viewport.

Set `viewportControls: true` to show **Zoom in**, **Zoom out**, and **Fit view**
above the canvas. Zoom is centered on the visible canvas. The controls are
available in read-only views and work with standard button keyboard input.

Enable `snapToGrid` in editor options or send `GridSnapToggled` to toggle
a canvas grid (`gridSpacing`, default 20 units). While dragging, the grabbed node snaps to the grid and
the rest of the selection follows by the same offset, including group contents.
Group resize handles and width edits snap the moving boundary in canvas units,
including top/left boundaries and side handles. Size limits, content and parent
constraints, and locked proportions take precedence when a grid intersection
cannot satisfy them. Resizing preserves fixed children and its opposite anchor.
The setting is session state and each completed drag is one undo step.
Background appearance is configured separately and follows pan and zoom.

Copy, Paste, and Duplicate work from canvas focus with Ctrl/Cmd+C, V, and D.
Enable `snapToAlignment` or send `AlignmentSnapToggled` to align the dragged
selection's edges and centers with nearby visible nodes. Guides appear within
six screen pixels of a match at any zoom. Alignment takes priority on a matched
axis; grid snapping still applies on the other axis. Guides disappear on
release or cancellation. Set `--flow-alignment-guide` to theme their color.

Set `autoPan: true` on the FoldKit view to pan near the canvas boundary
during node moves, connection drags, and reconnections. The drag remains
anchored to the pointer as the viewport moves. Release or Escape stops the
pan. Viewport travel stays separate from graph undo.

Set `wheelNavigation` to choose how the canvas handles wheel and trackpad
scrolling:

| Mode     | Behavior                                                                  |
| -------- | ------------------------------------------------------------------------- |
| `'zoom'` | The default. Vertical wheel motion zooms around the cursor.               |
| `'pan'`  | Scroll pans in both axes. Hold Ctrl or Command to zoom around the cursor. |
| `'off'`  | Wheel events keep their native page or browser behavior.                  |

The option applies only to wheel input on the canvas. Editable controls
keep their own wheel behavior. Flow updates its default help text to match
the option. Custom help receives the same `wheelNavigation` value.

Set `doubleClickZoom: true` to zoom in 1.25× around the pointer when
double-clicking the background. You can supply a finite multiplier
greater than 1 for a different step. The feature defaults to off and
works independently of wheel and pinch zoom. Box select, Zoom to area,
and interactive canvas items keep their own input behavior. Background
clicks still clear selection during normal navigation.

Set `spaceToPan: true` to pan temporarily with Space. Focus the canvas,
hold Space, then drag from the background. The drag preserves selection
and leaves Box select or Zoom to area available for the next drag.
Releasing Space during a drag lets it finish. Escape cancels the drag,
and focus loss clears the shortcut. Space continues to activate buttons
and enter text when those controls have focus. The feature defaults to off.

Set `middleButtonPan: true` to pan by middle-dragging the canvas background.
The gesture preserves selection and leaves Box select or Zoom to area
ready for a primary-button drag. Links and controls keep their native
middle-click behavior. This option defaults to off and is independent of
Space-drag and wheel navigation.

Pass `zoomLimits: { minZoom: 0.75, maxZoom: 1.3 }` and
`fitViewPadding: 96` to `createEditor` to customize the camera. Wheel,
pinch, double-click, toolbar, and Fit view share the inclusive range. Both limits must
be finite and positive, and equal limits fix the zoom. An explicit
`viewport` must be in range. Without one, Flow starts at the allowed zoom
closest to 1.

Fit view uses CSS pixels for padding and caps the inset at a quarter of the
shorter canvas side. The defaults are 0.1–4× and 24 px. Dispatch
`ViewportConstraintsChanged` while idle to change both settings. If the
current zoom falls outside the new range, Flow clamps around the canvas
center and stops any running fit. For host-controlled camera operations,
`zoomAt` and `fitViewport` take the same `ZoomLimits` as an optional fourth
argument.

Pass `fitViewDuration: 400` to `createEditor` to animate Fit view over
400 milliseconds. The default is zero for instant fitting. The FoldKit
view fits immediately when the browser prefers reduced motion. Panning,
zooming, or starting a canvas gesture takes over from the current camera
position. Dispatch `FitViewDurationChanged` to update the preference at
runtime. Camera movement stays outside graph history.

Set `pinchZoom: true` on the FoldKit view for two-finger touch navigation.
Move both fingers together to pan or change their distance to zoom around
the midpoint. A second touch cancels an active graph drag. Lifting a finger
ends navigation without starting another edit. Pinch and pan stay outside
graph undo and are available in read-only views.

Set `viewportControls: true` and `selectionModeControl: true` to show the
**Box select** toggle. While it is active, dragging the background draws a
selection box with touch or a mouse. Toggle it off to resume background pan.
Two-finger navigation and Shift-drag still work. The mode is editor session
state and can also be set initially with `selectionMode` or toggled by sending
`SelectionModeToggled`.

The editor's clipboard lives in session state. Copy includes selected groups,
their descendants, and connections with both endpoints in the selection.
Pasted nodes get new IDs, retain their internal hierarchy, and are offset
from the originals. If a copied node's parent was outside the selection,
its copy becomes a top-level node. Paste and Duplicate are single undo steps.

Set `contextActions: true` on the FoldKit view to open actions with a
right-click on a node or edge. Use Shift+F10 or the context menu key on a
focused node title or connection. Nodes offer Duplicate and Delete, and edges
offer Delete. Escape dismisses the panel.

The same option adds More actions buttons on nodes and beside entries in
the Connections list for touch and keyboard access.

Set a child's `extent: 'parent'` to constrain pointer drags and keyboard nudges
to its parent's authored bounds. The child keeps its parent on drag-out.
A selection moves by one common clamped offset. Moving the parent still moves
its descendants. Nodes larger than the parent are held on the oversized axis.
Sizing and content measurement are independent of this movement constraint.
The optional field is preserved by graph export and import.

Set a child's `expandParent: true` to grow its parent when an authored width
change or measured content height exceeds the group bounds. Growth adds
16 units of padding on overflowing sides and preserves canvas positions.
Enable expansion on an inner group to propagate growth to its own parent.
Pointer resizing and parent growth share one undo step. Smaller content
keeps the group's grown bounds.

Send `GroupFitClicked` with a group ID to fit its authored boundary to all
descendants. The group context panel exposes **Fit group to contents**.
Fitting preserves child positions, reserves header space and padding, and
commits one undo step. Empty groups keep their bounds. A constrained group
requires enough space in its parent or enabled parent expansion.

### Per-node resize limits

Set optional `resizeLimits` on a node to customize manual resizing in graph units:

```ts
resizeLimits: { minWidth: 180, maxWidth: 520, minHeight: 120, maxHeight: 400 }
```

Each supplied limit must be finite and positive; a minimum cannot exceed its
maximum. Partial limits are supported and survive save/load, clipboard and Undo.
Cards apply width limits to pointer handles and `NodeWidthChanged`; card height
continues to follow content. Groups apply both axes through pointer handles,
`GroupResizeNudged` and width edits. When proportions are unlocked, only edited axes change. Group contents and
parent containment can prevent a resize when there is no valid size. Existing
nodes may start outside their limits; their next manual edit clamps the edited
axis. Layout, Fit group to contents, measurements and ancestor expansion remain
independent of manual resize limits. Omitting the field preserves default ranges.

### Lock group proportions

Set `keepAspectRatio: true` on a group, or dispatch `GroupAspectRatioToggled` with
its `id`. The package context panel offers **Lock proportions**; the sample also
shows it beside Fit group to contents. The toggle is saved, copied and undoable.
Cards cannot declare this field because their height follows content.

Manual pointer, keyboard and width edits then scale both dimensions together
from the group's current proportions, keeping children fixed. Corner handles anchor
the opposite corner; side handles anchor the opposite edge and preserve the
perpendicular center. Corner resizing follows the larger proportional axis change. The
scale is bounded by both dimensions' resize limits, contents and parent extent;
conflicting bounds leave the graph unchanged. Escape cancels a pointer drag,
and releasing commits once. Repeated edits at a bound do not add Undo entries.
Layout and explicit fitting can establish new proportions for the next resize.

Pointer `NodeResizeStarted` and keyboard `GroupResizeNudged` accept an optional
`handle`: `'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top' | 'right' | 'bottom' | 'left'`.
The existing `corner` field remains supported; `handle` takes precedence when both
are supplied. Omitting both preserves bottom-right behavior. `delta` follows the moving handle's canvas
direction: moving a left handle right shrinks width; moving a top handle down
shrinks height. Pointer positions remain surface CSS pixels, with zoom handled
by the reducer. Top handles reserve 48 units above contents for the group header;
other moving boundaries reserve 24. Existing tighter bounds are preserved.

Side handles ignore perpendicular pointer movement and keyboard arrows. With
proportions locked, the dragged axis drives both dimensions and the perpendicular
center stays fixed. Limits, content padding and parent bounds apply to the full
result, including the centered dimension. A conflicting intersection is a no-op.

### Background grids

`flowView` defaults to dots even when snapping is off. Built-in backgrounds accept
positive finite `gap` (graph units) and `size` (dot radius or square line width),
plus a CSS `color`. An omitted gap follows `editor.gridSpacing` (default 20);
size defaults to 1. An explicit visual gap overrides spacing only for that backdrop. Use `{ type: 'none' }` for a plain canvas.

```ts
flowView(h, model.editor, {
  id: 'workflow',
  label: 'Workflow',
  onEvent: (message) => Message.ObservedFlowInput({ message }),
  background: { type: 'squares', gap: 20, size: 1, color: 'var(--grid-color)' },
});
```

For a custom layout, use `{ type: 'custom', render }`. The callback receives
`{ id, viewport, surface, spacing }` and the host's typed `HtmlBuilder`. `surface`
can be `null` before measurement. Return ordinary FoldKit HTML/SVG; keep it
decorative. Flow places it behind the graph in a non-interactive, aria-hidden
screen-space layer. Apply the supplied viewport when drawing canvas-space grids.
No browser mutation, effects, or second UI runtime is needed.

```ts
background: {
  type: 'custom',
  render: ({ viewport, spacing }, builder) => builder.div([
    builder.Style({
      position: 'absolute', inset: '0',
      'background-image': 'radial-gradient(circle, #64748b 1px, transparent 1px)',
      'background-size': `${spacing * viewport.zoom}px ${spacing * viewport.zoom}px`,
      'background-position': `${viewport.x - spacing * viewport.zoom / 2}px ${viewport.y - spacing * viewport.zoom / 2}px`,
    }),
  ], []),
}
```

`FlowBackground<Message>` and `FlowBackgroundRenderContext` are exported from
`@opsydyn/foldkit-flow/foldkit`. Background selection belongs to the host Model;
it never changes the graph or Undo history. The sample demonstrates dots,
squares, a composed custom graph-paper renderer, and no grid.

### Shared grid spacing

Initialize `createEditor(graph, { gridSpacing: 32, snapToGrid: true })`, or dispatch
`{ type: 'GridSpacingChanged', spacing: 32 }`. Spacing must be finite and positive;
fractional units are supported. Invalid initialization throws; invalid, redundant,
read-only or active-gesture changes are ignored. Changing spacing does not move
nodes, change revision or add an Undo step. Undo/Redo retain the current preference.

Node drag snapping, group boundary snapping, resize keyboard steps, default dots
and squares, and custom renderer `context.spacing` share the setting. Resize keys
move one interval, or four with Shift, while snapping is enabled. Duplicate/paste
placement offsets use two grid intervals. Explicit background `gap` remains an
independent visual override. Grid spacing is editor session state, excluded from
graph JSON; hosts can persist preferences separately. The sample retains it when
switching examples and loading/importing diagrams.

### Resize alignment guides

Enable `snapToAlignment` (the sample's **Snap to nodes**) for magnetic group
resizing. Pointer drags align moving edges to nearby visible card edges and
collapsed group edges within six screen pixels. Expanded boundaries and the
resized group's descendants are excluded. Corner handles can align both axes;
side handles align their moving axis. Keyboard sizing keeps its existing steps.

Alignment overrides the grid only on a matching axis. With locked proportions,
the closest matched edge drives uniform scaling. Content, parent and size limits
remain authoritative: a guide is shown only if the resulting edge reaches its
target. Guides live in the resize gesture, clear when leaving the target, and
vanish on release or Escape. A completed resize remains one Undo step. The
FoldKit renderer draws them using the existing `--flow-alignment-guide` token.

Use `renderAlignmentGuide(context, h)` to replace the decorative SVG for
either drag or resize guides. The context provides the resolved guide,
`start` and `end` in graph coordinates, the gesture phase, and the viewport.
Use the supplied endpoints so the decoration follows the snap result.

```ts
renderAlignmentGuide: ({ start, end }, h) =>
  h.line([
    h.X1(String(start.x)), h.Y1(String(start.y)),
    h.X2(String(end.x)), h.Y2(String(end.y)),
    h.Stroke('#0f766e'), h.StrokeWidth('2'),
    h.Style({ 'vector-effect': 'non-scaling-stroke' }),
  ], []),
```

Return `undefined` for the default dashed guide or `null` to omit it.
Flow calls the hook only for resolved guides when the effective
`alignmentGuides` diagnostic is enabled. Guide visibility is independent
of snapping.

### Lock node movement

Pass `canMoveNode(node, graph)` in `EditorPolicy` to allow or block dragging
and keyboard nudging. Return `null` to allow a node to move, or a reason to
block it. A move checks the entire selection, including descendants of groups.
One locked node blocks the whole move. A drag uses the graph as it was at the
start of the gesture and checks the policy again before committing. Pass the
same callback to `flowView` to expose the lock on node handles. Custom shells
receive `moveDisabledReason` and can still use `flowDragHandle` for selection.

### Lock node dimensions

Pass `canResizeNode(node, graph)` in `EditorPolicy` to restrict explicit
resizing. Return a reason to block an edit or `null` to allow it. The policy
covers pointer resizing, keyboard resize steps, direct dimension edits, and
Fit group to contents. If an edit would also grow an ancestor with locked
dimensions, Flow rejects the whole edit.

Pass the same callback to `flowView` to hide locked resize handles and
disable group dimension controls. Custom node shells receive
`resizeDisabledReason`. Movement permissions apply separately.

### Control which items can be selected

Pass `canSelectNode(node, graph)` or `canSelectEdge(edge, graph)` in
`EditorPolicy`. Return `null` to allow selection or a reason to exclude
the item. Flow checks direct selection and interactions that select an item,
such as opening its context menu. An excluded group can still contain
individually selectable nodes.

Pass the same callbacks to `flowView` so selection controls and the marquee
preview agree with the reducer. Excluded items remain visible. Custom node
shells, connection rows, and edge labels receive `selectionDisabledReason`.
These callbacks govern new selection attempts. To clear a selection after
changing the policy, send `SelectionCleared`.

### Fit the selection

Set `fitSelectionControl: true` with `viewportControls: true` to show
**Fit selection**. Custom viewport controls can render
`context.actions.fitSelection` with `flowViewportControl`. The action
emits `{ type: 'FitSelectionClicked' }`.

Fit selection frames selected visible nodes and connections together.
For edges, it uses the displayed endpoint bounds and any stored route
used by the built-in path. A collapsed endpoint uses its group boundary.
The camera follows the configured padding, zoom limits, and Fit view
animation, including reduced motion. Selection and undo history are
preserved. Custom SVG geometry can extend outside the fitted bounds.

### Zoom to an area

Set `zoomAreaControl: true` with `viewportControls: true` to show **Zoom to
area**. Custom viewport controls can use `context.actions.zoomArea` with
`flowViewportControl`. The action emits `ZoomAreaModeToggled`. The next
background drag fits its rectangle and returns to the previous canvas mode.
Each side must span at least 5 CSS pixels. Escape on the canvas or the
pressed control cancels.

The fit uses the configured padding, zoom limits, animation, and reduced
motion behavior. It works in read-only views and preserves selection and
undo history. Use `renderZoomAreaMarquee(context, h)` to paint the preview
inside Flow's pointer-inert frame. The context provides normalized world
bounds and the viewport. Return `undefined` for the default or `null` to
hide the decoration.

### Back to previous view

Set `previousViewControl: true` with `viewportControls: true` to show
**Back to previous view**. Custom controls can use
`context.actions.previousView` with `flowViewportControl`, or send
`{ type: 'PreviousViewClicked' }` directly.

Flow keeps one session checkpoint. Fit view, Fit selection, Zoom to area,
and node or connection reveal capture the camera before moving it.
Manual pan and zoom leave the checkpoint available. Back uses it once,
respects the current zoom limits and reduced-motion preference, and works
in read-only views. It preserves the current selection, group expansion,
graph, and undo history. Snapshots save the current camera only.

### Reveal a node

Send `{ type: 'NodeRevealRequested', id }` to center a node. Flow keeps the
current zoom when the node fits and zooms out as needed within the active
limits. It expands collapsed ancestors and uses the existing Fit view timing,
including reduced motion. Graph edits, selection, and history are separate
from this camera action.

Use `revealableNodes(state)` to populate a search or navigation control.
It includes nodes inside collapsed groups and filters explicitly hidden
nodes and descendants. Reveal requires a measured canvas and an idle
gesture, and works in read-only mode.

### Reveal a connection

Send `{ type: 'EdgeRevealRequested', id }` to frame both endpoint nodes
and the stored route when the edge uses it. Flow opens collapsed ancestors
of the endpoints, preserves selection and history, and uses the same zoom
and timing rules as node reveal. The frame uses authored endpoint bounds and
stored route points. Custom SVG path extensions can extend beyond that frame.

Use `revealableEdges(state)` for connection search. It includes edges inside
collapsed groups and excludes explicitly hidden edges or edges with hidden
endpoints.

### Save the camera with the graph

Call `serializeSnapshot({ graph, viewport })` to include pan and zoom in a
version 1 document. `parseSnapshot(text)` validates the graph and any camera
it contains. For graph-only documents, the returned snapshot omits
`viewport`. `serializeGraph` and `parseGraph` continue to read and write the
graph on its own.

```ts
const saved = serializeSnapshot(editor);
const { graph, viewport } = parseSnapshot(saved);
const reopened = createEditor(graph, viewport ? { viewport } : {});
```

Snapshots include the authored graph and optional camera. Selection, undo
history, routes, and active gestures are session state. The viewport must
have finite pan coordinates and a positive finite zoom. Hosts using custom
zoom limits can bound the saved zoom before initializing the editor.

### Retain built-in node views during camera updates

Pass one FoldKit `createLazy()` slot per canvas as `nodeViewCache`.
Keep `onEvent` and any `renderNode` callback stable to reuse the node and
port layer across camera-only renders. With viewport culling enabled, the
layer is reused while the mounted node set stays the same. Entering or leaving
the overscan area rebuilds the layer from the current graph. The slot holds
one layer per canvas. Graph edits, selection changes, and changes to the
other layer inputs also rebuild it.

The prototype uses the live path for custom node shells, node policies,
node filtering through visibility or group collapse, open context panels,
and editing gestures. The
retained context trigger resolves its anchor against the latest viewport
when activated.

### Cull canvas items outside the viewport

Set `viewportCulling: true` on `flowView` to mount canvas items near the
measured viewport. The default is off. Use `{ overscan: 96 }` to customize the
buffer in CSS pixels. Before the surface is measured, the whole canvas renders.

Focused and selected items stay mounted, along with active gesture items.
Built-in edge bounds include crossing edges and routes. Authored edge labels
and edges with custom geometry or drawing hooks stay mounted so their content
can extend beyond the default bounds. Custom node shells can choose more
overscan for content that extends outside their node frame. Offscreen shells
can remount as the camera moves, so keep their durable state in the Model.
The tab order includes mounted canvas controls.

Fit view, the minimap, the Connections list, world overlay inputs, and graph
operations still use the full visible graph.

### Hide nodes and edges

Use `createEditor(graph, { visibility })` for initial visibility and send
`VisibilityChanged` to replace it during the session. Omit either list to
show those items again.

```ts
const next = updateEditor(state, {
  type: 'VisibilityChanged',
  visibility: { hiddenNodeIds: ['review'], hiddenEdgeIds: ['optional-link'] },
});
```

Hiding a node hides its incident edges. Hiding a group also hides its
descendants. Collapsed groups still project edges between visible boundaries.
The canvas, minimap, Connections list, Fit view, and marquee use the same
visible items. Changing visibility clears hidden selections and cancels
in-progress gestures. The underlying graph, exports, and Undo history retain
the authored items. Use editor policies to restrict edits to graph data.

### Protect nodes and edges from deletion

Pass a pure `canDelete` callback in `EditorPolicy` to `updateEditor`. It
receives the nodes and edges that would be removed, including selected
groups' descendants and incident edges, and the original graph. Return a
reason to reject the entire deletion or `null` to accept it. A rejection
sets the editor notice and preserves the graph, revision, and Undo/Redo
history. Accepted deletions use the existing transaction boundary.

```ts
const canDelete: NonNullable<EditorPolicy['canDelete']> = ({ nodes, edges }) =>
  nodes.some((node) => node.id === 'required-step') ||
  edges.some((edge) => edge.id === 'required-link')
    ? 'This workflow step or connection is required.'
    : null;

const next = updateEditor(state, event, { canDelete });
const view = flowView(h, next, { id: 'workflow', label: 'Workflow', onEvent, canDelete });
```

Pass the same callback to `flowView` for disabled Delete actions and their
reason in the built-in context panels and edge toolbar. Custom controls can
read `disabledReason` from the action descriptors or call `resolveDeletion`
with their own targets. The policy may run during rendering and again when
the editor handles a deletion, so keep it synchronous and pure. The host
decides how to identify required items.

### Box selection matching

Full containment is the default. To include cards that overlap only part of
the marquee, initialize the editor with `boxSelectionMatch: 'partial'` or
send `{ type: 'BoxSelectionMatchChanged', match: 'partial' }` while idle.
The setting applies to both Shift-drag and Box select. It belongs to the
editor session and is separate from the saved graph and Undo history.

Partial matching requires positive-area overlap. Touching an edge or
drawing a zero-area rectangle selects no items by overlap. Expanded group
frames still require full containment, so a marquee inside a group can
select its children independently. Collapsed groups match using their
visible bounds, and hidden descendants stay excluded. Selection is applied
on release.

### Live box-selection preview

While drawing a marquee, Flow highlights the nodes that would be selected
on release. The preview uses the same match rule, collapsed-group
projection, and ancestor selection as the final selection. Pressed states
and selection actions continue to reflect the committed selection until
release. Escape clears the preview and keeps the prior selection.

Custom node and group shells receive `selectionPreview` for their own
highlight styling. Set `selectionPreviewHighlights: false` to disable node
highlights. The marquee hook still receives `previewNodeIds` so a host can
show its own feedback. Preview remains available in minimal mode.

### Custom box-selection marquee

Use `renderSelectionMarquee(context, h)` to replace the decoration during
a box-selection gesture. The context contains normalized `bounds` in graph
coordinates, the current `viewport`, the matching rule, and `previewNodeIds`. Flow positions and sizes the frame
using the same bounds as selection on release. Use decorative content that
fills the frame.

```ts
renderSelectionMarquee: (_, h) =>
  h.div([h.Style({
    position: 'absolute',
    inset: '0',
    border: '2px dashed #0f766e',
    background: 'rgb(20 184 166 / 0.15)',
  })], []),
```

Return `undefined` for the default outline or `null` to omit the decoration.
The frame ignores pointer input and stays available during selection in
minimal mode.

### Live resize dimensions

The FoldKit view shows a width × height readout in the canvas's lower-left corner
during pointer resizing. With `resizeHandles: true`, it also stays visible for a
single selected, expanded group so keyboard resizing has the same feedback.
Card readouts are transient. Read-only views and collapsed/hidden groups omit it.
Set `resizeReadout: false` to disable the readout. To replace its appearance,
use `renderResizeReadout(context, h)` with the host's typed FoldKit builder.

```ts
renderResizeReadout: ({ node, widthText, heightText }, h) =>
  h.div([h.Class('dimensions')], [
    node.label + ' · Width ' + widthText + ' · Height ' + heightText,
  ]),
```

The renderer receives the node with raw Model dimensions, the formatted
values, and the `resizing` or `selected-group` phase. Flow keeps placement
and the polite status region. Return `undefined` for the default badge or
`null` to omit an eligible readout. The renderer runs only when the effective
`measurements` diagnostic and the readout option allow it.

Values come from the current Model in graph units, including snapping, limits,
locked proportions and measured card height. Up to two decimal places are shown;
this never rounds authored geometry. The badge stays the same screen size while
zooming, ignores pointer input, and uses a native polite status region. Releasing
keeps a selected group's result visible; Escape restores its original dimensions.
Selection clearing hides it. Theme it with `--flow-resize-readout-background` and
`--flow-resize-readout-color`, alongside existing node border/color tokens.

### Numeric group dimensions

With `contextActions: true`, open a group's **More actions** panel to edit Width
and Height in graph units. Each field applies on native change (for example,
leaving the field), creating one Undo step. The panel stays open for sequential
edits and displays the resulting dimensions after grid snapping, size/content
limits, parent containment or expansion, and locked proportions. Controls are
disabled for collapsed groups and unavailable in read-only views. Escape closes
the panel; changes already applied remain undoable.

Hosts can dispatch `{ type: 'GroupDimensionChanged', id, dimension: 'height',
value: 320 }` (or `dimension: 'width'`). Numeric edits anchor the group's top-left
corner and keep child positions fixed. With proportions locked, changing either
dimension also scales the other. Invalid/non-positive values and active-gesture
edits are ignored; repeated clamped values add no history. `NodeWidthChanged`
continues to support group width through the same geometry path. The fields trim
floating-point display noise without rounding authored geometry.

### Custom canvas help and status

Use `renderCanvasHelp` for instructions and `renderCanvasStatus` for notices
or a diagram summary. Both receive `defaultText` and the effective
`visible` flag. Help also includes the selection mode, toolbar availability,
and read-only state. Status includes the current notice and visible node
and connection counts.

```ts
renderCanvasHelp: ({ defaultText }, h) =>
  h.div([h.Class('canvas-help-card')], [
    h.strong([], ['Canvas controls']),
    h.p([], [defaultText]),
  ]),
renderCanvasStatus: ({ defaultText }, h) =>
  h.span([h.Class('canvas-status-badge')], [defaultText]),
```

Flow keeps the description ID referenced by the canvas and node controls,
and updates status inside the existing polite live region. Diagnostics
visually hide these containers while preserving their accessible content.
Keep meaningful text in both renderers, including when `visible` is false.
Return `undefined` to use the default copy.

### Diagnostics and minimal mode

Use `minimalMode: true` for a clean package view, or `diagnostics: false` to
suppress all diagnostic presentation. Both override individual flags. Defaults
preserve existing presentation. Configure individual diagnostics with:

```ts
flowView(h, model.editor, {
  id: 'workflow',
  label: 'Workflow',
  onEvent: (message) => Message.ObservedFlowInput({ message }),
  minimalMode: model.minimalMode,
  diagnostics: {
    measurements: false, // size readout, numeric group inputs and numeric resize tips
    alignmentGuides: false, // visual lines; snapping remains active
    zoomLevel: false, // percentage; zoom controls remain usable
    status: false, // visually hide notices/counts, retain polite announcements
    instructions: false, // visually hide help, retain accessible descriptions
    overview: false, // hide an enabled minimap
    connectionList: false, // replace the verbose list with a compact Connections disclosure
  },
});
```

Connection actions remain keyboard-accessible through the compact disclosure.
Its `ConnectionListToggled` fact updates editor session state without changing
graph geometry, revision or Undo history; it also works in read-only views.
Opening it is an explicit inspection action. Full lists keep their existing
presentation. Graph labels, ports, selection/resize handles, background styles
and editing controls are not diagnostics and retain their own options.

`resolveFlowDiagnostics(options)` and the `FlowDiagnostics` /
`FlowDiagnosticOptions` types are exported from `/foldkit`. Use the resolver in
custom node renderers or host chrome to apply the same effective flags; the
package cannot identify diagnostics in arbitrary consumer content. The existing
`resizeReadout: false` option still independently hides just the size badge.
These are view preferences, not graph document fields. Minimal mode never turns
off snapping, constraints or other editing behavior. The workbench demonstrates
global and individual toggles, retains stored flag choices, and hides its own
inline controls without changing node footprints.

### Design freedom and public composition

With `viewportControls: true`, supply `renderViewportControls` to lay out or
omit any action. The context contains `actions`, `diagnostics`,
`selectionModeControl`, and the current `state`. Use `flowViewportControl` for
native button semantics, or map an action's `event`, `disabled`, and `pressed`
fields into your own component. The action `label` supplies the accessible name
and can be translated or changed to match your visible text.

```ts
renderViewportControls: ({ actions }, h) =>
  h.nav([h.AriaLabel('Diagram navigation')], [
    flowViewportControl(h, { ...actions.fitView, label: 'Frame graph' }, onEvent,
      [h.Class('frame-action')], ['Frame graph']),
  ]),
```

With `minimap: true`, `renderMinimap` receives visible nodes in paint order and
world bounds from the current Model, including collapsed groups. Compose
`flowMinimap(h, context, onEvent, frameAttributes, svgChildren)` inside the Flow
surface for pointer input. Its inner SVG stretches to fit the frame and maps
clicks using the area inside the border and padding. Draw node marks in world
coordinates, and add `flowMinimapViewport(h, context.geometry, svgAttributes)`
when you want a camera outline. You can also draw your own outline from
`geometry.visible`, or leave it out. Arrow keys pan the camera (Shift takes
larger steps), Home fits, and Enter or Space centers the overview.

Return `undefined` from either hook to use the shipped design. Existing feature
flags still control whether hooks are called. Minimal mode and the `overview`
diagnostic hide the minimap, while zoom and fit remain available. Navigation
works in read-only mode and leaves graph history unchanged.

### Design freedom and public composition

Freedom and control apply to the engineering API as well as end-user preferences.
The target is supported composition of complete presentation parts, with stable
interaction primitives and a headless behavior core. Consumers should not need
private DOM bindings, package forks or CSS specificity overrides to implement a
design. Presentation and geometry responsibilities must remain explicit.

The optional `/foldkit` entry now exposes `renderNodeShell(context, h)` and
`renderGroupShell(context, h)` alongside the existing content-only `renderNode`.
Return `undefined` from a shell hook to use the default for that node. A full shell
owns its contents; the content-only callback is used only by the default card.

```ts
import {
  flowView,
  flowNodeFrame,
  flowGroupFrame,
  flowDragHandle,
  flowPort,
} from '@opsydyn/foldkit-flow/foldkit';

flowView(h, model.editor, {
  id: 'diagram',
  label: 'Architecture',
  onEvent: (message) => Message.ObservedFlowInput({ message }),
  renderNodeShell: (context, builder) =>
    flowNodeFrame(
      builder,
      context,
      [builder.Class('my-node'), builder.Style({ padding: '16px', background: '#fff' })],
      [
        flowDragHandle(builder, context, [], [context.node.label]),
        ...context.node.ports.map((port) =>
          flowPort(builder, context, port, [builder.Class('my-port')], ['●']),
        ),
        ...context.resizeHandles,
      ],
    ),
  renderGroupShell: (context, builder) =>
    flowGroupFrame(
      builder,
      context,
      [builder.Class('my-boundary')],
      [
        flowDragHandle(builder, context, [], [context.node.label]),
        ...(context.collapseToggle ? [context.collapseToggle] : []),
        ...context.resizeHandles,
      ],
    ),
});
```

Use your host's normal event wrapper for `onEvent`. Every primitive accepts the
host builder, Model-derived context, normal builder attributes and children.
There are no default visual styles in the primitives. Classes and `h.Style` can
own borders, shape, typography, padding, icons and colors directly. The bundled
cards/groups use these same primitives.

- `flowNodeFrame`: one measured HTML frame per ordinary node. Model owns its
  position and width; content controls height, reported through `NodeMeasured`.
- `flowGroupFrame`: one boundary per group, with both dimensions from Model.
  Empty boundary space passes pointer events through to its descendants.
- `flowDragHandle`: a native button carrying selection, movement, focus and drag
  behavior, with its node name and help description.
- `flowPort`: a native connection button, centered on the Model's authored anchor
  independent of its visual size. Keep ports as direct children of the frame.
- `flowResizeHandle(builder, context, handle, attributes, children)`: a native
  resize button. Groups support eight directions; ordinary nodes use width-only
  resizing (`right`). Arrow keys resize groups; Left/Right resize ordinary nodes.
  Shift increases the step. Grid snapping, limits, read-only policy and Undo use
  the same core path as the bundled view.

The context includes `node`, `state`, resolved `diagnostics`, `collapsed` and
`dropTarget`. It also supplies optional `contextAction`, `collapseToggle` and
`resizeHandles` from enabled default controls. Place or omit them freely, or use
native host controls with public editor events. Omit nested interactive controls
inside drag buttons. Consumers never need to copy private input attributes.

**Geometry contract:** frame position, width, group height, box sizing and input
markers belong to the primitives. Port position and transform belong to its Model
anchor. The primitives merge style attributes and apply those geometry properties
last. Keep frames at the supplied world coordinate level; avoid CSS transforms,
margins, size constraints or ancestor positioning that would move/scale the frame
away from Model geometry. Visual node height may intentionally change with
content or a shell switch; Flow remeasures it and rebases history. Fixed group
bounds do not auto-fit to new content; use `GroupFitClicked` when desired.

The sample's **Node design** selector switches between the default cards and
complete circular SVG shells, including different group chrome, ports and resize
controls. Both use the same graph and package input lifecycle. The SVG artwork is
inside a measured HTML frame; native buttons retain keyboard behavior.

`renderEdge` decorates the shared resolved path; the geometry policy below
changes that path and its label anchor together. Follow-on boundaries are recorded in
[ADR 0004](https://github.com/opsydyn/fold-kit-experiments/blob/main/docs/adr/0004-composable-flow-presentation.md).

### Shared custom edge geometry

Use `FlowEdgeGeometryPolicy` and `resolveEdgeGeometry` from the dependency-free
root entry, or pass a policy as `flowView`'s `edgeGeometry` option. The optional
FoldKit entry also re-exports the policy/context/result types.

```ts
import type { FlowEdgeGeometryPolicy } from '@opsydyn/foldkit-flow';

const raisedArc: FlowEdgeGeometryPolicy = ({ source, target, edge, route }) => {
  // Preserve authored styles and layout routing in this example.
  if (edge.pathStyle !== undefined || route) return undefined;
  const control = { x: (source.x + target.x) / 2, y: Math.min(source.y, target.y) - 100 };
  return {
    path: `M${source.x},${source.y} Q${control.x},${control.y} ${target.x},${target.y}`,
    labelPosition: {
      x: (source.x + 2 * control.x + target.x) / 4,
      y: (source.y + 2 * control.y + target.y) / 4,
    },
  };
};

// Include these options alongside your normal id, label and onEvent options:
// edgeGeometry: raisedArc,
// edgeAppearance: (edge) => ({ hitWidth: 18 }),
```

The policy context contains `graph`, `edge`, `source`, `target`, `route`,
`sourceGroup`, `targetGroup` and `defaultGeometry`. Coordinates are world units.
Endpoints already account for collapsed groups. The default geometry already
resolves authored path styles and layout routing. An accepted custom result takes
precedence; returning `undefined` preserves the default. A pure headless consumer
uses `resolveEdgeGeometry(graph, edge, { policy, route, sourceGroup, targetGroup })`.
The original `edgePath` helper continues to return built-in geometry.

One resolved `path` feeds SVG decoration and selection. Its `labelPosition` feeds
on-canvas labels, label editing and toolbar placement. Set `labelPosition` to
`undefined` to omit those anchored parts. Connection-list selection and actions
remain available. `renderEdge` receives this same resolved path/anchor and remains
a decorative callback. Draw along `context.path` to retain interaction agreement.

The public `flowEdgeHitTarget(builder, { edge, path, hitWidth }, attributes?)`
primitive encapsulates SVG selection bindings for composed presentations.
`flowView` uses it for both default and custom decoration, with a transparent
12-unit selection corridor. `edgeAppearance.hitWidth` controls that width per
edge. It must be positive and finite. Native connection-list controls continue
to provide keyboard selection; reconnection handles stay anchored to ports.

Policies must be pure, keep their path endpoints at the supplied canonical
anchors, and choose their label anchor deliberately. The package rejects empty
paths and non-finite label coordinates with `FlowError`; it does not validate SVG
syntax or infer label positions by reading the DOM. Keep path geometry out of CSS
transforms/overrides and out of `renderEdge` if it differs from the resolved path.
No policy functions are stored in Model or serialized documents.

The sample's **Edge design** selector demonstrates raised arcs in both node
presentations. Obstacle avoidance and custom-route bounds for Fit view remain
outside this contract. Connection-drag previews use the contract below.

## Generated API reference

```sh
bun run --filter @opsydyn/foldkit-flow docs
# Open packages/foldkit-flow/docs/index.html through a local static server.
```

The TypeDoc reference covers the public core and FoldKit entry points, optional
ELK and force adapters, and the lightweight force eligibility subpath. Signatures,
fields, unions and source links come from TypeScript exports. Its landing page
explains Model ownership, composition and package boundaries.

The Pages workflow builds the [Flow API reference](https://opsydyn.github.io/fold-kit-experiments/flow/api/).
That route becomes available when the updated workflow reaches Pages; generating
it locally does not publish the site or npm packages.

### Connection-drag previews

`resolveConnectionPreview(state, geometryPolicy?)` is a pure core helper. It
returns no preview for idle state, keyboard-only port selection or read-only
views. An active preview contains logical output-to-input `source`/`target`
points in world units, the actual world `pointer`, nullable endpoint identities,
`movingEnd`, projected `sourceGroup`/`targetGroup`, and the existing `edge` when
reconnecting. New incomplete connections have no synthetic edge or fake port ID.

`FlowConnectionFeedback` is a union: `free`, `valid` with an accepted endpoint,
or `invalid` with a rejected endpoint and reason. Feedback comes from the same
core validation used on drop, including direction, duplicate and host-policy
checks. `Gesture.target` remains the accepted endpoint or null. Its optional
`rejected` details are mutually exclusive with an accepted target.

The view exposes two independent hooks:

```ts
import type {
  FlowConnectionGeometryPolicy,
  FlowEdgeGeometryPolicy,
  Point,
} from '@opsydyn/foldkit-flow';

// Share one pure curve function across both policy contexts.
const curve = ({ source, target }: { source: Point; target: Point }) => ({
  path: `M${source.x},${source.y} Q${source.x},${target.y} ${target.x},${target.y}`,
  labelPosition: undefined,
});
const edgeGeometry: FlowEdgeGeometryPolicy = curve;
const connectionGeometry: FlowConnectionGeometryPolicy = curve;

// flowView options alongside the host's normal id, label and onEvent:
// edgeGeometry,
// connectionGeometry,
// renderConnection: (context, builder) => builder.path([
//   builder.D(context.path), builder.Fill('none'),
//   builder.Stroke(context.stroke), builder.StrokeWidth('5'),
// ], []),
```

`connectionGeometry` returns the same geometry result shape as the finished-edge
policy, or `undefined` for built-in geometry. Defaults are straight for new
connections and follow authored path style during reconnection. Valid and
rejected hovered ports use their canonical anchors; free space uses the cursor.
Source reconnection keeps the logical output at the path start.

`renderConnection` receives that geometry and core feedback plus default `stroke`,
`strokeWidth` and `dashArray`. It owns decorative SVG through the host builder;
return `undefined` for the default dashed wire, or empty SVG to omit the visual
without disabling the interaction. The package owns pointer capture and the
pointer-inert, hidden-from-assistive-technology preview layer. Preview SVG must
stay decorative. Existing native port buttons retain keyboard operation.

Default colors use `--flow-selection`, `--flow-valid-target` and
`--flow-invalid-target`. Rejection reasons also reach the existing live status.
Gesture data stays in Model; geometry is derived and callbacks remain host view
configuration. Preview functions and styles are not serialized.
The sample combines **Edge design** with **Connection preview** choices for
dashed, ribbon and hidden presentation in both card and SVG node designs.

### Custom port anchors

Ports support two mutually exclusive positions. Existing documents keep their
cardinal side/offset form. Custom anchors use normalized coordinates in the node
box; both fractions must be finite and between 0 and 1:

```ts
import type { Port } from '@opsydyn/foldkit-flow';

const cardinal: Port = { id: 'out', kind: 'output', side: 'right', offset: 0.5 };
const diagonal: Port = {
  id: 'out',
  kind: 'output',
  side: 'right',
  anchor: { x: 0.84, y: 0.16 },
};
```

`side` is the outward routing/reconnection hint for either form. It does not move
an explicit anchor. Do not provide both `offset` and `anchor`. `PortPosition`
models that choice; `PortSide` names its direction. Use `portAnchor(port)` for
normalized coordinates, `portPosition(node, id)` for the canonical world point,
and `portBoundaryPosition(node, id)` for its projection onto the hinted box side.

The same authored point drives public port presentation, edge geometry, previews
and snapping to targets. Coordinates rescale with authored width and measured
height. Frame primitives separate a border-free coordinate plane from the visual
shell: frame attributes/classes/styles decorate that measured static shell, so
borders and padding do not shift port centers. Keep ports as direct logical frame
children and avoid positioned/transformed wrappers between them and the frame.
Do not style private geometry elements. The existing restrictions against moving
frames with CSS transforms or margins still apply.

Change one or many positions atomically through the core:

```ts
const next = updateEditor(state, {
  type: 'PortPositionsChanged',
  positions: [
    {
      endpoint: { node: 'review', port: 'out' },
      position: { side: 'right', anchor: { x: 0.84, y: 0.16 } },
    },
  ],
});
```

Edits retain IDs, directions, labels and edge metadata. The batch validates before
publication, detaches anchor coordinates, advances revision, clears cached routes
and creates one Undo step. Duplicate/unknown endpoints and malformed positions
are rejected. No-op batches leave history unchanged. Read-only and active-gesture
protection use the normal core path.

ELK receives fixed boundary projections and rejoins its routes to the exact
anchors. Force routing extends its leads beyond the hinted node boundary before
avoiding other cards. Reconnection controls use the same boundary hints so they
remain reachable outside opaque node shells. Adapter routes may traverse their
own endpoint node; custom-shape clipping/obstacle geometry is not inferred.

`serializeGraph` preserves anchors in version 1 documents; legacy side/offset
documents remain readable. Builds predating anchor support may reject custom
anchor documents. Outside-box anchors and arbitrary routing normals are not
supported in this slice. The sample's **Port anchors** selector demonstrates
cardinal and diagonal circle-perimeter positions; it derives its value from the
document so Undo, Redo and imports stay consistent.
