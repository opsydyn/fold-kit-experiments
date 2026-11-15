import { describe, expect, it } from 'bun:test';

import { tableau10 } from '../src/math/schemes';
import { compilePlot, indexPlot } from '../src/plot';
import type { Graphic, PlotSpec } from '../src/plot';
import { symbolPath } from '../src/shape/symbol';

const base = {
  width: 300,
  height: 200,
  margins: { top: 0, right: 0, bottom: 0, left: 0 },
} as const;
const rows = [
  { x: 1, y: 1, kind: 'alpha' },
  { x: 2, y: 2, kind: 'beta' },
  { x: 3, y: 3, kind: 'gamma' },
  { x: 4, y: 4, kind: 'alpha' },
];
const graphics = (spec: PlotSpec): ReadonlyArray<Graphic> =>
  compilePlot(spec).facets[0]?.marks[0]?.graphics ?? [];
const [first = '', second = '', third = ''] = tableau10;

describe('symbol channel', () => {
  it('maps a field onto symbols in order, keeping circles as circles', () => {
    const drawn = graphics({
      ...base,
      data: rows,
      marks: [{ mark: 'dot', x: 'x', y: 'y', symbol: 'kind' }],
    });
    expect(drawn.map((g) => g.kind)).toEqual(['circle', 'path', 'path', 'circle']);
    const cross = drawn[1];
    expect(cross?.kind === 'path' ? cross.d : '').toBe(symbolPath('cross', Math.PI * 9));
    const plain = graphics({ ...base, data: rows, marks: [{ mark: 'dot', x: 'x', y: 'y' }] })[1];
    const centre = plain?.kind === 'circle' ? ([plain.cx, plain.cy] as const) : undefined;
    expect(cross?.kind === 'path' ? cross.translate : undefined).toEqual(centre);
  });

  it('sizes a symbol so its area matches a circle of the same radius', () => {
    const [square] = graphics({
      ...base,
      data: rows.slice(0, 1),
      marks: [{ mark: 'dot', x: 'x', y: 'y', r: { value: 5 }, symbol: { value: 'square' } }],
    });
    expect(square?.kind === 'path' ? square.d : '').toBe(symbolPath('square', Math.PI * 25));
  });

  it('takes the order or the symbols from the plot-level symbol scale', () => {
    const drawn = graphics({
      ...base,
      data: rows,
      symbol: { domain: ['gamma', 'beta', 'alpha'], range: ['star', 'wye', 'square'] },
      marks: [{ mark: 'dot', x: 'x', y: 'y', symbol: 'kind' }],
    });
    const ds = drawn.map((g) => (g.kind === 'path' ? g.d : g.kind));
    expect(ds).toEqual([
      symbolPath('square', Math.PI * 9),
      symbolPath('wye', Math.PI * 9),
      symbolPath('star', Math.PI * 9),
      symbolPath('square', Math.PI * 9),
    ]);
  });

  it('adds a symbol legend, merged with the colour legend when one field drives both', () => {
    const own = compilePlot({
      ...base,
      data: rows,
      marks: [{ mark: 'dot', x: 'x', y: 'y', symbol: 'kind' }],
    }).legends;
    expect(own).toEqual([
      {
        kind: 'symbol',
        label: 'kind',
        entries: [
          { key: 'alpha', label: 'alpha', symbol: 'circle', path: symbolPath('circle', 64) },
          { key: 'beta', label: 'beta', symbol: 'cross', path: symbolPath('cross', 64) },
          { key: 'gamma', label: 'gamma', symbol: 'diamond', path: symbolPath('diamond', 64) },
        ],
      },
    ]);
    const merged = compilePlot({
      ...base,
      data: rows,
      marks: [{ mark: 'dot', x: 'x', y: 'y', symbol: 'kind', fill: 'kind' }],
    }).legends;
    expect(merged).toHaveLength(1);
    expect(merged[0]?.kind === 'symbol' ? merged[0].entries.map((e) => e.color) : []).toEqual([
      first,
      second,
      third,
    ]);
  });

  it('keeps separate legends when colour and symbol encode different fields', () => {
    const legends = compilePlot({
      ...base,
      data: rows.map((r, i) => ({ ...r, group: i % 2 === 0 ? 'even' : 'odd' })),
      marks: [{ mark: 'dot', x: 'x', y: 'y', symbol: 'kind', fill: 'group' }],
    }).legends;
    expect(legends.map((l) => l.kind)).toEqual(['categorical', 'symbol']);
  });

  it('names the spec path for an unknown symbol or a symbol on a dense mark', () => {
    expect(() =>
      compilePlot({
        ...base,
        data: rows,
        marks: [{ mark: 'dot', x: 'x', y: 'y', symbol: { value: 'hexagon' } }],
      }),
    ).toThrow('marks[0].symbol: unknown symbol "hexagon"');
    // A spec arrives as JSON, so an invalid one is parsed as any JSON would be.
    const unknownRange: PlotSpec = JSON.parse(
      JSON.stringify({
        ...base,
        data: rows,
        symbol: { range: ['blob'] },
        marks: [{ mark: 'dot', x: 'x', y: 'y', symbol: 'kind' }],
      }),
    );
    expect(() => compilePlot(unknownRange)).toThrow('symbol.range[0]: unknown symbol "blob"');
    expect(() =>
      compilePlot({
        ...base,
        data: rows,
        marks: [{ mark: 'dot', x: 'x', y: 'y', symbol: 'kind', dense: true }],
      }),
    ).toThrow('marks[0].symbol: a dense dot mark draws circles only');
  });

  it('indexes symbols by their centre for hover', () => {
    const geometry = compilePlot({
      ...base,
      data: rows,
      marks: [{ mark: 'dot', x: 'x', y: 'y', symbol: 'kind' }],
    });
    const cross = geometry.facets[0]?.marks[0]?.graphics[1];
    const [cx = 0, cy = 0] = cross?.kind === 'path' ? (cross.translate ?? []) : [];
    expect(indexPlot(geometry).nearest(cx + 1, cy - 1, 5)?.key).toBe('0:1');
  });
});
