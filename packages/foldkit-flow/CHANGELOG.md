# Changelog

## 0.1.0 (unreleased)

- Add reveal-node navigation with collapsed ancestor expansion and a
  visibility-aware node list for host search controls.

- Add an optional camera to graph snapshots with backward-compatible v1
  graph-only decoding.

- Add an opt-in lazy slot for retaining the built-in node and port layer
  across eligible camera updates, including a stable culled node set.

- Add opt-in viewport culling for canvas nodes and built-in edges, with full
  graph navigation and Connections retained.

- Add per-item visibility for the canvas, minimap, Connections list, and
  navigation while preserving the authored graph.

- Add per-port connection permissions for wire creation and reconnection, with
  disabled port controls and rejection feedback.

- Add per-node and per-edge selection policies, with shared rules for marquee
  preview and release.

- Add a per-node resize policy for pointer, keyboard, and explicit dimension edits.

- Add a per-node movement policy for drag and keyboard moves, including group descendants.

- Add typed scoped themes with light and dark presets and native control
  color schemes.

- Add an opt-in CSS-pixel drop radius for connection and reconnection drags.

- Add per-edge source and target reconnection permissions shared by
  the view and reducer.

- Add a world-space overlay slot and a positioning primitive for decorative
  annotations and interactive host content.

- Add an opt-in selected-node toolbar with screen-space placement, custom
  contents, and shared duplicate and delete actions.

- Configure zoom limits and Fit view padding in the editor. Wheel, pinch,
  controls, and animated fitting share the configured range.

- Add opt-in animated Fit view with instant fitting for reduced motion and
  cancellation when the user takes control of the viewport.

- Add opt-in wheel panning with Ctrl or Command to zoom, and an off mode for
  native page scrolling. Cursor-anchored wheel zoom remains the default.

- Preview pending box-selected nodes while dragging, with a separate shell
  highlight state and the same resolver used on release.

- Add optional partial-overlap box selection for cards and collapsed groups.
  Full containment remains the default and applies to expanded group frames.

- Add a pure deletion policy shared by keyboard deletion, context actions and
  the edge toolbar. A rejection protects the full transaction, including
  descendants and incident edges.

- Add custom canvas help and status content with the existing accessible
  descriptions, polite live region, and diagnostics visibility.

- Add a custom box-selection marquee using Flow's normalized selection bounds
  and existing gesture lifecycle.

- Add custom alignment guide SVG for dragging and resizing using the core's
  resolved endpoints and the existing alignment diagnostics.

- Add custom node and group resize readouts with Model dimensions and the
  existing measurements diagnostics and live-region behavior.

- Add Connections list composition with native selection and context buttons,
  shared keyboard shortcuts, and the existing compact disclosure.

- Add custom node and edge context panels with typed actions, native group
  dimension inputs, and focus that follows the rendered control order.

- Add selected-edge toolbar composition with typed actions, native control
  primitives, and keyboard focus that follows the rendered control order.

- Add custom edge label badges and inline editors through optional FoldKit view
  hooks and native form primitives. Both use the existing label anchor and draft.

- Add composable viewport controls and minimaps, with typed navigation actions,
  independently styled SVG content and viewport outline, and keyboard navigation.
  Default and custom designs share the same camera events and diagnostics gates.

- Add normalized custom port anchors, shared coordinate/boundary helpers and
  atomic port-position editing with validation, serialization and Undo.
- Isolate the measured visual shell from the frame coordinate plane so borders
  and padding do not shift authored anchors.

- Add pure connection-preview geometry and decorative SVG hooks, with core-owned
  valid/rejected target feedback and shared validation for hover and drop.
- Preserve logical path direction when reconnecting sources and follow authored
  path styles, canonical target anchors and collapsed-group projections.

- Add pure custom edge geometry policies shared by decoration, selection, labels
  and toolbar anchors, plus a public SVG hit-target primitive and per-edge hit width.

- Add complete node/group shell hooks and public unstyled frame, drag, port and
  resize primitives. Default chrome and custom designs share input and geometry.
- Add keyboard width resizing for native node resize controls.

- Add a pure graph/editor core with ports, validation, transactional history,
  versioned documents and revision-checked asynchronous layout publication.
- Add an optional native FoldKit HTML/SVG view with scoped browser input,
  measurement, keyboard controls and custom node content.
