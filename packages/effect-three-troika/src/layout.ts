/**
 * What both label implementations share: troika's layout settings from a label, with
 * Drei's glyph size.
 *
 * @module
 */
import type { LabelNode } from '@opsydyn/effect-three';
import type { TextRenderArgs } from 'troika-three-text/dist/troika-three-text.esm.js';

/** Drei's `sdfGlyphSize`: each glyph's distance field is 64 pixels square. */
export const glyphSize = 64;

/** A label's colour ranges as troika takes them: an object from start index to colour. */
export const colorRangesOf = (label: LabelNode): Record<number, number> | null => {
  if (label.colorRanges.length === 0) return null;
  const ranges: Record<number, number> = {};
  for (const { start, color } of label.colorRanges) ranges[start] = color;
  return ranges;
};

/**
 * The settings `getTextRenderInfo` lays a label out with: those troika's `Text.sync`
 * passes, with troika's defaults for what a label leaves `null`.
 */
export const layoutArgs = (label: LabelNode): TextRenderArgs => ({
  text: label.text,
  font: label.font,
  fontSize: label.fontSize || 0.1,
  letterSpacing: label.letterSpacing,
  lineHeight: label.lineHeight ?? 'normal',
  maxWidth: label.maxWidth ?? Number.POSITIVE_INFINITY,
  textAlign: label.textAlign,
  anchorX: label.anchorX,
  anchorY: label.anchorY,
  colorRanges: colorRangesOf(label),
  sdfGlyphSize: glyphSize,
  includeCaretPositions: true,
});
