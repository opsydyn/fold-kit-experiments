import { describe, expect, it } from 'bun:test';

import { lineGeometry, scatterGeometry, histogramGeometry } from '../src/chart/cartesian.js';
import type { ChartFrame, CartesianConfig, DatumAccessors } from '../src/chart/cartesian.js';

type Sample = Readonly<{ id: string; x: number; y: number; group: string }>;
const frame: ChartFrame = {
  width: 200,
  height: 100,
  margins: { top: 0, right: 0, bottom: 0, left: 0 },
};
const accessors: DatumAccessors<Sample> = {
  x: (d) => d.x,
  y: (d) => d.y,
  datumKey: (d) => d.id,
  seriesKey: (d) => d.group,
};
const sample = (id: string, x: number, y: number, group = 'a'): Sample => ({ id, x, y, group });
const data = [sample('one', 0, -10), sample('two', 5, 0), sample('three', 10, 10)];
const config: CartesianConfig = { frame, xDomain: [0, 10], yDomain: [-10, 10] };

describe('Cartesian geometry', () => {
  it('projects custom data and retains datum identity', () => {
    const chart = scatterGeometry(data, accessors, config);
    expect(chart.points.map((p) => [p.x, p.y])).toEqual([
      [0, 100],
      [100, 50],
      [200, 0],
    ]);
    expect(chart.points[1]?.datum).toBe(data[1]);
    expect(chart.points.map((p) => p.key)).toEqual(['one', 'two', 'three']);
    expect(chart.yTicks.find((t) => t.value === 0)?.position).toBe(50);
  });
  it('builds ordered line paths through projected points', () => {
    expect(lineGeometry(data, accessors, config).series[0]?.path).toBe('M0,100L100,50L200,0');
  });
  it('honours custom frame margins', () => {
    const chart = scatterGeometry(data, accessors, {
      ...config,
      frame: { width: 240, height: 140, margins: { left: 20, right: 20, top: 20, bottom: 20 } },
    });
    expect(chart.points.map((p) => [p.x, p.y])).toEqual([
      [20, 120],
      [120, 70],
      [220, 20],
    ]);
  });
  it('reverses explicit domains without changing datum order', () => {
    const chart = scatterGeometry(data, accessors, { ...config, xDomain: [10, 0] });
    expect(chart.points.map((p) => p.x)).toEqual([200, 100, 0]);
    expect(chart.xTicks.map((t) => t.value)).toEqual([10, 8, 6, 4, 2, 0]);
  });
  it('projects explicit equal domains to the midpoint', () => {
    const chart = lineGeometry([sample('only', 5, 2)], accessors, {
      frame,
      xDomain: [5, 5],
      yDomain: [2, 2],
    });
    expect(chart.points.map((p) => [p.x, p.y])).toEqual([[100, 50]]);
    expect(chart.series[0]?.path).not.toMatch(/NaN|Infinity/);
    expect(chart.xTicks).toEqual([{ value: 5, position: 100 }]);
  });
  it('returns finite default axes and no marks for empty data', () => {
    const chart = lineGeometry([], accessors, { frame });
    expect(chart.points).toEqual([]);
    expect(chart.series).toEqual([]);
    expect(chart.layout.xDomain).toEqual([0, 1]);
    expect(chart.layout.yDomain).toEqual([0, 1]);
  });
  it('expands automatic constant domains before projection', () => {
    const chart = scatterGeometry([sample('only', 0, 20)], accessors, { frame });
    expect(chart.layout.xDomain).toEqual([-1, 1]);
    expect(chart.layout.yDomain).toEqual([18, 22]);
    expect(chart.points.map((p) => [p.x, p.y])).toEqual([[100, 50]]);
  });
  it('includes negative extrema and adds zero only when requested', () => {
    const negative = [sample('one', -8, -10), sample('two', -2, -4)];
    expect(scatterGeometry(negative, accessors, { frame }).layout.xDomain).toEqual([-8, -2]);
    expect(
      scatterGeometry(negative, accessors, { frame, includeZero: { x: true, y: true } }).layout
        .yDomain,
    ).toEqual([-10, 0]);
  });
  it('preserves gaps and groups line paths by stable series key', () => {
    const chart = lineGeometry(
      [
        sample('a1', 0, -10),
        sample('b1', 0, 0, 'b'),
        sample('gap', 5, NaN),
        sample('a2', 10, 10),
        sample('b2', 10, 0, 'b'),
      ],
      accessors,
      config,
    );
    expect(chart.series.map((s) => s.key)).toEqual(['a', 'b']);
    expect(chart.series[0]?.path.match(/M/g)?.length).toBe(2);
    expect(chart.series[1]?.path).toBe('M0,50L200,50');
    expect(chart.points.map((p) => p.key)).toEqual(['a1', 'b1', 'a2', 'b2']);
  });
  it('uses the defined predicate to break paths and exclude samples from auto extents', () => {
    const chart = lineGeometry(
      [sample('a', 0, 0), sample('gap', 5, 1000), sample('b', 10, 10)],
      accessors,
      { frame, defined: (d) => d.id !== 'gap' },
    );
    expect(chart.layout.yDomain).toEqual([0, 10]);
    expect(chart.series[0]?.path.match(/M/g)?.length).toBe(2);
  });
  it('rejects ambiguous datum keys even on excluded samples', () => {
    expect(() =>
      scatterGeometry([sample('dup', 0, 0), sample('dup', 1, NaN)], accessors, config),
    ).toThrow(/duplicate.*key/i);
  });
  it('rejects invalid plot dimensions and negative margins', () => {
    for (const invalid of [
      { ...frame, width: NaN },
      { ...frame, height: 0 },
      { ...frame, margins: { ...frame.margins, left: 201 } },
      { ...frame, margins: { ...frame.margins, top: -1 } },
    ]) {
      expect(() => scatterGeometry(data, accessors, { ...config, frame: invalid })).toThrow(
        /frame|margin|plot/i,
      );
    }
  });
  it('rejects non-finite domains and invalid tick counts', () => {
    expect(() => scatterGeometry(data, accessors, { ...config, xDomain: [0, Infinity] })).toThrow(
      /domain/i,
    );
    for (const count of [0, 1, 2.5, Infinity])
      expect(() => scatterGeometry(data, accessors, { ...config, xTickCount: count })).toThrow(
        /tick/i,
      );
  });
  it('rejects derived coordinate overflow instead of emitting invalid SVG', () => {
    expect(() =>
      scatterGeometry([sample('huge', 1e308, 0)], accessors, { ...config, xDomain: [0, 1e-308] }),
    ).toThrow(/finite|coordinate|domain/i);
  });
});

