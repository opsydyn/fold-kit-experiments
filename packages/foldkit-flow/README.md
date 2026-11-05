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
- Scroll over the surface to zoom around the pointer (0.1–4). The surface owns touch
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

Set an edge's optional `pathStyle` to `straight`, `stepped`, or `smooth`.
These styles draw between the current ports and take precedence over layout
routes. `EdgePathStyleChanged` saves the style in one undo step. Pass
`pathStyle: null` in that event to restore automatic routing. Automatic uses the
layout route when available and a straight line otherwise.

Enable `edgeToolbar: true` to show Rename, path style, and Delete edge
controls beside a single selected edge. In the Connections list, activate an
edge and press Up Arrow to focus its actions. The toolbar uses native controls
and stays the same size as the canvas zooms. Deleting from the toolbar removes
only that edge and can be undone.

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

Select an edge to expose its endpoint handles. Drag either handle to a
compatible port to reconnect the edge. Escape or dropping elsewhere cancels.
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

### Live resize dimensions

The FoldKit view shows a width × height readout in the canvas's lower-left corner
during pointer resizing. With `resizeHandles: true`, it also stays visible for a
single selected, expanded group so keyboard resizing has the same feedback.
Card readouts are transient. Read-only views and collapsed/hidden groups omit it.
Set `resizeReadout: false` to disable the built-in readout for a custom UI.

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

Freedom and control apply to the engineering API as well as end-user preferences.
The target is supported composition of complete presentation parts, with stable
interaction primitives and a headless behavior core. Consumers should not need
private DOM bindings, package forks or CSS specificity overrides to implement a
design. Presentation and geometry responsibilities must remain explicit.

The current view does **not yet** provide that complete surface: `renderNode`
customizes contents inside a fixed shell, and `renderEdge` customizes decoration
while retaining Flow's hit area. Group shells, ports and several controls are
still fixed implementation. Diagnostics and theme tokens do not remove those
limits. The code-level audit and proposed composition slices are recorded in
[ADR 0004](https://github.com/opsydyn/fold-kit-experiments/blob/main/docs/adr/0004-composable-flow-presentation.md).
The proposed primitives/slots are not shipped APIs yet.
