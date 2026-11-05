# FoldKit Flow sample

Astro serves the page shell and hydrates a FoldKit editor island. The release
workflow starts with a draft, review and publish step. Connect Review to
Publish, arrange the graph with ELK, then save and reload the draft in your
browser. This sample edits a diagram of the workflow.

From the workspace root:

```sh
bun install --frozen-lockfile
bun run dev:flow-sample
```

Open http://localhost:4327. Use **Fit view** to see the whole workflow on a
narrow screen. To build and preview the static site:

```sh
bun run --filter @opsydyn/flow-sample build
bun run --filter @opsydyn/flow-sample preview
```

**Open Onion Architecture** replaces the editor graph with an editable example.
The UI adapter uses application use cases. The storage adapter implements an
interface owned by the application. Application code depends on the domain
model. The arrows represent source dependencies toward the core, following
[Jeffrey Palermo's original description](https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/).

Choosing **Arrange with ELK** lays out and fits the
diagram. Canvases narrower than 600 px use top-to-bottom layout. Save the
current diagram before opening another example if you want to keep your edits.

Each node has a **Width** slider. Select a connection below the canvas to
choose **Solid edge** or **Dashed edge**. Width and style participate in undo
and are included when you save a diagram.

Drag the handle at the lower right of a node to change its width live. Escape
cancels the drag. Releasing the handle records one undo step. The Width slider
also works with the keyboard.

Select an edge to change its source or target port. Reconnecting keeps the
edge's style and records one undo step.

A selected edge also shows two circular handles on the canvas. Drag either
handle to a compatible port, or use the source and target menus below the toolbar.

Open **Grouped Onion Architecture** and drag the Release system or Application
core title to move the boundary and its contents together. Choose **Arrange with ELK** to lay out the children, fit their boundaries and
route connections across them. Undo restores the prior arrangement.

Shift-click two or more node titles at the same level and choose **Group
selection** to wrap them in a boundary. Select a boundary and choose
**Ungroup** to remove it while keeping the contents and their connections.
Both actions can be undone.

You can also Shift-drag the canvas background around nodes, then choose
**Group selection**. A box selects fully enclosed nodes. Press Escape to
keep your previous selection.

The minimap in the lower-right corner shows the full diagram and the current
viewport. Click it to center the canvas on that point at the same zoom.

Use **Zoom in**, **Zoom out**, or **Fit view** above the canvas to navigate
without a scroll wheel. The percentage shows the current zoom.

Turn on **Snap to grid** to align nodes as you drag. The node you grab snaps
to the grid, and the other selected nodes keep their spacing. Dragging a group
also moves its contents.

**Export JSON** downloads a versioned diagram file. Choose a file under
**Import JSON** to replace the current diagram and fit it to the canvas.
Import accepts files up to 5 MiB. Invalid files leave the current diagram in
place. Export includes nodes, groups, edges and their data. Viewport, undo
history and browser settings are session state.

Use **Copy**, **Paste**, and **Duplicate** in the toolbar or Ctrl/Cmd+C, V,
and D from the canvas. Copied groups retain their contents and internal
connections. The workbench clipboard is available when switching diagrams
in the same session. Use JSON export to share an entire diagram.

In the grouped Onion Architecture example, drag a node title over an expanded
group. The highlighted boundary becomes its new parent when you drop. Drag out
of that boundary to move the node to the enclosing group or canvas root.
Undo restores the previous position and membership together.

**Snap to nodes** shows a guide when the dragged selection aligns with the
edge or center of a nearby node. You can combine it with **Snap to grid**.

Hold a node or connection near a canvas edge while dragging to pan toward
off-screen targets. Release or press Escape to stop.

On a touchscreen, move two fingers together to pan or pinch to zoom.
A second finger cancels an in-progress node or connection drag.

Turn on **Box select** to draw a selection box with one finger. Turn it off
to pan with one finger again.

Right-click a node or connection for context actions. With a node title or
connection focused, use Shift+F10 or the context menu key.

Tap the ellipsis on a node or beside an entry in Connections to open
its actions without a mouse or keyboard.

Choose **Force layout** to arrange a flat graph with the `@opsydyn/foldkit-flow-force`
package, backed by FoldKit Viz simulation. It uses the measured card sizes for spacing and applies the
result as one undoable edit. The trial supports 1–100 nodes. Use
**Arrange with ELK** for nested graphs and routed edges.

Force layout tries right-angle routes for automatic edges and keeps authored
path styles. If its candidate routes are blocked, the edge uses its usual
automatic fallback.

Automatic force routes prefer corridors that avoid earlier edges. The routing
heuristic balances distance against nearby parallel segments and crossings.
Shared ports and constrained arrangements can still produce crossings.

In a grouped example, select a child and toggle **Keep inside parent** to
constrain its drag and keyboard movement. Toggle it off to allow drag-out.

Select a child in a grouped example and enable **Grow parent**, then widen
the child. Enable it on an inner group to propagate growth to the outer group.

Select a group and choose **Fit group to contents** to tighten its boundary.
The same action is available through the group's More actions button.

Select an expanded group and drag any corner resize handle to adjust its
boundary in both dimensions. Focus the handle and use arrow keys (Shift for a
larger step) for keyboard resizing. Contents stay fixed and Undo restores bounds.

Imported nodes can declare `resizeLimits` for manual width and group boundary
editing. Card width sliders show the imported limits; all enforcement lives in
the Flow package. Layout and measured card height remain content-driven.

Select a group and activate **Lock proportions** to scale its boundary uniformly.
The same action is in the package's group context panel. Pointer and keyboard
resizing preserve the current ratio within the available bounds; children stay
fixed. Toggling and resizing are separate Undo steps.

Selected expanded groups expose four corner handles and four side handles. Each has a directional
accessible label and supports arrow keys; the opposite corner and children stay
fixed. Top/left resizing moves the boundary origin without moving the contents.

Side handles resize one axis when unlocked. With **Lock proportions**, dragging a
side scales both dimensions around the perpendicular center. Arrow keys on a side
handle affect its axis only; Shift keeps the larger step. All geometry is owned
by the Flow package, including legacy corner-event compatibility.

Use **Background** to choose dots, squares, custom graph paper, or no grid.
Dots are the default. The custom example composes native FoldKit builder nodes
using the viewport and package grid spacing; it has no external rendering state.
Changing backgrounds leaves the diagram and Undo history intact. **Snap to grid**
is independent: group resize edges use the 20-unit grid, with constraints and
proportion locking taking precedence. Resize arrow keys step by 20 when snapping
is enabled, or 80 with Shift.
