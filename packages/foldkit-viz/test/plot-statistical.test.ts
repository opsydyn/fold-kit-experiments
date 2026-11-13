import { describe, expect, it } from 'bun:test';

import { boxStats } from '../src/math/stats';
import { compilePlot } from '../src/plot';
import type { Graphic, PlotSpec } from '../src/plot';

const base = {
  width: 300,
  height: 200,
  margins: { top: 0, right: 0, bottom: 0, left: 0 },
} as const;
const graphics = (spec: PlotSpec, mark = 0): ReadonlyArray<Graphic> =>
  compilePlot(spec).facets[0]?.marks[mark]?.graphics ?? [];
const groups = [
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 40].map((v) => ({ level: 'IC1', pay: v })),
  ...[10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map((v) => ({ level: 'IC2', pay: v })),
];

describe('box marks', () => {
  const spec: PlotSpec = { ...base, data: groups, marks: [{ mark: 'box', x: 'level', y: 'pay' }] };

  it('draw a whisker, a box, a median and outliers per group', () => {
    const drawn = graphics(spec);
    const ic1 = drawn.filter((g) => g.key.startsWith('IC1:'));
    expect(ic1.map((g) => g.key)).toEqual([
      'IC1:whisker',
      'IC1:box',
      'IC1:median',
      'IC1:outlier:0',
    ]);
    expect(drawn.filter((g) => g.key.startsWith('IC2:')).map((g) => g.kind)).toEqual([
      'line',
      'rect',
      'line',
    ]);
  });

  it('place the box from the first to the third quartile, titled with the summary', () => {
    const stats = boxStats([1, 2, 3, 4, 5, 6, 7, 8, 9, 40]);
    const plot = compilePlot(spec);
    const box = plot.facets[0]?.marks[0]?.graphics.find((g) => g.key === 'IC1:box');
    const y = (v: number) => 200 - ((v - 1) / 39) * 200;
    expect(box?.kind === 'rect' && [box.y, box.y + box.height]).toEqual([y(stats.q3), y(stats.q1)]);
    expect(box?.title).toBe(`IC1: median ${stats.median}, quartiles ${stats.q1}–${stats.q3}`);
  });

  it('lie horizontally when the band axis is y', () => {
    const drawn = graphics({
      ...base,
      data: groups,
      marks: [{ mark: 'box', x: 'pay', y: 'level' }],
    });
    const whisker = drawn[0];
    expect(whisker?.kind === 'line' && whisker.y1 === whisker.y2).toBe(true);
  });
});

describe('violin marks', () => {
  it('draw one symmetric closed outline and a median per group', () => {
    const drawn = graphics({
      ...base,
      data: groups,
      marks: [{ mark: 'violin', x: 'level', y: 'pay' }],
    });
    expect(drawn.map((g) => g.key)).toEqual([
      'IC1:violin',
      'IC1:median',
      'IC2:violin',
      'IC2:median',
    ]);
    const outline = drawn[2];
    expect(outline?.kind === 'path' && outline.d.endsWith('Z')).toBe(true);
  });

  it('reject a non-positive bandwidth', () => {
    expect(() =>
      compilePlot({
        ...base,
        data: groups,
        marks: [{ mark: 'violin', x: 'level', y: 'pay', bandwidth: 0 }],
      }),
    ).toThrow('marks[0].bandwidth');
  });
});

describe('candlestick pieces', () => {
  const candles = [
    { day: 'Apr 1', open: 10, close: 12, low: 9, high: 13, move: 'up' },
    { day: 'Apr 2', open: 12, close: 11, low: 10, high: 12.5, move: 'down' },
  ];
  const spec: PlotSpec = {
    ...base,
    data: candles,
    color: { domain: ['up', 'down'], range: ['green', 'red'], legend: false },
    marks: [
      { mark: 'link', x1: 'day', y1: 'low', y2: 'high', stroke: 'move' },
      { mark: 'bar', x: 'day', y: 'close', y0: 'open', fill: 'move' },
    ],
  };

  it('draw wicks as links and bodies as interval bars, not reaching down to zero', () => {
    const plot = compilePlot(spec);
    expect(plot.facets[0]?.y?.domain).toEqual([9, 13]);
    const [wick] = plot.facets[0]?.marks[0]?.graphics ?? [];
    expect(wick?.kind === 'line' && wick.x1 === wick.x2).toBe(true);
    const [, body] = plot.facets[0]?.marks[1]?.graphics ?? [];
    const y = (v: number) => 200 - ((v - 9) / 4) * 200;
    expect(body?.kind === 'rect' && [body.y, body.y + body.height]).toEqual([y(12), y(11)]);
  });

  it('take explicit colours for categories', () => {
    const plot = compilePlot(spec);
    const fills = (plot.facets[0]?.marks[1]?.graphics ?? []).map((g) =>
      g.kind === 'rect' ? g.fill : '',
    );
    expect(fills).toEqual(['green', 'red']);
  });

  it('reject an empty colour range', () => {
    expect(() => compilePlot({ ...spec, color: { range: [] } })).toThrow('color.range');
  });
});
