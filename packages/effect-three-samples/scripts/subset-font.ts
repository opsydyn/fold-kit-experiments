/**
 * Subsets a three.js typeface JSON font to printable ASCII, for the samples' 3D text.
 *
 *   bun scripts/subset-font.ts <source.json> <out.json> [more.json ...]
 *
 * The samples use Inter Bold (Copyright © 2020 The Inter Project Authors), licensed under
 * the SIL Open Font License 1.1, from Drei's storybook (`drei-main/.storybook/public/
 * fonts/Inter_Bold.json` at `bf6f4ad`). The OFL allows modified versions; Inter declares no
 * Reserved Font Name, so the subset keeps its name. Ship `inter-OFL.txt` beside it.
 */
import type { FontData } from 'three/addons/loaders/FontLoader.js';

const [source, ...outputs] = process.argv.slice(2);
if (source === undefined || outputs.length === 0) {
  console.error('usage: bun scripts/subset-font.ts <source.json> <out.json> [more.json ...]');
  process.exit(1);
}

const font: FontData = await Bun.file(source).json();
const printable = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i));
const glyphs = Object.fromEntries(
  printable.flatMap((character) =>
    font.glyphs[character] === undefined ? [] : [[character, font.glyphs[character]]],
  ),
);
const subset = JSON.stringify({ ...font, glyphs });
for (const output of outputs) await Bun.write(output, subset);
console.log(
  `${Object.keys(glyphs).length} glyphs, ${(subset.length / 1024).toFixed(0)} KiB -> ${outputs.join(', ')}`,
);
