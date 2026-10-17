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
 * troika-three-text is MIT. Fonts load from the URL a label names; a label with no font
 * uses troika's default, which it fetches from a CDN.
 *
 * @module
 */
import type { HostedLabel, LabelEngine, LabelNode } from '@opsydyn/effect-three';
import { Text } from 'troika-three-text';

/** Drei's `sdfGlyphSize`: each glyph's distance field is 64 pixels square. */
const glyphSize = 64;

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
    dispose: () => text.dispose(),
  };
};

/** The troika label engine. One serves every scene on a page. */
export const troikaLabels = (): LabelEngine => ({ create: host });
