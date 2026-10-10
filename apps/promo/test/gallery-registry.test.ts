import { expect, it } from 'bun:test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import * as registry from '../src/lib/examples';

it('exposes the expanded gallery without removing the curated homepage or comparison route', () => {
  expect(registry).toHaveProperty('galleryExamples');
  const gallery = registry.galleryExamples;
  expect(gallery).toHaveLength(18);
  expect(registry.examples).toHaveLength(6);
  expect(registry.comparisonExample.href).toBe('/examples/comparison/');
});

it('links each gallery entry to an existing public implementation file', () => {
  for (const entry of registry.galleryExamples) {
    const file = 'sourceFile' in entry ? String(entry.sourceFile) : entry.module + '.ts';
    expect(existsSync(resolve(import.meta.dir, '../../../packages/foldkit-viz/src', file))).toBe(
      true,
    );
  }
});
