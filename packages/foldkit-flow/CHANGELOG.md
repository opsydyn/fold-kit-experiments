# Changelog

## 0.1.0 (unreleased)

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