describe('histogram geometry', () => {
  it('makes exactly the requested intervals and includes the final endpoint', () => {
    const chart = histogramGeometry([0, 2, 5, 10], (n) => n, {
      frame,
      domain: [0, 10],
      binCount: 2,
    });
    expect(chart.bins.map((b) => b.count)).toEqual([2, 2]);
    expect(chart.bins.map((b) => [b.x0, b.x1])).toEqual([
      [0, 5],
      [5, 10],
    ]);
    expect(chart.bins.map((b) => [b.x, b.y, b.width, b.height])).toEqual([
      [0, 0, 100, 100],
      [100, 0, 100, 100],
    ]);
  });
  it('retains raw data and stable interval identities with explicit thresholds', () => {
    const chart = histogramGeometry(
      [{ amount: -5 }, { amount: 0 }, { amount: 5 }],
      (d) => d.amount,
      { frame, domain: [-5, 5], thresholds: [0] },
    );
    expect(chart.bins.map((b) => b.count)).toEqual([1, 2]);
    expect(chart.bins.map((b) => b.key)).toEqual(['-5:0', '0:5']);
    expect(chart.bins[0]?.values).toEqual([{ amount: -5 }]);
  });
  it('supports reversed X domains with positive bar dimensions', () => {
    const chart = histogramGeometry([0, 10], (n) => n, { frame, domain: [10, 0], binCount: 2 });
    expect(chart.bins.map((b) => [b.x, b.width])).toEqual([
      [100, 100],
      [0, 100],
    ]);
  });
  it('excludes non-finite values and preserves empty marks', () => {
    expect(histogramGeometry([NaN, Infinity], (n) => n, { frame, binCount: 2 }).bins).toEqual([]);
    expect(
      histogramGeometry([0, NaN, 10, Infinity], (n) => n, {
        frame,
        domain: [0, 10],
        binCount: 2,
      }).bins.map((b) => b.count),
    ).toEqual([1, 1]);
  });
  it('expands automatic constants and clamps gaps to narrow bins', () => {
    const chart = histogramGeometry([0, 0], (n) => n, { frame, binCount: 2, gap: 200 });
    expect(chart.layout.xDomain).toEqual([-1, 1]);
    expect(chart.bins.map((b) => b.width)).toEqual([0, 0]);
    expect(chart.bins.map((b) => b.height).every(Number.isFinite)).toBe(true);
  });
  it('rejects invalid bin policies, gaps and thresholds', () => {
    for (const count of [0, -1, 1.5, Infinity])
      expect(() => histogramGeometry([0], (n) => n, { frame, binCount: count })).toThrow(/bin/i);
    expect(() => histogramGeometry([0], (n) => n, { frame, binCount: 2, gap: -1 })).toThrow(/gap/i);
    expect(() => histogramGeometry([0], (n) => n, { frame, thresholds: [1, NaN] })).toThrow(
      /threshold/i,
    );
    expect(() => histogramGeometry([0], (n) => n, { frame, thresholds: [2, 1] })).toThrow(
      /threshold/i,
    );
  });
});
