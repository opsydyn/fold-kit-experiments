import { expect, test } from 'bun:test';

import { colorRange, label } from '@opsydyn/effect-three';
import { Material, MeshStandardMaterial } from 'three';
// Its ES build, as bundlers pick it (`module`): Bun would load the UMD `main`, whose
// `require('three')` can meet three's ES build mid-load.
import { Text } from 'troika-three-text/dist/troika-three-text.esm.js';

import { troikaLabels } from '../src/index.ts';

// No browser here: `sync` would build glyphs with WebGL in a worker. Record calls instead.
const synced: Array<string> = [];
Text.prototype.sync = function recordSync(this: Text) {
  synced.push(this.text);
};

const host = (node: ReturnType<typeof label>) => {
  synced.length = 0;
  const hosted = troikaLabels().create(node, () => undefined);
  if (!(hosted.object instanceof Text)) throw new Error('not a troika Text');
  return { hosted, text: hosted.object };
};

test('a label sets troika’s properties, with Drei’s defaults for those left out', () => {
  const { text } = host(label({ key: 'a', text: 'Hi', fontSize: 0.5, outlineWidth: 0.02 }));
  expect(text.text).toBe('Hi');
  expect(text.fontSize).toBe(0.5);
  expect(text.anchorX).toBe('center');
  expect(text.anchorY).toBe('middle');
  expect(text.outlineWidth).toBe(0.02);
  // `null` in the description is troika's own default: never wrap, the font's line height.
  expect(text.maxWidth).toBe(Number.POSITIVE_INFINITY);
  expect(text.lineHeight).toBe('normal');
  expect(text.sdfGlyphSize).toBe(64);
});

test('an update sets the new settings and syncs again', () => {
  const { hosted, text } = host(label({ key: 'a', text: 'Hi' }));
  hosted.update(label({ key: 'a', text: 'Bye', maxWidth: 3, lineHeight: 1.4 }));
  expect(synced).toEqual(['Hi', 'Bye']);
  expect(text.maxWidth).toBe(3);
  expect(text.lineHeight).toBe(1.4);
  hosted.dispose();
});

test('colour ranges, a curve and a lent material reach troika; layouts come from it', () => {
  const { hosted, text } = host(
    label({
      key: 'a',
      text: 'Hello',
      curveRadius: -2,
      colorRanges: [colorRange(0, 0xff0000), colorRange(3, 0x00ff00)],
    }),
  );
  expect(text.colorRanges).toEqual({ 0: 0xff0000, 3: 0x00ff00 });
  expect(text.curveRadius).toBe(-2);
  hosted.update(label({ key: 'a', text: 'Hello' }));
  expect(text.colorRanges).toBeNull();
  // troika derives its text material from the one lent, and goes back to its own without.
  const lit = new MeshStandardMaterial({ roughness: 0.3 });
  hosted.setMaterial(lit);
  const derived = text.material;
  expect(derived).toBeInstanceOf(Material);
  expect(Reflect.get(derived ?? {}, 'baseMaterial')).toBe(lit);
  hosted.setMaterial(undefined);
  expect(Reflect.get(text.material ?? {}, 'baseMaterial')).not.toBe(lit);
  // Not laid out yet (no worker here); once troika has, its bounds are the layout.
  expect(hosted.layout()).toBeUndefined();
  Reflect.set(text, '_textRenderInfo', {
    blockBounds: [-1, -0.5, 1, 0.5],
    visibleBounds: [-0.9, -0.4, 0.9, 0.35],
  });
  expect(hosted.layout()).toEqual({ block: [-1, -0.5, 1, 0.5], visible: [-0.9, -0.4, 0.9, 0.35] });
  hosted.dispose();
});
