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
is independent: group resize edges use the configured grid, with constraints and
proportion locking taking precedence. Resize arrow keys step by one grid interval when snapping
is enabled, or four with Shift.

**Grid spacing** sets a shared positive spacing in graph units (default 20).
Dots, squares, custom graph paper, snapped dragging and resize handles all follow
it. Changing spacing leaves authored geometry and Undo history intact. The choice
survives example changes, import, and loading a saved diagram during this session.

With **Snap to nodes** enabled, resize a group near visible card edges to align
its moving boundary and show a guide. Alignment overrides the grid on that axis;
constraints and proportion locking remain active. Guides clear on release or
Escape, and Undo restores the original boundary.

A live width × height readout appears at the canvas's lower-left corner during
resizing and while a single expanded group is selected. It shows actual graph
units after snapping and constraints, including keyboard edits. Escape restores
the original numbers; clearing selection hides the group readout. The package
owns this UI, and hosts can disable it with `resizeReadout: false`.

Open a group's **More actions** panel for numeric Width and Height controls.
Each field applies when its value changes, keeps the panel open, and contributes
one Undo step. The fields and size readout show the constrained result, including
snap spacing and locked proportions. Expand collapsed groups before editing.
These controls and the `GroupDimensionChanged` API are supplied by the package.

**Minimal mode** removes diagnostic clutter and reduces the workbench toolbar.
**Diagnostics** opens global and individual switches for measurements, guides,
zoom percentage, visible status, instructions, overview and the verbose connection
list. Minimal mode/global-off take precedence; re-enabling restores saved choices.
Inline controls are visually hidden with their layout space retained, preserving
the current diagram. Compact Connections keeps keyboard access to edge actions.
The package exports `minimalMode`, `diagnostics` and `resolveFlowDiagnostics` for
other hosts; the workbench only owns its presentation preferences.

### Node/group presentation composition

Use **Node design** to switch between the bundled cards and complete SVG orbit
shells. The example in `src/editor/presentation.ts` uses the public frame, drag,
port and resize primitives. Group chrome uses host buttons and typed editor events.
It shares the package's measurements, input lifecycle, grouping and history.
The selector lives in the sample; all interaction primitives ship in
`@opsydyn/foldkit-flow/foldkit`.

See [composition qualification](evidence/composition.md) for browser evidence and
current geometry limits.

Use **Edge design** to compare default routing with raised arcs. The sample's
pure geometry policy preserves explicit path styles and ELK routes. Path drawing,
selection and label editing use the package's shared geometry result. See
[edge geometry qualification](evidence/edge-geometry.md).

The **Connection preview** selector offers dashed, ribbon and hidden visuals.
Raised-arc previews reuse the finished-edge curve function. Core validation drives
free/valid/rejected feedback, including duplicate and wrong-direction ports;
hiding the visual keeps valid drops enabled. See
[connection preview qualification](evidence/connection-preview.md).

The **Port anchors** selector applies a single undoable document edit using the
public `PortPositionsChanged` event. Diagonal anchors sit on the SVG circle's
perimeter. Its value is derived from saved port data, including custom imported
positions. Both node designs, previews, reconnection, ELK and force layout use the
same geometry; see [anchor qualification](evidence/port-anchors.md).

**Navigation design** switches between the shipped controls and a compact layout
with a padded minimap and independently styled viewport outline. Both use the
same package primitives, including pointer and keyboard navigation. See
[navigation qualification](evidence/navigation.md).

Choose **Edge labels → Badge and inline editor** to try the custom label
presentation with either edge geometry. Select a connection and activate its
label to edit. Enter applies the draft and Escape discards it.
See the
[custom badge](evidence/edge-label-badge.png) and
[inline editor](evidence/edge-label-editor.png). To replay the Chromium check
after building the sample, run
`node --input-type=module < ../flow-sample/evidence/edge-label-browser.mjs`
from `apps/web`.

Choose **Edge actions → Compact · path and delete** and select a connection.
The compact layout puts path style first and leaves renaming to the edge
label. Press Up Arrow on the selected connection in the Connections list to
focus the path style control. [Workbench screenshot](evidence/edge-toolbar-compact.png)

Choose **Context menus → Custom action panel**, then right-click a node or
press Shift+F10 on a node or connection. The custom node panel offers Duplicate,
the edge panel adds Rename, and the group panel puts Width first.
[Group panel](evidence/context-menu-group.png) · [Edge panel](evidence/context-menu-edge.png)

