import { describe, expect, it } from 'bun:test';

import { layoutLegends } from '../src/plot/legend.js';
import type { LegendMark } from '../src/plot/legend.js';
import type { Legend } from '../src/plot/types.js';

const frame = { left: 8, top: 300, width: 400, labelSize: 11 };
const labels = (marks: ReadonlyArray<LegendMark>) =>
  marks.flatMap((m) => (m.kind === 'label' ? [m.text] : []));

const categorical = (n: number): Legend => ({
  kind: 'categorical',
  label: 'group',
  entries: Array.from({ length: n }, (_, i) => ({
    key: `k${i}`,
    label: `group ${i}`,
    color: `#00000${i % 10}`,
  })),
});

describe('layoutLegends', () => {
  it('takes no room when there are no legends', () => {
    expect(layoutLegends([], frame)).toEqual({ height: 0, marks: [] });
  });

  it('lays a categorical legend out as its title, then a swatch and label per entry', () => {
    const { marks, height } = layoutLegends([categorical(2)], frame);
    expect(labels(marks)).toEqual(['group', 'group 0', 'group 1']);
    expect(
      marks.filter((m) => m.kind === 'swatch').map((m) => m.kind === 'swatch' && m.color),
    ).toEqual(['#000000', '#000001']);
    expect(marks.find((m) => m.kind === 'label' && m.text === 'group')).toMatchObject({
      title: true,
    });
    expect(height).toBeGreaterThan(0);
    for (const m of marks) {
      expect(m.x).toBeGreaterThanOrEqual(frame.left);
      expect(m.y).toBeGreaterThanOrEqual(frame.top);
      expect(m.y).toBeLessThanOrEqual(frame.top + height);
    }
  });

  it('wraps entries onto new rows within the width, growing the height', () => {
    const one = layoutLegends([categorical(2)], frame);
    const many = layoutLegends([categorical(30)], frame);
    expect(many.height).toBeGreaterThan(one.height);
    const swatches = many.marks.filter((m) => m.kind === 'swatch');
    expect(new Set(swatches.map((m) => m.y)).size).toBeGreaterThan(1);
    for (const m of swatches)
      expect(m.x + (m.kind === 'swatch' ? m.size : 0)).toBeLessThanOrEqual(
        frame.left + frame.width,
      );
  });

  it('starts each legend on its own row', () => {
    const { marks } = layoutLegends([categorical(1), { ...categorical(1), label: 'other' }], frame);
    const titles = marks.filter((m) => m.kind === 'label' && m.title);
    expect(titles).toHaveLength(2);
    expect(titles[1]!.y).toBeGreaterThan(titles[0]!.y);
  });

  it('draws a continuous legend as its readable ends round a band of blended colours', () => {
    const legend: Legend = {
      kind: 'continuous',
      label: 'speed',
      domain: [1.23456, 9],
      stops: ['rgb(0,0,0)', 'rgb(100,100,100)', '#ffffff'],
    };
    const { marks } = layoutLegends([legend], frame);
    expect(labels(marks)).toEqual(['speed', '1.235', '9']);
    const bands = marks.filter((m) => m.kind === 'band');
    expect(bands.length).toBeGreaterThan(10);
    expect(bands[0]).toMatchObject({ color: 'rgb(0,0,0)' });
    expect(bands.at(-1)).toMatchObject({ color: 'rgb(255,255,255)' });
    // Contiguous, left to right.
    for (let i = 1; i < bands.length; i += 1) {
      const [a, b] = [bands[i - 1]!, bands[i]!];
      if (a.kind === 'band' && b.kind === 'band') expect(b.x).toBeCloseTo(a.x + a.width, 6);
    }
  });

  it('keeps a stop it cannot blend as a flat band', () => {
    const legend: Legend = {
      kind: 'continuous',
      label: '',
      domain: [0, 1],
      stops: ['red', 'blue'],
    };
    const colours = layoutLegends([legend], frame).marks.flatMap((m) =>
      m.kind === 'band' ? [m.color] : [],
    );
    expect(new Set(colours)).toEqual(new Set(['red', 'blue']));
  });

  it('places symbol entries at the centre of their row, in their colour or none', () => {
    const legend: Legend = {
      kind: 'symbol',
      label: 'kind',
      entries: [
        { key: 'a', label: 'a', symbol: 'circle', path: 'M1,0Z', color: '#ff0000' },
        { key: 'b', label: 'b', symbol: 'cross', path: 'M2,0Z' },
      ],
    };
    const symbols = layoutLegends([legend], frame).marks.filter((m) => m.kind === 'symbol');
    expect(symbols.map((m) => m.kind === 'symbol' && [m.path, m.color])).toEqual([
      ['M1,0Z', '#ff0000'],
      ['M2,0Z', undefined],
    ]);
  });
});
