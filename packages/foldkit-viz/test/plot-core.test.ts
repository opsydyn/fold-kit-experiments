import { describe, expect, it } from 'bun:test';

import { compilePlot } from '../src/plot';
import type { PlotSpec, Graphic } from '../src/plot';

const rows = [
  { id: 'a', dose: 1, response: 2, group: 'control' },
  { id: 'b', dose: 2, response: 4, group: 'control' },
  { id: 'c', dose: 3, response: 3, group: 'treated' },
];
const base = {
  width: 400,
  height: 300,
  margins: { top: 0, right: 0, bottom: 0, left: 0 },
} as const;
const graphics = (spec: PlotSpec, mark = 0): ReadonlyArray<Graphic> =>
  compilePlot(spec).facets[0]?.marks[mark]?.graphics ?? [];

describe('dot marks and inferred scales', () => {
  const spec: PlotSpec = {
    ...base,
    data: rows,
    marks: [{ mark: 'dot', x: 'dose', y: 'response', key: 'id', title: 'group' }],
  };

  it('infers linear domains from the data and places a circle per row', () => {
    const plot = compilePlot(spec);
    const facet = plot.facets[0];
    expect(facet?.x?.domain).toEqual([1, 3]);
    expect(facet?.y?.domain).toEqual([2, 4]);
    const circles = graphics(spec);
    expect(circles.map((s) => s.kind)).toEqual(['circle', 'circle', 'circle']);
    expect(circles.map((s) => (s.kind === 'circle' ? [s.cx, s.cy] : []))).toEqual([
      [0, 300],
      [200, 0],
      [400, 150],
    ]);
    expect(circles.map((s) => s.key)).toEqual(['a', 'b', 'c']);
    expect(circles.map((s) => s.title)).toEqual(['control', 'control', 'treated']);
  });

  it('labels axes with the field names and ticks with the scale', () => {
    const facet = compilePlot(spec).facets[0];
    expect(facet?.x?.label).toBe('dose');
    expect(facet?.y?.label).toBe('response');
    expect(facet?.y?.ticks.map((t) => t.label)).toEqual(['2.0', '2.5', '3.0', '3.5', '4.0']);
  });

  it('leaves room for axes when margins are not given', () => {
    const plot = compilePlot({
      width: 400,
      height: 300,
      data: rows,
      marks: [{ mark: 'dot', x: 'dose', y: 'response' }],
    });
    const bounds = plot.facets[0]?.plot;
    expect(bounds?.left).toBeGreaterThan(20);
    expect(bounds?.bottom).toBeLessThan(280);
  });

  it('places strings on a band axis, at band centres, in first-seen order', () => {
    const facet = compilePlot({
      ...base,
      data: rows,
      marks: [{ mark: 'dot', x: 'group', y: 'response' }],
    }).facets[0];
    expect(facet?.x?.type).toBe('band');
    expect(facet?.x?.domain).toEqual(['control', 'treated']);
    const [first, , third] = facet?.marks[0]?.graphics ?? [];
    expect(first?.kind === 'circle' && third?.kind === 'circle' && third.cx > first.cx).toBe(true);
  });

  it('reads ISO dates as a UTC time axis', () => {
    const facet = compilePlot({
      ...base,
      x: { ticks: 3 },
      marks: [
        {
          mark: 'dot',
          data: [
            { t: '2026-11-13T09:00:00Z', v: 1 },
            { t: '2026-11-13T12:00:00Z', v: 2 },
          ],
          x: 't',
          y: 'v',
        },
      ],
    }).facets[0];
    expect(facet?.x?.type).toBe('time');
    expect(facet?.x?.ticks.map((t) => t.label)).toEqual(['09:00', '10:00', '11:00', '12:00']);
  });

  it('honours explicit scale settings', () => {
    const facet = compilePlot({
      ...spec,
      y: { type: 'log', label: 'Response (log)', domain: [1, 10] },
    }).facets[0];
    expect(facet?.y?.type).toBe('log');
    expect(facet?.y?.label).toBe('Response (log)');
    expect(facet?.y?.ticks.map((t) => t.label)).toEqual(['1', '10']);
  });

  it('takes constants as channels', () => {
    const [circle] = graphics({
      ...base,
      data: rows,
      marks: [
        { mark: 'dot', x: 'dose', y: { value: 3 }, r: { value: 6 }, fill: { value: 'tomato' } },
      ],
    });
    expect(circle).toMatchObject({ kind: 'circle', r: 6, fill: 'tomato', cy: 150 });
  });

  it('compiles the same after a JSON round trip', () => {
    const copy: PlotSpec = JSON.parse(JSON.stringify(spec));
    expect(compilePlot(copy)).toEqual(compilePlot(spec));
  });
});

describe('line marks', () => {
  it('draws one path per series, breaking at missing values', () => {
    const data = [
      { x: 0, y: 1, s: 'a' },
      { x: 1, y: null, s: 'a' },
      { x: 2, y: 3, s: 'a' },
      { x: 3, y: 4, s: 'a' },
      { x: 0, y: 2, s: 'b' },
      { x: 3, y: 1, s: 'b' },
    ];
    const paths = graphics({ ...base, data, marks: [{ mark: 'line', x: 'x', y: 'y', z: 's' }] });
    expect(paths.map((p) => p.kind)).toEqual(['path', 'path']);
    expect(paths.map((p) => p.key)).toEqual(['a', 'b']);
    const first = paths[0];
    expect(first?.kind === 'path' ? first.d.match(/M/g)?.length : 0).toBe(2);
  });
});

describe('hidden axes', () => {
  it('blank tick labels and grid but keep tick positions for inverting', () => {
    const plot = compilePlot({
      ...base,
      x: { axis: false },
      data: [
        { c: 'a', v: 1 },
        { c: 'b', v: 2 },
      ],
      marks: [{ mark: 'cell', x: 'c', y: { value: 'row' } }],
    });
    const x = plot.facets[0]?.x;
    expect(x?.ticks.map((t) => t.label)).toEqual(['', '']);
    expect(x?.ticks.map((t) => t.value)).toEqual(['a', 'b']);
    expect(x?.grid).toBe(false);
  });
});

describe('errors name the spec path', () => {
  it.each([
    ['an unknown mark', { ...base, marks: [{ mark: 'blob', x: 'a', y: 'b' }] }, 'marks[0].mark'],
    [
      'a missing field',
      { ...base, data: rows, marks: [{ mark: 'dot', x: 'dosage', y: 'response' }] },
      'marks[0].x: field "dosage"',
    ],
    [
      'a missing required channel',
      { ...base, data: rows, marks: [{ mark: 'dot', x: 'dose' }] },
      'marks[0].y',
    ],
    ['no marks', { ...base, marks: [] }, 'marks'],
    ['a non-positive size', { width: 0, height: 10, marks: [] }, 'width'],
    [
      'numbers on a band axis',
      {
        ...base,
        x: { type: 'band' },
        data: rows,
        marks: [{ mark: 'dot', x: 'dose', y: 'response' }],
      },
      'x',
    ],
  ])('rejects %s', (_, spec, path) => {
    // A spec arrives as JSON, so the invalid ones are parsed as any JSON would be.
    const parsed: PlotSpec = JSON.parse(JSON.stringify(spec));
    expect(() => compilePlot(parsed)).toThrow(path);
  });
});
