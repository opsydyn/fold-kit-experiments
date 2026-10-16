/**
 * A tiny typeface font for tests: block capitals H and I, each a set of rectangles, in
 * three.js's typeface JSON format (glyph outlines in `o`, units per em in `resolution`).
 */
import { Font, type FontData } from 'three/addons/loaders/FontLoader.js';

/** An outline of rectangles, `[x0, y0, x1, y1]` each, as typeface move and line commands. */
const rectangles = (boxes: ReadonlyArray<readonly [number, number, number, number]>): string =>
  boxes
    .map(([x0, y0, x1, y1]) => `m ${x0} ${y0} l ${x1} ${y0} l ${x1} ${y1} l ${x0} ${y1}`)
    .join(' ');

/** The font's data, as a typeface JSON file would hold it. */
export const blockFontData: FontData = {
  familyName: 'Block',
  resolution: 1000,
  ascender: 1000,
  descender: 0,
  underlinePosition: -100,
  underlineThickness: 50,
  original_font_information: { license: 'Written for these tests; public domain.' },
  boundingBox: { xMin: 0, xMax: 1000, yMin: 0, yMax: 1000 },
  glyphs: {
    H: {
      ha: 1000,
      x_min: 0,
      x_max: 800,
      o: rectangles([
        [0, 0, 200, 1000],
        [600, 0, 800, 1000],
        [200, 400, 600, 600],
      ]),
    },
    I: { ha: 400, x_min: 0, x_max: 200, o: rectangles([[0, 0, 200, 1000]]) },
  },
};

export const blockFont = (): Font => new Font(blockFontData);
