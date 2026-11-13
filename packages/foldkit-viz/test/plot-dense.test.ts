import { describe, expect, it } from 'bun:test';

import { resolveDomain } from '../src/chart/layout';
import { compilePlot, highlightPoints, indexPlot } from '../src/plot';
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

describe('packed rows under facets', () => {
  it("index the mark's full data, not the facet's share of it", () => {
    const plot = compilePlot({
      ...base,
      data: [
        { x: 0, y: 0, side: 'left' },
        { x: 1, y: 1, side: 'right' },
        { x: 2, y: 2, side: 'left' },
        { x: 3, y: 3, side: 'right' },
      ],
      facet: { x: 'side' },
      marks: [{ mark: 'dot', x: 'x', y: 'y', dense: true }],
    });
    const rowsOf = (facet: number) => {
      const [g] = plot.facets[facet]?.marks[0]?.graphics ?? [];
      return g?.kind === 'points' ? [...g.rows] : [];
    };
    expect(rowsOf(0)).toEqual([0, 2]);
    expect(rowsOf(1)).toEqual([1, 3]);
  });
});

describe('highlightPoints', () => {
  const data = Array.from({ length: 6 }, (_, i) => ({ x: i, y: i, kind: i < 3 ? 'low' : 'high' }));
  const spec: PlotSpec = {
    ...base,
    data,
    marks: [
      { mark: 'rule', y: { value: 2 } },
      { mark: 'dot', x: 'x', y: 'y', dense: true },
    ],
  };

  it('restyles a dense mark as compiling with the highlight would', () => {
    const plain = compilePlot(spec);
    const highlight = { field: 'x', range: [1, 3] } as const;
    const restyled = highlightPoints(plain, 1, data, highlight);
    const compiled = compilePlot({
      ...spec,
      marks: [
        { mark: 'rule', y: { value: 2 } },
        { mark: 'dot', x: 'x', y: 'y', dense: true, highlight },
      ],
    });
    expect(restyled).toEqual(compiled);
  });

  it('shares positions with the plain geometry, so its hover index stays valid', () => {
    const plain = compilePlot(spec);
    const index = indexPlot(plain);
    const restyled = highlightPoints(plain, 1, data, { field: 'kind', values: ['high'] });
    const [before] = plain.facets[0]?.marks[1]?.graphics ?? [];
    const [after] = restyled.facets[0]?.marks[1]?.graphics ?? [];
    expect(after?.kind === 'points' ? after.xs : undefined).toBe(
      before?.kind === 'points' ? before.xs : undefined,
    );
    expect(index.nearest(400, 0)?.row).toBe(5);
    expect(restyled.facets[0]?.marks[0]).toBe(plain.facets[0]?.marks[0]);
  });

  it('clears the highlight when given none', () => {
    const plain = compilePlot(spec);
    const restyled = highlightPoints(plain, 1, data, { field: 'kind', values: ['high'] });
    expect(highlightPoints(restyled, 1, data, undefined)).toEqual(plain);
  });

  it('names the mark when it has no packed points to restyle', () => {
    expect(() => highlightPoints(compilePlot(spec), 0, data, undefined)).toThrow(
      'marks[0]: highlightPoints restyles dense dot marks only',
    );
  });
});

it('resolves domains of a million values without overflowing the stack', () => {
  const values = Array.from({ length: 1_000_000 }, (_, i) => i + 1);
  expect(resolveDomain(values, undefined, false, { type: 'log' })).toEqual([1, 1_000_000]);
});
