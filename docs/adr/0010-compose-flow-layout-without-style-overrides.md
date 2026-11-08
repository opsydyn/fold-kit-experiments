# ADR 0010: Compose Flow layout without style overrides

## Status

Accepted for the user-approved left-sidebar redesign on 2026-11-08. Extends ADR
0004's public presentation composition and preserves the dependency-free core.

## Decision

Expose `FlowViewLayoutParts` and an optional `renderLayout(parts, builder)` slot
on `/foldkit`. The parts are existing native canvas, help, viewport controls,
connection creation, minimap, status and connection-list views. `canvasId` is a
native focus target for host skip links. They already
respect feature gates, diagnostics, policies and host messages. The default view
keeps its existing structure. A custom layout arranges parts inside the same
themed root without copying private DOM attributes or rendering a second canvas.

Add `height: 'fill'` alongside existing numeric heights; omit it to retain the
440px default. Fill uses normal flex/grid sizing with a zero minimum and border
box surface. Hosts provide a bounded parent. No CSS override of inline package
height is needed. The root keeps theme scope across sidebar and canvas.

The public minimap gains its own scoped, Live-only click Mount so it can move
outside canvas input delegation. It owns coordinate normalization, keyboard
activation and listener cleanup, and prevents duplicate surface click handling.
Keyboard navigation remains in its existing public primitive. Canvas gesture
binding, pointer capture and geometry measurement remain scoped to the canvas.

Use these parts in the sample's viewport-height shell: independently scrolling
left sidebar, labelled section navigation, Model-owned active section/collapse,
compact theme picker, and a persistent canvas pane. Put examples/actions,
appearance, navigation, ports, policies, inspection, diagnostics and Mermaid tools
in the sidebar. Contextual diagram handles/labels remain on the canvas. The
sidebar can collapse on narrow screens; no page-length control stack or second
window is introduced. Preserve graph, history, policies, diagnostics and export
consent when switching sections or changing layout.

## Alternatives and consequences

App-only CSS overrides would contradict the public composition contract. Hiding
the original chrome and recreating behavior privately would duplicate policy and
interaction logic. Moving all input delegation to the outer shell would risk
pan/zoom gestures from sidebar controls. A separate Live-scoped minimap resource
is the smaller boundary change. Multiple pane stores or DOM refs are unnecessary.

Boundary review: **safe with noted risk**. The public view contract changes;
headless graph state and persistence do not. Custom layouts must include each
part at most once, give fill a bounded parent and keep canvas/help IDs intact.
Nested editor/minimap isolation and replay disposal need regression coverage.

## Implementation and verification

- Add package layout/fill contracts, compose defaults from the same parts, add
  SSR contract tests and scoped minimap click/cleanup tests before implementation.
- Keep default-renderer markup and optional-peer imports compatible. Extend the
  packed consumer and generated public API docs for the new contract.
- Reorganize existing sample control elements into named sections; no existing
  control or policy is removed. Keep UI state in FoldKit Model/messages/update.
- Use responsive shell CSS with independent sidebar scrolling. Verify theme,
  collapse, keyboard focus, canvas sizing and selected-item/port controls.
- Browser-check desktop/narrow layouts, sidebar scroll without canvas movement,
  external minimap click/keyboard, editing/Undo, diagnostics and nested export;
  capture light/dark and narrow screenshots. Run required workspace gates and
  commit. Publishing, import and a new design-system dependency remain out of scope.

Recovery is reverting view/layout changes; there is no persisted data migration.
