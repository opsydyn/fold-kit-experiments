/**
 * Draws the workshop floor texture: pale tiles with soft grout lines, as a PNG.
 *
 *   bun scripts/make-tiles.ts <out.png> [more.png ...]
 *   DETAIL=low bun scripts/make-tiles.ts <out-low.png> ...   # a coarse level, 32 pixels
 */
import { PNG } from 'pngjs';

/** A coarse level (`DETAIL=low`) is the same floor at an eighth of the pixels. */
const scale = process.env['DETAIL'] === 'low' ? 8 : 1;
const size = 256 / scale;
const tile = 64 / scale;
const grout = Math.max(1, Math.round(3 / scale));
const image = new PNG({ width: size, height: size });

for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const inGrout = x % tile < grout || y % tile < grout;
    // A little deterministic variation per tile keeps the floor from looking flat.
    const shade = ((Math.floor(x / tile) * 7 + Math.floor(y / tile) * 13) % 5) * 3;
    const value = inGrout ? 168 : 222 - shade;
    const offset = (y * size + x) * 4;
    image.data[offset] = value;
    image.data[offset + 1] = value - 4;
    image.data[offset + 2] = value - 12;
    image.data[offset + 3] = 255;
  }
}

const png = PNG.sync.write(image);
for (const path of process.argv.slice(2)) {
  await Bun.write(path, png);
  console.log('wrote', path, png.byteLength, 'bytes');
}
