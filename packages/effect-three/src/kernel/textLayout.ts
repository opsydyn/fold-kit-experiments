/**
 * Lays out text from a typeface font as shapes, with letter spacing, line height and
 * alignment.
 *
 * Behavioural reference: three.js `FontLoader.js` `createPaths` at 0.186.1 (each glyph
 * advanced by its `ha`, a new line down by the font's bounding box height plus its
 * underline thickness, a missing glyph drawn as `?`). Drei's `Text3D` (`bf6f4ad`) takes
 * `letterSpacing` and `lineHeight` and hands them to `TextGeometry`, which ignores them;
 * here they are applied, in the units troika's `Text` uses: letter spacing in ems, line
 * height as a multiple of the font's own. At the defaults the shapes are three's.
 *
 * @module
 */
import { Vector2, type Path, type Shape } from 'three';
import type { Font } from 'three/addons/loaders/FontLoader.js';

import type { TextAlign } from './description.ts';

/** How to lay the text out. */
export type TextLayout = {
  readonly size: number;
  /** Extra space after each glyph, in ems (multiples of `size`). */
  readonly letterSpacing: number;
  /** Line spacing as a multiple of the font's. */
  readonly lineHeight: number;
  /** Where each line sits within the widest. */
  readonly align: TextAlign;
};

type Glyph = { readonly ha: number };

const corners = ['v0', 'v1', 'v2', 'v3'] as const;

/** Moves every point of a path's curves by `(dx, dy)`. */
const shiftPath = (path: Path, dx: number, dy: number): void => {
  for (const curve of path.curves) {
    for (const corner of corners) {
      const point: unknown = Reflect.get(curve, corner);
      if (point instanceof Vector2) point.set(point.x + dx, point.y + dy);
    }
  }
};

/** Moves a shape and its holes. */
const shiftShape = (shape: Shape, dx: number, dy: number): Shape => {
  shiftPath(shape, dx, dy);
  for (const hole of shape.holes) shiftPath(hole, dx, dy);
  return shape;
};

/** A glyph, or `?` for one the font lacks; neither, and the character is skipped. */
const glyphOf = (font: Font, char: string): Glyph | undefined => {
  const glyphs: Readonly<Record<string, Glyph | undefined>> = font.data.glyphs;
  return glyphs[char] ?? glyphs['?'];
};

type Line = {
  readonly chars: ReadonlyArray<string>;
  readonly starts: ReadonlyArray<number>;
  readonly width: number;
};

/** A line's drawable glyphs, where each starts, and its width (without trailing spacing). */
const lineOf = (font: Font, line: string, scale: number, spacing: number): Line => {
  const chars: Array<string> = [];
  const starts: Array<number> = [];
  let x = 0;
  for (const char of Array.from(line)) {
    const glyph = glyphOf(font, char);
    if (glyph === undefined) continue;
    chars.push(char);
    starts.push(x);
    x += glyph.ha * scale + spacing;
  }
  return { chars, starts, width: chars.length === 0 ? 0 : x - spacing };
};

const alignShift = { left: () => 0, center: (gap: number) => gap / 2, right: (gap: number) => gap };

/** The shapes of `text` laid out by `layout`, the first line's baseline at y = 0. */
export const layoutText = (font: Font, text: string, layout: TextLayout): ReadonlyArray<Shape> => {
  const { data } = font;
  const scale = layout.size / data.resolution;
  const lineStep =
    (data.boundingBox.yMax - data.boundingBox.yMin + data.underlineThickness) *
    scale *
    layout.lineHeight;
  const spacing = layout.letterSpacing * layout.size;
  const lines = text.split('\n').map((line) => lineOf(font, line, scale, spacing));
  const widest = Math.max(0, ...lines.map((line) => line.width));
  const shapes: Array<Shape> = [];
  lines.forEach((line, row) => {
    const indent = alignShift[layout.align](widest - line.width);
    line.chars.forEach((char, i) => {
      const x = indent + (line.starts[i] ?? 0);
      for (const shape of font.generateShapes(char, layout.size)) {
        shapes.push(shiftShape(shape, x, -row * lineStep));
      }
    });
  });
  return shapes;
};
