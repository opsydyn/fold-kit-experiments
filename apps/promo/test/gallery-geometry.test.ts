import { expect, it } from 'bun:test';

import { examples, galleryExamples } from '../src/lib/examples';
import {
  circles,
  tiles,
  treeNodes,
  radarPaths,
  streamPaths,
  statistics,
  grouped,
  stacked,
} from '../src/lib/gallery-charts';
it('keeps six featured examples while exposing eighteen unique gallery entries', () => {
  expect(examples).toHaveLength(6);
  expect(galleryExamples).toHaveLength(18);
  expect(new Set(galleryExamples.map((d) => d.id)).size).toBe(18);
});
it('expanded gallery uses finite geometry from existing primitives', () => {
  for (const path of [...radarPaths, ...streamPaths, ...statistics.map((d) => d.violin)])
    expect(path).not.toMatch(/NaN|Infinity|undefined/);
  expect(tiles).toHaveLength(5);
  expect(circles).toHaveLength(5);
  expect(treeNodes).toHaveLength(8);
  expect(grouped.bars).toHaveLength(12);
  expect(stacked.bars).toHaveLength(12);
});