Choose **Connection list layout → Connection rows** for a list with endpoint
names and selection styling. The rows also work inside the Connections
disclosure in minimal mode. [Workbench screenshot](evidence/connection-rows.png)

Choose **Resize readout → Labeled dimensions**, then drag a card resize handle
or select an expanded group. The badge responds to the Measurements setting,
the global diagnostics switch, and minimal mode.
[Card resize](evidence/resize-readout-node.png) · [Group resize](evidence/resize-readout-group.png)

Choose **Alignment guide design → Solid with endpoints** with **Snap to nodes**
enabled. In the release example, drag Review upward until it aligns with
Draft. In grouped Onion Architecture, drag the Application core's left
resize handle toward the right edge of UI adapter.
[Drag guide](evidence/alignment-guide-drag.png) · [Resize guide](evidence/alignment-guide-resize.png)

Choose **Selection marquee → Hatched outline**, then Shift-drag the background
or use **Box select**. The same outline is available in minimal mode.
[Workbench screenshot](evidence/selection-marquee.png)

Choose **Canvas help and status → Help card and status badge** for a custom
guide and a compact notice badge. The help follows the selection mode and
the badge announces the result of editor actions.
[Workbench screenshot](evidence/canvas-copy.png)

Turn on **Protect required items** to protect the Draft → Review connection
and the Domain model node in the Onion Architecture examples. Draft and
Review cannot be deleted while they have the protected connection, and
Application core cannot be deleted while it contains the required node.
Delete Publish in the release workflow to see an allowed edit and restore
it with one Undo.
[Protected edge](evidence/deletion-protected-edge.png) · [Protected group](evidence/deletion-protected-group.png)

Use **Box selection match → Partial overlap** to include cards only partly
inside the marquee. Draw the same box in **Full containment** to compare.
[Workbench screenshot](evidence/partial-selection.png)

While drawing a box, dashed outlines preview the nodes that will be
selected on release. The **Orbits** node design styles the same preview
with its own dashed ring.
[Card preview](evidence/selection-preview.png) · [Orbit preview](evidence/selection-preview-orbits.png)

Choose **Wheel navigation → Scroll to pan · Ctrl/Command to zoom** to pan
with a wheel or trackpad. Choose **Page scrolling** to leave wheel gestures
to the page. The canvas help updates with the chosen behavior.
[Workbench screenshot](evidence/wheel-navigation.png)

Enable **Animate Fit view**, zoom away from the diagram, then choose
**Fit view** to ease back to the fitted camera. Pan or zoom while it moves
to take over. The fit is instant when the system prefers reduced motion.
[Workbench screenshot](evidence/fit-view-animation.png)

Enable **Constrain camera** to try 75–130% zoom and a 96 px fit inset. Wheel,
pinch, and toolbar zoom stop at the same limits. **Fit view** uses the inset
for instant and animated fitting.
[Workbench screenshot](evidence/viewport-constraints.png)

Choose **Node toolbar → Standard** for the package controls or **Compact ·
below node** for a custom toolbar. Select one node or group and zoom to see
the controls stay the same size. **Off** hides the toolbar.
[Workbench screenshot](evidence/node-toolbar.png)

In the release workflow, enable **World annotation** to show the custom
release gate above Review. The annotation moves and scales with the node.
Activate it to select Review, or toggle **World annotation** off to hide it.
[Workbench screenshot](evidence/world-overlay.png)

Use **Draft → Review reconnection** to lock either end of that edge. Select
the connection to see the remaining handle and the disabled port selector
for the locked end. The setting applies only to the Draft → Review edge.
[Workbench screenshot](evidence/reconnect-permission.png)

Enable **Snap drops to nearby ports** to try a 32 px radius for new
connections and reconnections. Hover near a compatible port to preview
the drop before releasing.
[Workbench screenshot](evidence/connection-drop-radius.png)

Choose **System**, **Light**, or **Dark** from the theme picker. System follows
your browser's color preference as it changes. The workbench defaults to System
and remembers your selection in the same browser. The page applies the saved
or system theme before the workbench loads. Changing themes keeps the current
diagram, selection, and viewport.
[Light mode](evidence/theme-light.png) · [Dark mode](evidence/theme-dark.png)

Enable **Lock Review and Domain model** to keep those nodes fixed while editing.
You can still select them. In Grouped onion, the lock on Domain model also
blocks moving its parent groups.
[Workbench screenshot](evidence/node-movement-policy.png)
