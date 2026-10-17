import { expect, test } from 'bun:test';

import { label } from '@opsydyn/effect-three';
import { Text } from 'troika-three-text';

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
