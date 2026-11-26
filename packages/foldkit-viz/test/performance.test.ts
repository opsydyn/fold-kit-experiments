import { describe, expect, it } from 'bun:test';

import { columnTable, compilePlot, highlightPoints, indexPlot } from '../src/plot';
import type { PlotGeometry, PlotSpec } from '../src/plot';

/**
 * Time budgets for a million-row chart. Each budget is about ten times the
 * time on a 2024 laptop (compile ~105 ms, index ~20 ms, 1,000 queries ~18 ms,
 * highlight ~5 ms, bin ~30 ms), so they catch an accidental quadratic step or
 * a per-row allocation without failing on a slower CI runner. Each takes the
 * best of three runs, after the first warms the JIT.
 */

const ROWS = 1_000_000;
const rows = Array.from({ length: ROWS }, (_, i) => ({
  x: (i * 7919) % 100_003,
  y: Math.sin(i) * 1000,
}));
const dense: PlotSpec = {
  width: 800,
  height: 400,
  data: rows,
  marks: [{ mark: 'dot', x: 'x', y: 'y', dense: true }],
};

interface Timed<A> {
  readonly ms: number;
  readonly result: A;
}

function bestOf<A>(run: () => A): Timed<A> {
  let best = Infinity;
  let result = run();
  for (let attempt = 0; attempt < 3; attempt++) {
    const start = performance.now();
    result = run();
    best = Math.min(best, performance.now() - start);
  }
  return { ms: best, result };
}

const packedCount = (geometry: PlotGeometry): number =>
  (geometry.facets[0]?.marks[0]?.graphics ?? []).reduce(
    (total, graphic) => total + (graphic.kind === 'points' ? graphic.count : 0),
    0,
  );

describe('a million rows', () => {
  const compiled = bestOf(() => compilePlot(dense));

  it('compiles a dense scatter within 1.5 s', () => {
    expect(packedCount(compiled.result)).toBe(ROWS);
    expect(compiled.ms).toBeLessThan(1500);
  });

  it('compiles the same scatter from a column table within 1.5 s, building no rows', () => {
    const xs = Float64Array.from(rows, (row) => row.x);
    const ys = Float64Array.from(rows, (row) => row.y);
    // A fresh table each run, so every run pays for reading the typed columns.
    const fromColumns = bestOf(() =>
      compilePlot({ ...dense, data: columnTable({ x: xs, y: ys }) }),
    );
    expect(packedCount(fromColumns.result)).toBe(ROWS);
    expect(fromColumns.ms).toBeLessThan(1500);
  });

  it('indexes it within 300 ms, and answers 1,000 queries within 300 ms', () => {
    const indexed = bestOf(() => indexPlot(compiled.result));
    expect(indexed.result.size).toBe(ROWS);
    expect(indexed.ms).toBeLessThan(300);
    const queries = bestOf(() => {
      let hits = 0;
      for (let i = 0; i < 1000; i++) if (indexed.result.nearest(i % 800, (i * 7) % 400)) hits++;
      return hits;
    });
    expect(queries.result).toBeGreaterThan(0);
    expect(queries.ms).toBeLessThan(300);
  });

  it('restyles a highlight within 200 ms', () => {
    const highlighted = bestOf(() =>
      highlightPoints(compiled.result, 0, rows, { field: 'x', range: [100, 50_000] }),
    );
    expect(highlighted.result).not.toBe(compiled.result);
    expect(highlighted.ms).toBeLessThan(200);
  });

  it('bins it into a histogram within 500 ms', () => {
    const binned = bestOf(() =>
      compilePlot({
        width: 800,
        height: 400,
        data: rows,
        marks: [{ mark: 'rect', x: 'x', transform: { type: 'bin', thresholds: 50 } }],
      }),
    );
    const bars = binned.result.facets[0]?.marks[0]?.graphics ?? [];
    expect(bars.length).toBeGreaterThan(40);
    expect(binned.ms).toBeLessThan(500);
  });
});

it('compiles a 40,000-row grouped line with downsampling within 500 ms', () => {
  const series = Array.from({ length: 40_000 }, (_, x) => ({
    x,
    y: Math.sin(x / 100),
    group: x % 10 === 0 ? 'secondary' : 'primary',
  }));
  const { ms, result } = bestOf(() =>
    compilePlot({
      width: 800,
      height: 400,
      data: series,
      color: { domain: ['secondary', 'primary'], range: ['#000', '#fff'] },
      marks: [
        {
          mark: 'line',
          x: 'x',
          y: 'y',
          stroke: 'group',
          z: 'group',
          transform: { type: 'downsample', method: 'm4' },
        },
      ],
    }),
  );
  expect(
    result.facets[0]?.marks[0]?.graphics.map((graphic) =>
      graphic.kind === 'path' ? graphic.stroke : undefined,
    ),
  ).toEqual(['#000', '#fff']);
  expect(ms).toBeLessThan(500);
});
