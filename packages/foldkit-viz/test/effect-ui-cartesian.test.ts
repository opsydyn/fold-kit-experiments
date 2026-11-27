import { expect, it } from 'bun:test';

import { Html, HtmlServer } from '@effect/ui/html';
import { Effect, Schema } from 'effect';

import { scatterGeometry } from '../src/chart/cartesian.js';
import { lightTheme } from '../src/chart/theme.js';
import { chartFrame, hexSeries, lineSeries, pointSeries } from '../src/effect-ui/cartesian.js';
import { hexbin } from '../src/math/bin2d.js';

const frame = { width: 120, height: 80, margins: { top: 0, right: 0, bottom: 0, left: 0 } };
const sample = { id: 'sample', x: 1, y: 1 };
const geometry = scatterGeometry(
  [sample],
  {
    x: (point) => point.x,
    y: (point) => point.y,
    datumKey: (point) => point.id,
    seriesKey: () => 'series',
  },
  { frame, xDomain: [0, 2], yDomain: [0, 2] },
);
const style = {
  ...lightTheme.series,
  fill: 'red',
  stroke: 'blue',
  strokeWidth: 2,
  opacity: 0.4,
  symbol: 'diamond' as const,
  dashPattern: '4 2',
};

it('server-renders line, labelled points and native hexagon tooltips in projected space', async () => {
  const chart = Html.component({
    name: 'CartesianFixture',
    model: Schema.Struct({}),
    message: Schema.Never,
  }).make({
    init: () => ({}),
    update: ({ model }) => model,
    view: (h: Html.H<never>) =>
      chartFrame<never>(
        h,
        {
          layout: geometry.layout,
          title: 'Fixture',
          description: 'A line, point and bin',
          theme: lightTheme,
        },
        [
          lineSeries(h, { path: 'M0,80L120,0', style }),
          pointSeries(h, {
            points: geometry.points,
            styleFor: () => style,
            labelFor: () => 'A < B',
            activeKey: 'sample',
          }),
          hexSeries(h, {
            bins: hexbin(
              geometry.points,
              { x: (point) => point.x, y: (point) => point.y },
              { radius: 6 },
            ),
            radius: 6,
            fillFor: () => 'green',
            labelFor: (bin) => `${bin.count} observation`,
          }),
        ],
      ),
  });
  const { html } = await Effect.runPromise(HtmlServer.renderToHtml(chart, {}));
  expect(html).toContain('d="M0,80L120,0"');
  expect(html).toContain('stroke-dasharray="4 2"');
  expect(html).toMatch(
    /data-symbol="diamond"[^>]*transform="translate\(60,40\)"[^>]*stroke="currentColor"/,
  );
  expect(html).toContain('aria-label="A &lt; B"');
  expect(html).toContain('<title>1 observation</title>');
});
