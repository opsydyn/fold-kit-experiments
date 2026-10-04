import { expect, it } from 'bun:test';

import { Option } from 'effect';

import { scatterGeometry, lineGeometry, histogramGeometry } from '../src/chart/cartesian.js';
import { lightTheme, resolveSeriesStyle, createSeriesStyles } from '../src/chart/theme.js';
import {
  chartFrame,
  grid,
  axis,
  lineSeries,
  pointSeries,
  barSeries,
  annotation,
  tooltip,
  legend,
  dataTable,
} from '../src/foldkit/cartesian.js';
import { renderChart } from './render-chart.js';

const frame = { width: 200, height: 100, margins: { top: 0, right: 0, bottom: 0, left: 0 } };
const data = [
  { id: 'a', value: -10, label: 'Long raw label <North>' },
  { id: 'b', value: 10, label: 'South' },
];
const accessors = {
  x: (_d: (typeof data)[number], i: number) => i * 10,
  y: (d: (typeof data)[number]) => d.value,
  datumKey: (d: (typeof data)[number]) => d.id,
  seriesKey: (d: (typeof data)[number]) => d.id,
};
const geometry = scatterGeometry(data, accessors, { frame, xDomain: [0, 10], yDomain: [-10, 10] });
const style = resolveSeriesStyle(
  lightTheme,
  { stroke: 'var(--brand)', fill: 'currentColor', opacity: 0.25 },
  {},
  {},
);

it('renders ordered layers and projects annotations through the same scales', async () => {
  const line = lineGeometry(
    data,
    { ...accessors, seriesKey: () => 'all' },
    { frame, xDomain: [0, 10], yDomain: [-10, 10] },
  );
  const markup = await renderChart((h) =>
    chartFrame(
      h,
      {
        layout: geometry.layout,
        title: 'A chart',
        description: 'Illustrative negative data',
        theme: lightTheme,
        interactive: true,
        onKeyDown: () => Option.none(),
      },
      [
        grid(h, { ...geometry, theme: lightTheme }),
        lineSeries(h, { path: line.series[0]?.path ?? '', style }),
        annotation(h, { layout: geometry.layout, axis: 'y', value: 0, label: 'Threshold', style }),
      ],
    ),
  );
  expect(markup).toContain('<title>A chart</title>');
  expect(markup).toContain('<desc>Illustrative negative data</desc>');
  expect(markup).toContain('role="img"');
  expect(markup).toContain('tabindex="0"');
  expect(markup).toContain('stroke="var(--brand)"');
  expect(markup).toContain('opacity="0.25"');
  expect(markup).toMatch(/<line[^>]*x1="0"[^>]*y1="50"[^>]*x2="200"[^>]*y2="50"/);
  expect(markup.indexOf('class="chart-grid"')).toBeLessThan(
    markup.indexOf('class="chart-line-series"'),
  );
  expect(markup.indexOf('class="chart-line-series"')).toBeLessThan(
    markup.indexOf('class="chart-annotation"'),
  );
});

it('renders custom tooltips with the original datum and projected coordinates', async () => {
  const point = Option.getOrThrow(Option.fromNullishOr(geometry.points[0]));
  const markup = await renderChart((h) =>
    chartFrame(
      h,
      { layout: geometry.layout, title: 'Tooltip', description: 'Datum detail', theme: lightTheme },
      [
        tooltip(h, {
          point,
          style,
          theme: lightTheme,
          render: (context, builder) =>
            builder.text(
              [
                builder.X(String(context.x)),
                builder.Y(String(context.y)),
                builder.Fill(context.style.fill),
              ],
              [`${context.datum.label}: ${context.datum.value}`],
            ),
        }),
      ],
    ),
  );
  expect(markup).toContain('x="0"');
  expect(markup).toContain('y="100"');
  expect(markup).toContain('fill="currentColor"');
  expect(markup).toContain('Long raw label &lt;North&gt;: -10');
});

it('keeps marks out of the tab sequence and renders keyed symbols and legend identities', async () => {
  const styles = createSeriesStyles(
    ['a', 'b'],
    ['red', 'blue'],
    new Map([['b', { symbol: 'square' }]]),
  );
  const styleFor = (key: string) => styles.get(key) ?? style;
  const markup = await renderChart((h) =>
    h.div(
      [],
      [
        chartFrame(
          h,
          {
            layout: geometry.layout,
            title: 'Points',
            description: 'Two groups',
            theme: lightTheme,
          },
          [
            pointSeries(h, {
              points: [...geometry.points].reverse(),
              styleFor: (p) => styleFor(p.seriesKey),
              labelFor: (d) => d.label,
              activeKey: 'b',
              onInspect: (key) => key,
            }),
          ],
        ),
        legend(h, {
          entries: data.map((d) => ({ key: d.id, label: d.label, style: styleFor(d.id) })),
          theme: lightTheme,
        }),
      ],
    ),
  );
  expect(markup).toContain('fill="blue"');
  expect(markup).toContain('fill="red"');
  expect(markup).not.toContain('tabindex');
  expect(markup.match(/data-symbol="square"/g)?.length).toBe(2);
  expect(markup).toContain('aria-label="South"');
});

it('renders labelled axes, count bars and a captioned raw data alternative', async () => {
  const histogram = histogramGeometry([0, 2, 5, 10], (n) => n, {
    frame,
    domain: [0, 10],
    binCount: 2,
  });
  const markup = await renderChart((h) =>
    h.div(
      [],
      [
        chartFrame(
          h,
          {
            layout: histogram.layout,
            title: 'Histogram',
            description: 'Raw interval counts',
            theme: lightTheme,
          },
          [
            axis(h, {
              layout: histogram.layout,
              orientation: 'bottom',
              ticks: histogram.xTicks,
              label: 'Units',
              format: (n) => String(n),
              theme: lightTheme,
            }),
            barSeries(h, {
              bins: histogram.bins,
              styleFor: () => style,
              labelFor: (b) => `${b.x0}–${b.x1}: ${b.count}`,
            }),
          ],
        ),
        dataTable(h, {
          caption: 'Illustrative source',
          headers: ['Label', 'Value'],
          rows: data.map((d) => [d.label, String(d.value)]),
        }),
      ],
    ),
  );
  expect(markup).toContain('Units');
  expect(markup).toContain('font-size="12"');
  expect(markup).toContain('fill="currentColor"');
  expect(markup).toContain('<caption>Illustrative source</caption>');
  expect(markup).toContain('Long raw label &lt;North&gt;');
  expect(markup).toContain('<td>-10</td>');
});

it('uses tooltip surface tokens and preserves the inspected series paint', async () => {
  const point = Option.getOrThrow(Option.fromNullishOr(geometry.points[0]));
  const theme = { ...lightTheme, tooltipBackground: 'rgb(1,2,3)', tooltipText: 'white' };
  const markup = await renderChart((h) => h.svg([], [tooltip(h, { point, style, theme })]));
  expect(markup).toContain('fill="rgb(1,2,3)"');
  expect(markup).toContain('fill="white"');
  expect(markup).toContain('fill="currentColor"');
});
