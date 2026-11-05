# Changelog

## 0.1.0 (unreleased)

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
