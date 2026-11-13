import { describe, expect, it } from 'bun:test';

import { resolveDomain } from '../src/chart/layout';
import { compilePlot } from '../src/plot';
import type { Graphic, PlotSpec } from '../src/plot';

const base = {
  width: 400,
  height: 200,
  margins: { top: 0, right: 0, bottom: 0, left: 0 },
} as const;
const points = (spec: PlotSpec): Extract<Graphic, { kind: 'points' }> | undefined => {
  const [g] = compilePlot(spec).facets[0]?.marks[0]?.graphics ?? [];
  return g?.kind === 'points' ? g : undefined;
};

describe('dense dot marks', () => {
  const rows = [
    { x: 0, y: 0, g: 'a' },
    { x: 1, y: 1, g: 'b' },
    { x: 2, y: null, g: 'a' },
    { x: 2, y: 2, g: 'b' },
  ];

  it('pack positions into typed arrays, skipping rows that cannot be placed', () => {
    const packed = points({
      ...base,
      data: rows,
      marks: [{ mark: 'dot', x: 'x', y: 'y', dense: true }],
    });
    expect(packed?.count).toBe(3);
    expect([...(packed?.xs ?? [])]).toEqual([0, 200, 400]);
    expect([...(packed?.ys ?? [])]).toEqual([200, 100, 0]);
    // Each point remembers its row, so a hit can name it.
    expect([...(packed?.rows ?? [])]).toEqual([0, 1, 3]);
  });

  it('colour points through a small palette of indices', () => {
    const packed = points({
      ...base,
      data: rows,
      marks: [{ mark: 'dot', x: 'x', y: 'y', fill: 'g', dense: true }],
    });
    expect(packed?.palette).toHaveLength(2);
    expect([...(packed?.paint ?? [])]).toEqual([0, 1, 1]);
  });

  it('compile a million rows', () => {
    const n = 1_000_000;
    const big = Array.from({ length: n }, (_, i) => ({ x: Math.sin(i), y: Math.cos(i * 1.3) }));
    const started = performance.now();
    const packed = points({
      ...base,
      data: big,
      marks: [{ mark: 'dot', x: 'x', y: 'y', dense: true }],
    });
    const elapsed = performance.now() - started;
    expect(packed?.count).toBe(n);
    expect(elapsed).toBeLessThan(5_000);
  });
});

it('resolves domains of a million values without overflowing the stack', () => {
  const values = Array.from({ length: 1_000_000 }, (_, i) => i + 1);
  expect(resolveDomain(values, undefined, false, { type: 'log' })).toEqual([1, 1_000_000]);
});
