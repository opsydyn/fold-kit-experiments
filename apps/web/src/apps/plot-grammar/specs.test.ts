import { compilePlot } from '@opsydyn/foldkit-viz/plot';
import { describe, expect, it } from 'vitest';

import { displaySpec, examples } from './specs';

describe('plot grammar examples', () => {
  it.each(examples.map((e) => [e.id, e] as const))(
    '%s compiles, and survives a JSON round trip',
    (_, example) => {
      const plot = compilePlot(example.spec);
      expect(plot.facets.length).toBeGreaterThan(0);
      expect(plot.facets.every((f) => f.marks.every((m) => m.graphics.length > 0))).toBe(true);
      expect(compilePlot(JSON.parse(JSON.stringify(example.spec)))).toEqual(plot);
    },
  );

  it('summarises long data when displaying a spec', () => {
    const text = displaySpec(examples[3]?.spec ?? { width: 1, height: 1, marks: [] });
    expect(text).toContain('more rows');
    expect(text.length).toBeLessThan(4_000);
  });
});
