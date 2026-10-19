/**
 * Troika distance-field text for `@opsydyn/effect-three`: a `LabelEngine` that draws
 * `label()` nodes. Make it once and pass it on:
 *
 * ```ts
 * const environment = EffectThreeFoldkit.makeEnvironment(window, { labels: troikaLabels() });
 * ```
 *
 * Each label is a troika `Text` mesh with its properties set from the description and
 * `sync` run after each change, the scene drawn again when it finishes: Drei's `Text`
 * (`bf6f4ad`, `src/core/Text.tsx`), including its 64 pixel glyph distance fields.
 *
 * For `WebGPURenderer`, `@opsydyn/effect-three-troika/webgpu` has a `troikaLabels` that
 * also draws with node materials (TSL): troika still lays the text out and builds its
 * glyphs, and a node material draws them. It is a separate entry so that WebGL pages do
 * not bundle three's WebGPU build.
 *
 * troika-three-text is MIT. Fonts load from the URL a label names; a label with no font
 * uses troika's default, which it fetches from a CDN.
 *
 * @module
 */
import type { HostedLabel, LabelEngine, LabelLayout, LabelNode } from '@opsydyn/effect-three';
// Its ES build, as bundlers pick it (`module`): Bun would load the UMD `main`, whose
// `require('three')` can meet three's ES build mid-load.
import type { Material } from 'three';
import { Text } from 'troika-three-text/dist/troika-three-text.esm.js';

import { colorRangesOf, glyphSize } from './layout.ts';

/** Sets every type setting of `text` from `label`. */
const apply = (text: Text, label: LabelNode): void => {
  text.text = label.text;
  text.font = label.font;
  text.fontSize = label.fontSize;
  text.color = label.color;
  text.fillOpacity = label.fillOpacity;
  text.anchorX = label.anchorX;
  text.anchorY = label.anchorY;
  text.maxWidth = label.maxWidth ?? Number.POSITIVE_INFINITY;
  text.lineHeight = label.lineHeight ?? 'normal';
  text.letterSpacing = label.letterSpacing;
  text.textAlign = label.textAlign;
  text.outlineWidth = label.outlineWidth;
  text.outlineColor = label.outlineColor;
  text.outlineOpacity = label.outlineOpacity;
  text.outlineBlur = label.outlineBlur;
  text.colorRanges = colorRangesOf(label);
  text.curveRadius = label.curveRadius;
};

/** troika's laid-out bounds, once `sync` has laid the text out. */
const layoutOf = (text: Text): LabelLayout | undefined => {
  const info = text.textRenderInfo;
  if (info === null) return undefined;
  const [a = 0, b = 0, c = 0, d = 0] = info.blockBounds;
  const [e = 0, f = 0, g = 0, h = 0] = info.visibleBounds;
  return { block: [a, b, c, d], visible: [e, f, g, h] };
};

const host = (label: LabelNode, ready: () => void): HostedLabel => {
  const text = new Text();
  text.sdfGlyphSize = glyphSize;
  apply(text, label);
  text.sync(ready);
  return {
    object: text,
    update: (next) => {
      apply(text, next);
      text.sync(ready);
    },
    // troika derives its text material from the one lent, and frees it with it.
    setMaterial: (material: Material | undefined) => {
      text.material = material;
    },
    layout: () => layoutOf(text),
    dispose: () => text.dispose(),
  };
};

/**
 * The troika label engine, drawing with WebGL. One serves every scene on a page. For
 * `WebGPURenderer`, take `troikaLabels` from `@opsydyn/effect-three-troika/webgpu`.
 */
export const troikaLabels = (): LabelEngine => ({ create: host });
