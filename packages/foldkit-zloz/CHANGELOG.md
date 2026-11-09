# Changelog

## [0.2.0](https://github.com/opsydyn/fold-kit-experiments/compare/foldkit-zloz-v0.1.1...foldkit-zloz-v0.2.0) (2026-11-09)


### Features

* **zloz-cli:** add standalone Effect commands and JSON protocol ([ec58578](https://github.com/opsydyn/fold-kit-experiments/commit/ec585785e70f64ce0726919a717616576cae7e6c))
* **zloz:** add composable DDD preset renderers ([7cc5f23](https://github.com/opsydyn/fold-kit-experiments/commit/7cc5f2319036910e735cfa5399326046f1a94212))
* **zloz:** add Effect CLI, DDD renderers and edition history ([b71a349](https://github.com/opsydyn/fold-kit-experiments/commit/b71a349884267fad8fa5c9bb5f332d62a1e4f1ef))
* **zloz:** add named editions and read-only history ghosts ([3a41ea2](https://github.com/opsydyn/fold-kit-experiments/commit/3a41ea2e6992ede222f8a4fd260001d0986185dd))
* **zloz:** import editions and restore as undoable changes ([c582ef0](https://github.com/opsydyn/fold-kit-experiments/commit/c582ef03a2ea8b529349b10cd67d908db2f8053c))

## [0.1.1](https://github.com/opsydyn/fold-kit-experiments/compare/foldkit-zloz-v0.1.0...foldkit-zloz-v0.1.1) (2026-11-09)

### Bug Fixes

- **ci:** modernize actions and correct release workspace packing ([538c4ab](https://github.com/opsydyn/fold-kit-experiments/commit/538c4abe57213ebdfec8b9dc676422b3f61983a8))
- **ci:** update Node 24 actions and repair release packing ([337af66](https://github.com/opsydyn/fold-kit-experiments/commit/337af66382435266a6ce86cc9c2c60adbb6ca21f))

## 0.1.0 (unreleased)

- Add public layout parts, fill-height sizing and a native canvas focus target;
  support relocated minimaps with scoped Live input and listener cleanup.

- Add optional composable C4 node/boundary presets with scoped themes, replaceable
  semantic content and live native controls; share cylinder cap geometry with
  headless consumers.

- Add dependency-free C4/DDD node descriptors, a validated standalone factory,
  shape geometry and policy-aware undoable semantic/appearance edits. Preserve
  v1 documents and authored anchors; preset renderers remain a follow-up.

- Document explicit public body-cache composition for custom Orbit node/group
  artwork, with controls and policy-controlled sockets evaluated live.

- Add opt-in per-node body retention with live native/custom ports and fresh port
  policies, preserving frame geometry, control order and focused body inputs.

- Extend opt-in built-in node retention to pending connection creation, refreshing
  source/port feedback on changes and preserving policy/custom-renderer fallbacks.

- Index port compatibility and duplicate connections once per chooser resolution,
  and allocate each creation proposal ID once, preserving fresh policy checks.

- Add shared endpoint search projections, opt-in native node grouping, custom
  group labels and controlled search/clear/feedback primitives for both choosers.

- Add policy-aware connection creation choices and composable native fields,
  cancellation, focus-preserving reset and an opt-in creation panel.

- Add composable endpoint choosers with pure policy-aware candidates, stable
  identities, visible protection reasons and opt-in selected-edge toolbar controls.

- Add opt-in keyboard cycling through permitted point targets, first/last
  shortcuts, pure/headless actions and named feedback with atomic Undo.

- Add configurable corner/midpoint snap priority through editor preferences
  and per-port overrides, preserving captured rules, guides, bypass and Undo.

- Add opt-in permitted port snap target guides, with composable SVG rendering,
  captured settings, active feedback and alignment diagnostic controls.

- Add per-port allowed edge, corner and midpoint targets, including empty-list
  disabling, captured list copies and composable feedback.

- Add per-port anchor snapping overrides through a pure editor policy,
  with inherited fields, explicit zero values and captured drag settings
  available to custom handle renderers.

- Add independent opt-in edge-midpoint snapping for port anchor drags,
  with circular attraction, shared hysteresis/bypass and composable feedback.

- Add independent opt-in corner snapping for port anchor drags, with circular
  screen-pixel attraction, shared hysteresis/bypass and composable corner feedback.

- Add opt-in modifier-key bypass for port anchor snapping, including
  stationary key transitions, precise release and composable feedback.

- Add opt-in port anchor snap hysteresis with a screen-pixel release band
  and switch margin for competing edges.

- Add opt-in nearest-edge attraction for port anchor drags with a
  zoom-independent screen-pixel radius and composable snap feedback.

- Add opt-in composable anchor drag handles with live normalized previews,
  cancellation, keyboard nudges, policy rechecks and one-step Undo.

- Add composable port position drafts and native anchor inputs for edge
  offsets and normalized X/Y coordinates, with policy-aware Save/Cancel.

- Add composable FoldKit port inspector contexts and native control
  primitives with host-owned drafts, styling and shared protection reasons.

- Add operation-aware per-port edit policies, shared protection reasons,
  and atomic rejection of protected position batches.

- Add undoable port label edits that preserve endpoint identity and wiring,
  including explicit label clearing.

- Add atomic port add/remove events with attached-edge deletion policy,
  an inspectable removal decision and Undo.

- Add composable port rendering with target feedback and resolved
  controls for custom node and group shells.

- Add opt-in composable port labels with world anchors, configurable
  placement and a public label primitive.

- Add opt-in connection snap hysteresis for stable nearby-port targeting
  during wire creation and reconnection.

- Allow an independent reconnection drop radius while inheriting the
  connection radius by default.

- Add opt-in middle-button background panning while retaining the current
  selection and canvas tool.

- Add opt-in Space-drag panning that preserves selection and the current
  canvas tool.

- Add opt-in pointer-anchored background double-click zoom with a
  configurable multiplier.

- Add an opt-in Back to previous view control for returning from a
  camera fit or search reveal.

- Add Zoom to area with an opt-in viewport control and a composable
  drag preview.

- Add Fit selection for mixed node and edge selections, with an opt-in
  viewport button and a composable action.

- Add reveal-connection navigation for endpoint nodes and stored routes,
  with a visibility-aware connection list for host search controls.

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

- Add a custom box-selection marquee using Zloz's normalized selection bounds
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
