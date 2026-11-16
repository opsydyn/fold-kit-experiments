import { describe, expect, it } from 'bun:test';

import { plotChart } from '../src/foldkit/plot';
import { compilePlot, describePlot, plotTable } from '../src/plot';
import type { PlotSpec } from '../src/plot';
import { renderChart } from './render-chart';

const sales: PlotSpec = {
  width: 400,
  height: 260,
  title: 'Sales',
  data: [
    { month: 'Jan', units: 1200, region: 'north' },
    { month: 'Feb', units: 980.456, region: 'south' },
    { month: 'Mar', units: 1430, region: 'north' },
  ],
  y: { label: 'Units' },
  marks: [{ mark: 'bar', x: 'month', y: 'units', fill: 'region', title: 'month' }],
};

describe('describePlot', () => {
  it('says what is drawn, what the axes cover and what colour shows', () => {
    expect(describePlot(compilePlot(sales))).toBe(
      'Shows 3 bars. Month in 3 categories; Units from 0 to 1,430. ' +
        'Colour shows region (2 groups: north, south).',
    );
  });

  it('counts packed points one by one, and notes log scales and panels', () => {
    const summary = describePlot(
      compilePlot({
        width: 400,
        height: 260,
        data: Array.from({ length: 2500 }, (_, i) => ({
          x: i + 1,
          y: i % 7,
          g: i % 2 ? 'a' : 'b',
        })),
        facet: { x: 'g' },
        x: { type: 'log' },
        marks: [{ mark: 'dot', x: 'x', y: 'y', dense: true }],
      }),
    );
    expect(summary).toContain('Shows 2,500 points across 2 panels.');
    expect(summary).toContain('on a log scale');
  });

  it('counts a box or a violin once, not each of the lines it is drawn with', () => {
    const groups = (mark: 'box' | 'violin') =>
      describePlot(
        compilePlot({
          width: 400,
          height: 260,
          data: ['a', 'b', 'c'].flatMap((g) => [1, 3, 5, 9].map((v) => ({ g, v }))),
          marks: [{ mark, x: 'g', y: 'v' }],
        }),
      );
    expect(groups('box')).toStartWith('Shows 3 boxes.');
    expect(groups('violin')).toStartWith('Shows 3 violins.');
  });

  it('describes polar charts by their directions', () => {
    const summary = describePlot(
      compilePlot({
        width: 300,
        height: 300,
        coordinates: 'polar',
        data: [
          { dir: 'N', v: 2 },
          { dir: 'S', v: 4 },
        ],
        y: { label: 'Speed' },
        marks: [{ mark: 'bar', x: 'dir', y: 'v' }],
      }),
    );
    expect(summary).toBe('Shows 2 bars. 2 directions round the circle; radius shows Speed.');
  });
});

describe('plotTable', () => {
  it('lists the fields the first mark reads, title first, with readable numbers', () => {
    expect(plotTable(sales)).toEqual({
      caption: 'Sales',
      headers: ['month', 'units', 'region'],
      rows: [
        ['Jan', '1,200', 'north'],
        ['Feb', '980.5', 'south'],
        ['Mar', '1,430', 'north'],
      ],
      total: 3,
    });
  });

  it('cuts long data short and says how much there is', () => {
    const table = plotTable(
      { ...sales, data: Array.from({ length: 500 }, (_, i) => ({ month: `m${i}`, units: i })) },
      { limit: 10 },
    );
    expect(table.rows).toHaveLength(10);
    expect(table.total).toBe(500);
  });

  it('skips marks of constants, such as reference rules', () => {
    const table = plotTable({
      ...sales,
      marks: [{ mark: 'rule', y: { value: 1000 } }, ...sales.marks],
    });
    expect(table.headers).toEqual(['month', 'units', 'region']);
  });
});

describe('rendering', () => {
  it('adds the summary to the description and the table, hidden, beside the chart', async () => {
    const html = await renderChart<never>((h) =>
      plotChart(h, compilePlot(sales), { summary: true, table: plotTable(sales) }),
    );
    expect(html).toContain('<desc>Shows 3 bars.');
    expect(html).toContain('class="plot-data"');
    expect(html).toContain('<th scope="col">units</th>');
    expect(html).toContain('<th scope="row">Feb</th>');
  });

  it("prints a continuous legend's ends as readable numbers", async () => {
    const html = await renderChart<never>((h) =>
      plotChart(
        h,
        compilePlot({
          width: 300,
          height: 200,
          data: [
            { x: 1, y: 1, v: 1234.5 },
            { x: 2, y: 2, v: 4.884665112696734 },
          ],
          color: { label: 'shade' },
          marks: [{ mark: 'dot', x: 'x', y: 'y', fill: 'v' }],
        }),
      ),
    );
    expect(html).toContain('>4.885<');
    expect(html).toContain('>1,235<');
    expect(html).toContain('shade: 4.885 to 1,235');
    expect(html).not.toContain('4.8846651');
  });

  it('leaves both out unless asked', async () => {
    const html = await renderChart<never>((h) => plotChart(h, compilePlot(sales)));
    expect(html).not.toContain('<desc>');
    expect(html).not.toContain('plot-data');
  });
});
