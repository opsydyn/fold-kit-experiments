# Persistent canvas and left sidebar

- **result:** complete
- **claim:** Existing workbench controls now live in an independently scrolling left sidebar while a single live canvas fills the remaining viewport. Public package composition supplies the layout, fill sizing and relocated overview behavior.
- **evidence:** Public SSR/layout and input cleanup regressions, extended packed npm consumer, sample state tests, Chromium desktop/narrow editing journey, inspected themed screenshots, generated API docs and workspace gates recorded below.
- **remaining uncertainty:** Narrow-screen evidence is browser emulation, not physical device or screen-reader acceptance. Custom layouts must supply bounded height and preserve part ownership. No benchmark speedup or manual DevTools replay qualification is claimed.
- **next:** Add searchable sidebar settings so the growing control catalogue remains discoverable across sections.

## Package and host boundaries

The optional `/foldkit` view exports `FlowViewLayoutParts` and `renderLayout`.
Native canvas/help/controls/creation/overview/status/connections remain themed,
policy-aware and gated by existing diagnostics. `canvasId` enables a native skip
link. `height: 'fill'` is a public flex/grid sizing option; numeric and default
heights retain their behavior. Default presentation is composed from the same
parts. The pure core gains no dependency or persisted schema change. See
[ADR 0010](../../../docs/adr/0010-compose-flow-layout-without-style-overrides.md).

A public overview can move outside canvas delegation: its private Live-scoped
Mount normalizes its SVG plane, consumes the handled click, and releases its
listener when interrupted. Existing keyboard navigation stays in the primitive.
Canvas pointer capture, measurement and gestures remain scoped to the canvas.
The direct resource regression checks exact pointer normalization, keyboard
activation, no duplicate parent handling, disabled input and release.

The Astro shell owns a bounded viewport. The FoldKit Model owns active section
and sidebar collapse. Sections are Diagram, Appearance, Navigation, Ports,
Policies, Inspect, Diagnostics and Mermaid export. Theme remains near the top;
the narrow rail retains Fit view. Native links/buttons, labelled sections,
expanded/pressed state and keyboard-visible Skip to canvas support navigation.
All prior settings remain available; redundant diagnostic/export disclosure
buttons are replaced by the section navigation. Contextual editing, handles and
diagram feedback remain on canvas. Switching panes preserves graph/history and
export consent; graph changes still invalidate consent.

## Host-executed browser evidence

`sidebar-browser.json` records Chromium 151.0.7922.34 results:

- At 1440×1000, the canvas is 1032×928 at (396,60). Scrolling the controls leaves
  its bounding rectangle unchanged and does not scroll the document.
- At 390×844, the expanded sidebar leaves a 198.6×784 canvas. Collapsing it
  expands the canvas to 326×784, with no page overflow. The rail's native Fit view
  remains available.
- The exact same canvas element survives sidebar/theme/diagnostic/export changes.
- The relocated overview responds to pointer input and one ArrowRight changes
  the viewport by exactly 20px. Graph data remains unchanged.
- Node movement/Undo and port-label editing/Undo work with the sidebar inspector.
- Disabling diagnostics hides zoom readouts while leaving the canvas and requested
  Mermaid loss review usable. Nested bundle download retains two groups and the
  database's original parent identity.
- Skip to canvas focuses the actual live surface. Narrow controls restore and
  native select focus remain usable. No page errors or external requests occur.

Inspected images: [light](./sidebar-light.png), [dark](./sidebar-dark.png),
[narrow collapsed](./sidebar-narrow.png). These capture the application, not a
mockup. The source/artifact fingerprint is in `sidebar-sources.json`.

```sh
bun run --filter @opsydyn/flow-sample build
node apps/flow-sample/evidence/sidebar-browser.mjs
```

The browser harness serves only the built app from a temporary loopback server
and closes its server/browser. The user's localhost preview remains independent.

## Regressions, self-review and final checks

A narrow-screen check caught visually hidden diagnostic elements contributing
to document overflow. Giving the owned scroll/notice regions a positioning
context keeps that content contained; the strict viewport regression now passes.
An existing theme test caught an empty style attribute introduced on unthemed
views. Restoring the original conditional style emission preserves inheritance;
the test passes unchanged. No assertion was weakened to accept either defect.

Self-review covered package boundaries, default markup compatibility, native
input ownership/cleanup, policy and history preservation, source/diagnostic
visibility and narrow layout. Live-only Mount gating is implemented with the
existing scoped stream pattern; manual replay lifecycle acceptance is not claimed.

Host execution on 2026-11-08 finished with exit 0 for `bun run test`,
`bun typecheck`, `bun run check`, public TypeDoc generation, production sample
build and the final sidebar browser journey. Core has 256 passing tests, including
the packed consumer; the sample has 13. The existing default Flow editing journey
also passes on desktop and mobile (2 cases). Root lint reports advisory warnings
and no errors; formatting/catalog checks pass. API documentation includes
`FoldKit.FlowViewLayoutParts`. A separate localhost smoke confirms the refreshed
preview. These are local results, not a hosted CI or publication claim.
The packed consumer compiles the new public type in Bundler/NodeNext and renders
the public slot using the installed archive. No publication or deployment occurs.

Recommendation: **needs follow-up** for settings discovery and later device/a11y
acceptance; the authorized local redesign is complete.
