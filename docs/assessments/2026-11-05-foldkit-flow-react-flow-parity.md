# FoldKit Flow and React Flow interaction parity

Reviewed 5 November 2026 against FoldKit Flow commit `f6acf3b`, the public
`@opsydyn/foldkit-flow` core and `/foldkit` view, and React Flow's official
reference and examples. This is a workflow comparison across the two
libraries. It covers package capabilities and records workbench and adapter
evidence separately.

FoldKit Flow covers the main diagram editing loop. Full interaction parity is
still open. The highest priority for a workflow editor with protected steps is
item-level deletion control. Today the package offers a global read-only mode
and connection validation. A host can intercept deletion messages, but then
has to account for group descendants and incident edges itself.

| Workflow                         | FoldKit Flow at the reviewed commit                                                                                                                                                                     | Remaining gap or difference                                                                                                                                                                                                                                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Select, move, and resize         | Pointer and keyboard selection, additive selection, group resizing and card width resizing, grid and alignment snapping, and a composable marquee. The reducer selects fully enclosed nodes on release. | Partial-overlap selection and an in-progress selection preview are follow-up work. React Flow documents full and partial marquee selection. [SelectionMode](https://reactflow.dev/api-reference/types/selection-mode)                                                                                                                          |
| Create and reconnect edges       | Named output/input ports, drag and activation, both reconnect ends, a shared connection policy, and custom path, preview, and label renderers.                                                          | Flow's document is directed output-to-input. React Flow also exposes loose connections, configurable connection and reconnection radii, and per-edge reconnection settings. [Interaction and edge options](https://reactflow.dev/api-reference/react-flow)                                                                                     |
| Protect items during editing     | Whole-editor read-only mode. Deleting a selected group expands to its descendants, and deleting a node removes incident edges in the same transaction.                                                  | No package deletion policy or per-item interaction flags. React Flow provides node/edge deletion flags and a pre-delete callback. [Node fields](https://reactflow.dev/api-reference/types/node) · [Edge fields](https://reactflow.dev/api-reference/types/edge) · [OnBeforeDelete](https://reactflow.dev/api-reference/types/on-before-delete) |
| Group and collapse               | Nested groups, parent constraints, group selection, reparenting, collapse with projected boundary edges, and group resize.                                                                              | Grouped coordinates are world-relative in Flow. React Flow's child coordinates are relative to the parent. Equivalent workflows require coordinate translation during migration. [React Flow subflows](https://reactflow.dev/learn/layouting/sub-flows)                                                                                        |
| Navigate the viewport            | Pan, cursor-anchored wheel zoom, opt-in pinch, fit, auto-pan, controls, and a composable minimap with keyboard navigation.                                                                              | Flow's native view has a fixed wheel-zoom behavior and core zoom range. React Flow exposes scroll panning, more input switches, and animated viewport operations. [Viewport and interaction options](https://reactflow.dev/api-reference/react-flow) · [Viewport methods](https://reactflow.dev/api-reference/types/react-flow-instance)       |
| Extend the UI                    | Package hooks cover nodes, groups, ports, edges, labels, edge actions, context panels, the Connections list, guides, and canvas help/status.                                                            | A general world-space overlay slot and a selected-node toolbar with screen-size controls remain useful extension gaps. [ViewportPortal](https://reactflow.dev/api-reference/components/viewport-portal) · [NodeToolbar](https://reactflow.dev/api-reference/components/node-toolbar)                                                           |
| Keyboard and accessible controls | Focusable node handles, a named Connections list for edges, keyboard resizing and port activation, and customizable instructions and announcements.                                                     | React Flow also supports focus directly on edges, camera panning when a node gains focus, and a map of built-in accessible labels. [Accessibility](https://reactflow.dev/learn/advanced-use/accessibility)                                                                                                                                     |
| Save and recover                 | Versioned graph JSON, atomic edits, Undo/Redo, and stale-layout rejection. The workbench supplies browser storage and file import/export.                                                               | Flow's graph serialization excludes the viewport. Hosts that restore a camera can store it separately. React Flow includes a viewport in its snapshot object. [ReactFlowInstance](https://reactflow.dev/api-reference/types/react-flow-instance)                                                                                               |
| Render larger diagrams           | Group collapse filters hidden descendants. The native view still builds the visible graph presentation without a viewport culling option.                                                               | React Flow exposes optional viewport culling. Establish representative interaction budgets before choosing an optimization. This review did not measure either library's performance. [Render options](https://reactflow.dev/api-reference/react-flow)                                                                                         |

Layout already has separate package entry points. The ELK adapter handles
compound groups and orthogonal routes. The deterministic force adapter
supports non-empty flat graphs up to 100 nodes. React Flow's force layout is
an integration example. Palette drag from outside the canvas is also an
integration example, so it belongs in a separate workbench or adapter slice.
[Force layout example](https://reactflow.dev/examples/layout/force-layout) ·
[Palette drag example](https://reactflow.dev/examples/interaction/drag-and-drop)

## Recommended next slice

Pursue **atomic deletion protection** as one package and workbench slice.
The assumed consumer workflow is a diagram that combines required steps or
links with editable items. The highest-risk case is deleting a parent or
endpoint indirectly removing protected content. The package already computes
the deletion closure and commits the graph through its transaction boundary.

- Evaluate the complete candidate set before committing, including descendants
  and incident edges. The direct edge deletion path should use the same rule.
- Use a pure host decision with a reason, in the style of the existing
  connection policy. Make the same result available to the action UI and
  keyboard path. A rejection should preserve the graph, revision, and history.
- Keep the first slice to deletion. Movement, resizing, reconnection and
  item visibility each have separate interaction rules.

Acceptance is one workbench diagram with editable and protected items.
Keyboard, context panel, and edge toolbar should agree on the result.
A protected descendant or incident edge should veto the complete deletion
and explain why. An allowed deletion should be restored by one Undo.
If protecting a mixed selection requires partial deletion, decide that
behavior as a separate policy before extending this slice.

Partial marquee overlap is the next small parity improvement for freeform
editing. Viewport culling should follow a measured large-diagram workload.

## Evidence boundary

The comparison uses the checked-out package contracts and the existing
workbench browser scripts under `apps/flow-sample/evidence/`. The focused
core and diagnostics suite passed 68 tests during this review. Browser
interaction evidence comes from the preceding implementation slices.
No new side-by-side device, screen-reader, or performance qualification
was conducted.
