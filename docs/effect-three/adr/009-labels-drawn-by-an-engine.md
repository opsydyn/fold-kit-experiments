# ADR-009: Labels are data; an engine draws them

- Status: Accepted (2026-10-17).
- Evidence: `packages/effect-three/src/kernel/labels.ts`, `sceneGraph.ts` (`Label` entries),
  `test/labels.test.ts` (a fake engine); `packages/effect-three-troika`;
  `packages/effect-three-foldkit/e2e/labels.test.ts` (troika in Chromium); the workshop
  sample's caption.
- References: Drei `src/core/Text.tsx` at `bf6f4ad`; troika-three-text 0.52.5 (MIT).

## Context

Drei's `Text` is troika's `Text` mesh: fonts (TTF, OTF, WOFF) parsed at run time, glyph
distance fields built in a worker, `sync` called after each prop change and the frame
invalidated when it finishes. It is asynchronous, uses workers and WebGL, and adds
dependencies. The kernel is synchronous and DOM-free, and physics already set the pattern
for work like this ([ADR-007](007-physics-as-a-pose-source.md)).

## Decision

- **A label is a node.** `label({ key, text, font, fontSize, color, fillOpacity, anchorX,
anchorY, maxWidth, lineHeight, letterSpacing, textAlign, outlineWidth, outlineColor,
outlineOpacity, outlineBlur, interactive, … })` with Drei's defaults (size 1, anchored
  centre and middle). Its transform, transitions and behaviours apply to a wrapper group,
  as a borrowed model's do.
- **An engine draws it.** `LabelEngine.create(label, ready)` returns the object to show,
  `update` for new text or type settings (a transform change never reaches it) and
  `dispose`. `ready` invalidates the scene, which wakes an idle frame loop: Drei's
  `sync(() => invalidate())`. Without an engine a label is an empty wrapper.
- **Troika lives in its own package.** `troikaLabels()` from `@opsydyn/effect-three-troika`,
  passed as `makeEnvironment(window, { labels })`, keeps troika, its worker code and its
  font parser out of the core. It uses Drei's 64-pixel glyph fields.

## Consequences

- Fonts are URLs the app serves. troika 0.52 cannot read WOFF2 in its worker ("woff2 fonts
  not supported"), so samples ship Inter as WOFF. A label without a font makes troika
  fetch its default from a CDN.
- Text for geometry (`text()`, typeface JSON, extrudable, a collider source) and labels
  (crisp at any size, wrapping, outlines) stay separate, as Drei's `Text3D` and `Text` are.
- Since added: `colorRanges` (troika's experimental `colorRanges`, as a list of
  `colorRange(start, color)`), `curveRadius`, and `material`: a scene material (inline or
  shared, held from the store as a mesh's) that troika derives the text material from,
  as Drei's `Text` takes a material child; `color` still colours the glyphs. troika
  frees a derived material only with its base (disposing it alone would fire the base's
  own dispose listeners through the prototype chain), so a shared material's derived
  materials go when its definition does. A label named in `scene({ measure })` also
  reports `LabelMeasured { key, block, visible }`, troika's `blockBounds` and
  `visibleBounds` in the label's own units, whenever its layout changes, as Drei's
  `onSync` reads `textRenderInfo`.
- Since added (2026-10-19): `createTsl`, the same contract for renderers whose materials
  are node materials (a render kit with `shading: 'tsl'`, as `webgpuKit` is). troika's
  is in `@opsydyn/effect-three-troika/webgpu`: `getTextRenderInfo` lays the text out and
  builds the shared distance-field atlas, a byte copy of which (`readPixels`, as troika's
  Safari workaround) a node material samples; troika's vertex and fragment logic
  (`TextDerivedMaterial.js`) is ported to TSL, the outline as a first pass. A lent
  material is copied into its node-material class (three's `NodeLibrary.fromMaterial`)
  and followed before each draw. A separate entry keeps three's WebGPU build out of
  WebGL-only bundles. Evidence: `packages/effect-three-troika/test/tsl.test.ts` and the
  label e2e on three renderers.
