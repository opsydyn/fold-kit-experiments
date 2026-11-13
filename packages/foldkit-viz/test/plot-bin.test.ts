import { describe, expect, it } from 'bun:test';

import { compilePlot } from '../src/plot';
import type { Graphic, PlotSpec } from '../src/plot';

const base = {
  width: 400,
  height: 200,
  margins: { top: 0, right: 0, bottom: 0, left: 0 },
} as const;
const latencies = [1, 2, 2, 3, 3, 3, 4, 4, 9].map((ms, i) => ({
  ms,
  load: i % 3,
  tier: i < 5 ? 'web' : 'api',
}));
const rects = (spec: PlotSpec) =>
  (compilePlot(spec).facets[0]?.marks[0]?.graphics ?? []).flatMap((g: Graphic) =>
    g.kind === 'rect' ? [g] : [],
  );
/** A mark as raw JSON, before compilePlot has checked it. */
type JsonValue = string | number | boolean | null | ReadonlyArray<JsonValue> | JsonMark;
type JsonMark = Readonly<{ [key: string]: JsonValue }>;

describe('rect mark', () => {
  it('spans x1 to x2 and y1 to y2 on continuous axes', () => {
    const [cell] = rects({
      ...base,
      x: { domain: [0, 10] },
      y: { domain: [0, 10] },
      data: [{ a: 2, b: 4, c: 1, d: 3 }],
      marks: [{ mark: 'rect', x1: 'a', x2: 'b', y1: 'c', y2: 'd' }],
    });
    expect(cell).toMatchObject({ x: 80, width: 80, y: 140, height: 40 });
  });

  it('starts at the baseline when y1 is missing', () => {
    const plot = compilePlot({
      ...base,
      data: [{ a: 2, b: 4, d: 3 }],
      marks: [{ mark: 'rect', x1: 'a', x2: 'b', y2: 'd' }],
    });
    expect(plot.facets[0]?.y?.domain[0]).toBe(0);
    const [cell] = plot.facets[0]?.marks[0]?.graphics ?? [];
    expect(cell?.kind === 'rect' ? cell.y + cell.height : 0).toBe(200);
  });

  it('insets each rectangle on both sides of x', () => {
    const [plain] = rects({
      ...base,
      data: [{ a: 2, b: 4, d: 3 }],
      marks: [{ mark: 'rect', x1: 'a', x2: 'b', y2: 'd' }],
    });
    const [inset] = rects({
      ...base,
      data: [{ a: 2, b: 4, d: 3 }],
      marks: [{ mark: 'rect', x1: 'a', x2: 'b', y2: 'd', inset: 1 }],
    });
    expect(inset?.x).toBe((plain?.x ?? 0) + 1);
    expect(inset?.width).toBe((plain?.width ?? 0) - 2);
  });
});

describe('bin transform', () => {
  it('turns raw values into a histogram of counts on shared thresholds', () => {
    const spec: PlotSpec = {
      ...base,
      data: latencies,
      marks: [{ mark: 'rect', x: 'ms', transform: { type: 'bin', thresholds: [2, 4, 6, 8] } }],
    };
    const plot = compilePlot(spec);
    const bars = rects(spec);
    expect(bars).toHaveLength(5);
    expect(plot.facets[0]?.y?.label).toBe('count');
    expect(plot.facets[0]?.x?.label).toBe('ms');
    // Counts per bin: [1, 2) 1, [2, 4) 5, [4, 6) 2, [6, 8) 0, [8, 9] 1.
    const heights = bars.map((b) => b.height);
    const unit = (heights[0] ?? 0) / 1;
    expect(heights.map((h) => Math.round(h / unit))).toEqual([1, 5, 2, 0, 1]);
  });

  it('reduces to proportions when asked, and keeps the count for titles', () => {
    const plot = compilePlot({
      ...base,
      data: latencies,
      marks: [
        {
          mark: 'rect',
          x: 'ms',
          title: 'count',
          transform: { type: 'bin', thresholds: [5], reduce: 'proportion' },
        },
      ],
    });
    expect(plot.facets[0]?.y?.label).toBe('proportion');
    const titles = (plot.facets[0]?.marks[0]?.graphics ?? []).map((g) => g.title);
    expect(titles).toEqual(['8', '1']);
    const [lo, hi] = plot.facets[0]?.y?.domain ?? [];
    expect(lo).toBe(0);
    expect(Number(hi)).toBeGreaterThanOrEqual(8 / 9);
  });

  it('bins each series on the same thresholds', () => {
    const bars = rects({
      ...base,
      data: latencies,
      marks: [
        {
          mark: 'rect',
          x: 'ms',
          fill: 'tier',
          opacity: 0.5,
          transform: { type: 'bin', thresholds: [5] },
        },
      ],
    });
    expect(bars).toHaveLength(4);
    const edges = new Set(bars.map((b) => `${b.x}:${b.width}`));
    expect(edges.size).toBe(2);
  });

  it('bins x and y into a two-dimensional histogram, with count for colour', () => {
    const spec: PlotSpec = {
      ...base,
      data: latencies,
      marks: [
        {
          mark: 'rect',
          x: 'ms',
          y: 'load',
          fill: 'count',
          transform: { type: 'bin', thresholds: 4 },
        },
      ],
    };
    const plot = compilePlot(spec);
    const cells = rects(spec);
    expect(cells.length).toBeGreaterThan(0);
    expect(cells.length).toBeLessThanOrEqual(16);
    expect(plot.legends[0]?.kind).toBe('continuous');
    expect(plot.facets[0]?.y?.label).toBe('load');
    const total = cells.length;
    expect(total).toBe(new Set(cells.map((c) => `${c.x},${c.y}`)).size);
  });

  it('names the spec path for misplaced channels and bad options', () => {
    const bad = (mark: JsonMark) => {
      // A spec arrives as JSON, so the invalid ones are parsed as any JSON would be.
      const parsed: PlotSpec = JSON.parse(
        JSON.stringify({ ...base, data: latencies, marks: [mark] }),
      );
      return () => compilePlot(parsed);
    };
    expect(bad({ mark: 'rect', x1: 'ms' })).toThrow('marks[0].x2: a rect mark needs x2');
    expect(bad({ mark: 'rect', x: 'ms', x1: 'ms', x2: 'ms', y2: 'ms' })).toThrow(
      'marks[0].x: a rect mark takes x and y only to bin them',
    );
    expect(bad({ mark: 'rect', x: 'ms', x1: 'ms', transform: { type: 'bin' } })).toThrow(
      'marks[0].x1: a binned rect mark computes x1',
    );
    expect(bad({ mark: 'rect', x: 'ms', transform: { type: 'bin', reduce: 'mean' } })).toThrow(
      'marks[0].transform.reduce: unknown reducer "mean"',
    );
    expect(
      bad({ mark: 'rect', x: 'ms', y: 'load', transform: { type: 'bin', thresholds: [1, 2] } }),
    ).toThrow('marks[0].transform.thresholds: two-dimensional bins take a count');
    expect(bad({ mark: 'dot', x: 'ms', y: 'load', transform: { type: 'bin' } })).toThrow(
      'marks[0].transform',
    );
  });
});
