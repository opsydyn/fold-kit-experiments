# Shared edge geometry qualification

Local Chromium qualification on 2026-11-05, using the built Astro sample. The
**Edge design** selector changes from default geometry to a pure raised-arc
policy. Both node presentations use the same package geometry/input paths.

- [Cards with custom edge geometry](edge-geometry-cards.png)
- [SVG nodes with custom edge geometry](edge-geometry-orbits.png)

Both presentations passed browser checks for:

- Geometry selection leaves the document unchanged.
- Decoration and selection use identical paths; clicking the old straight segment
  does not select the curved edge. Clicking the curve opens its normal actions.
- Label creation/save, explicit anchor placement and movement with its nodes.
- Node movement, authored-style fallback, endpoint reconnection and cancellation.
- Edge deletion and Undo, preserving the active view geometry policy.

A collapsed-group check waits for the rendered collapsed state, then verifies
that the custom path terminates at the displayed group boundary. Expansion
restores the normal endpoint. No page runtime errors were observed.

Reproduce from the repository root:

```sh
bun run --filter @opsydyn/flow-sample build
cd apps/web
node --input-type=module <../flow-sample/evidence/edge-geometry-browser.mjs
```

The harness uses the existing web workspace Playwright dependency and a temporary
loopback server. It closes browser/server resources and writes screenshots under
`/tmp/foldkit-flow-edge-geometry-*.png`.

Package tests also qualify pure endpoint resolution, authored/layout fallback,
invalid geometry rejection, and shared path/label/toolbar placement with default
and custom decoration. Read-only rendering retains the resolved path and omits
editing controls. The external packed consumer exercises both the pure resolver
and the public SVG target with typed host builders under Bundler and NodeNext.

This slice retains canonical cardinal ports. It does not add arbitrary port
anchors, obstacle avoidance, custom drag previews, route bounds for Fit view, or
complete control/overlay composition. A dedicated accessibility audit remains
separate from the keyboard editing behavior checked here.
