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
- Not yet: a label's own material (troika derives one from any material), colour ranges,
  curved text, and measuring a label's laid-out size.
