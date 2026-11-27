import type { View } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { lineGeometry, scatterGeometry } from '@opsydyn/foldkit-viz/chart/cartesian';
import type { CartesianLayout, ScatterGeometry } from '@opsydyn/foldkit-viz/chart/cartesian';
import { darkTheme, resolveSeriesStyle } from '@opsydyn/foldkit-viz/chart/theme';
import type { ChartTheme } from '@opsydyn/foldkit-viz/chart/theme';
import {
  axis,
  chartFrame,
  dataTable,
  grid,
  hexSeries,
  lineSeries,
  pointSeries,
} from '@opsydyn/foldkit-viz/effect-ui/cartesian';
import { hexbin } from '@opsydyn/foldkit-viz/math/bin2d';
import { colorScale, interpolateRgbBasis } from '@opsydyn/foldkit-viz/math/color';
import { lttb, m4 } from '@opsydyn/foldkit-viz/math/downsample';
import {
  linearRegression,
  loess,
  polynomialRegression,
} from '@opsydyn/foldkit-viz/math/regression';
import { viridis } from '@opsydyn/foldkit-viz/math/schemes';
import { line } from '@opsydyn/foldkit-viz/shape/line';

import { Message } from './message';
import { cloud, observations, users, walk } from './model';
import type { Downsampler, Fit, Model, Point } from './model';

import * as styles from './data-science.css';

const { palette } = styles;
const FRAME = { width: 460, height: 260, margins: { top: 28, right: 16, bottom: 42, left: 56 } };
const theme: ChartTheme = {
  ...darkTheme,
  background: 'transparent',
  text: palette.text,
  mutedText: palette.muted,
  grid: palette.grid,
  axis: palette.border,
  labelSize: 11,
};
const accessors = {
  x: (p: Point) => p.x,
  y: (p: Point) => p.y,
  datumKey: (p: Point) => p.id,
  seriesKey: () => 'all',
};
const lineStyle = resolveSeriesStyle(theme, { stroke: palette.line, strokeWidth: 1.5 }, {}, {});
const fitStyle = resolveSeriesStyle(theme, { stroke: palette.accent, strokeWidth: 2 }, {}, {});
const pointStyle = resolveSeriesStyle(
  theme,
  { fill: palette.point, stroke: 'none', pointRadius: 2.5, opacity: 0.7 },
  {},
  {},
);
const thousands = (value: number): string => value.toLocaleString('en-US');

/** The frame, grid and both axes every panel shares, around the panel's own marks. */
const frame = (
  h: Html.H<Message>,
  geometry: Pick<ScatterGeometry<Point>, 'layout' | 'xTicks' | 'yTicks'>,
  labels: Readonly<{ title: string; description: string; x: string; y: string }>,
  marks: View.Children<Message, never>,
) =>
  chartFrame(
    h,
    { layout: geometry.layout, title: labels.title, description: labels.description, theme },
    [
      grid(h, { layout: geometry.layout, xTicks: geometry.xTicks, yTicks: geometry.yTicks, theme }),
      axis(h, {
        layout: geometry.layout,
        orientation: 'bottom',
        ticks: geometry.xTicks,
        label: labels.x,
        theme,
      }),
      axis(h, {
        layout: geometry.layout,
        orientation: 'left',
        ticks: geometry.yTicks,
        label: labels.y,
        theme,
      }),
      ...marks,
    ],
  );

const toggle = <Value extends string>(
  h: Html.H<Message>,
  current: Value,
  value: Value,
  label: string,
  message: Message,
) =>
  h.button
    .attrs({
      type: 'button',
      class: styles.toggle,
      'aria-pressed': current === value ? 'true' : 'false',
    })
    .on('click', message)
    .children(label);

const panel = (h: Html.H<Message>, title: string, children: View.Children<Message, never>) =>
  h.section
    .attrs({ class: styles.panel, 'aria-label': title })
    .children(h.h2.attr('class', styles.title).children(title), ...children);

/** Log-scaled time series: a UTC time axis and a log value axis, both from the chart layer. */
const growthPanel = (h: Html.H<Message>) => {
  const geometry = lineGeometry(users, accessors, {
    frame: FRAME,
    xScale: { type: 'time' },
    yScale: { type: 'log' },
    xTickCount: 6,
  });
  return panel(h, 'Daily active users', [
    h.p
      .attr('class', styles.note)
      .children('Exponential growth reads as a straight line on a log scale.'),
    frame(
      h,
      geometry,
      {
        title: 'Daily active users, log scale',
        description: `${users.length} days of daily active users, from ${thousands(users[0]?.y ?? 0)} to ${thousands(users.at(-1)?.y ?? 0)}.`,
        x: 'Date (UTC)',
        y: 'Users',
      },
      geometry.series.map((series) => lineSeries(h, { path: series.path, style: lineStyle })),
    ),
  ]);
};

const FIT_LABEL = { linear: 'Linear', quadratic: 'Quadratic', loess: 'LOESS' } satisfies Record<
  Fit,
  string
>;

/** The fitted curve, and for least-squares fits a 95% confidence band, in plot coordinates. */
type FitMarks = Readonly<{
  curve: string;
  band: string | null;
  rows: ReadonlyArray<ReadonlyArray<string>>;
}>;
const fitMarks = (fit: Fit, layout: CartesianLayout): FitMarks => {
  const xy = { x: (p: Point) => p.x, y: (p: Point) => p.y };
  const [x0, x1] = layout.xDomain;
  const xs = Array.from({ length: 61 }, (_, i) => x0 + ((x1 - x0) * i) / 60);
  const project = (x: number, y: number) => [layout.x(x), layout.y(y)] as const;
  if (fit === 'loess') {
    const curve = loess(observations, xy, { bandwidth: 0.4 });
    return {
      curve:
        line(
          curve.map((p) => project(p.x, p.y)),
          { curve: 'monotoneX' },
        ) ?? '',
      band: null,
      rows: [
        ['Bandwidth', '0.4'],
        ['Robustness iterations', '2'],
      ],
    };
  }
  const model =
    fit === 'linear'
      ? linearRegression(observations, xy)
      : polynomialRegression(observations, xy, { degree: 2 });
  const intervals = xs.map((x) => ({ x, ...model.interval(x) }));
  const upper = intervals.map((p) => project(p.x, p.upper));
  const lower = intervals.map((p) => project(p.x, p.lower)).reverse();
  const band = `M${[...upper, ...lower].map(([x, y]) => `${x},${y}`).join('L')}Z`;
  return {
    curve: line(intervals.map((p) => project(p.x, p.fit))) ?? '',
    band,
    rows: [
      ...model.coefficients.map((c, power) => [
        power === 0 ? 'Intercept' : power === 1 ? 'x' : `x^${power}`,
        c.toFixed(3),
      ]),
      ['R squared', model.rSquared.toFixed(3)],
    ],
  };
};

const regressionPanel = (model: Model, h: Html.H<Message>) => {
  const geometry = scatterGeometry(observations, accessors, { frame: FRAME });
  const marks = fitMarks(model.fit, geometry.layout);
  return panel(h, 'Regression', [
    h.div
      .attrs({ class: styles.controls, role: 'group', 'aria-label': 'Fit' })
      .children(
        (['linear', 'quadratic', 'loess'] as const).map((fit) =>
          toggle(h, model.fit, fit, FIT_LABEL[fit], Message.ChoseFit({ fit })),
        ),
      ),
    frame(
      h,
      geometry,
      {
        title: `${FIT_LABEL[model.fit]} fit`,
        description: `${observations.length} observations with a ${FIT_LABEL[model.fit].toLowerCase()} fit${marks.band === null ? '' : ' and its 95% confidence band'}.`,
        x: 'Dose',
        y: 'Response',
      },
      [
        ...(marks.band === null
          ? []
          : [
              h
                .el('path')
                .attrs({ class: 'ds-band', d: marks.band, fill: palette.accent, opacity: '0.2' }),
            ]),
        pointSeries(h, {
          points: geometry.points,
          styleFor: () => pointStyle,
          labelFor: (p) => `${p.x.toFixed(2)}, ${p.y.toFixed(2)}`,
          activeKey: null,
        }),
        lineSeries(h, { path: marks.curve, style: fitStyle }),
      ],
    ),
    h.div.attr('class', styles.table).children(
      dataTable(h, {
        caption: `${FIT_LABEL[model.fit]} fit`,
        headers: ['Term', 'Value'],
        rows: marks.rows,
      }),
    ),
  ]);
};

const DOWNSAMPLER_LABEL = { m4: 'M4', lttb: 'LTTB' } satisfies Record<Downsampler, string>;

const downsamplePanel = (model: Model, h: Html.H<Message>) => {
  const plotWidth = FRAME.width - FRAME.margins.left - FRAME.margins.right;
  const xy = { x: (p: Point) => p.x, y: (p: Point) => p.y };
  // The full series never reaches the geometry: it is reduced to the plot's pixel width first.
  const drawn =
    model.downsampler === 'm4' ? m4(walk, xy, { width: plotWidth }) : lttb(walk, xy, plotWidth);
  const geometry = lineGeometry(drawn, accessors, { frame: FRAME });
  return panel(h, '100,000 points', [
    h.div
      .attrs({ class: styles.controls, role: 'group', 'aria-label': 'Downsampling' })
      .children(
        (['m4', 'lttb'] as const).map((downsampler) =>
          toggle(
            h,
            model.downsampler,
            downsampler,
            DOWNSAMPLER_LABEL[downsampler],
            Message.ChoseDownsampler({ downsampler }),
          ),
        ),
      ),
    h.p
      .attrs({ class: styles.note, 'aria-live': 'polite' })
      .children(
        `Drawing ${thousands(drawn.length)} of ${thousands(walk.length)} points with ${DOWNSAMPLER_LABEL[model.downsampler]}.`,
      ),
    frame(
      h,
      geometry,
      {
        title: 'Random walk, downsampled',
        description: `A ${thousands(walk.length)}-point random walk reduced to ${thousands(drawn.length)} points with ${DOWNSAMPLER_LABEL[model.downsampler]}.`,
        x: 'Second',
        y: 'Value',
      },
      geometry.series.map((series) => lineSeries(h, { path: series.path, style: lineStyle })),
    ),
  ]);
};

const HEX_RADIUS = 7;
const density = colorScale({ domain: [0, 1], interpolator: interpolateRgbBasis(viridis) });

const densityPanel = (h: Html.H<Message>) => {
  // Project all 20,000 points, then bin them in pixel space: only the hexagons are drawn.
  const geometry = scatterGeometry(cloud, accessors, { frame: FRAME });
  const bins = hexbin(geometry.points, { x: (p) => p.x, y: (p) => p.y }, { radius: HEX_RADIUS });
  const most = Math.max(...bins.map((bin) => bin.count));
  const { plot } = geometry.layout;
  const clipId = h.id('data-science-hex-clip');
  return panel(h, 'Density', [
    h.p
      .attr('class', styles.note)
      .children(
        `${thousands(cloud.length)} points in ${thousands(bins.length)} hexagons; brighter means more points.`,
      ),
    frame(
      h,
      geometry,
      {
        title: 'Hexagonal density',
        description: `${thousands(cloud.length)} correlated pairs binned into hexagons, up to ${most} points each.`,
        x: 'x',
        y: 'y',
      },
      [
        // Hexagons centred near an edge would spill past the axes: clip them to the plot.
        h.el('defs').children(
          h
            .el('clipPath')
            .attr('id', clipId)
            .children(
              h.el('rect').attrs({
                x: String(plot.left),
                y: String(plot.top),
                width: String(plot.width),
                height: String(plot.height),
              }),
            ),
        ),
        h
          .el('g')
          .attr('clip-path', `url(#${clipId})`)
          .children(
            hexSeries(h, {
              bins,
              radius: HEX_RADIUS,
              fillFor: (bin) => density(Math.sqrt(bin.count / most)),
              labelFor: (bin) => `${bin.count} points`,
            }),
          ),
      ],
    ),
  ]);
};

export const view = (h: Html.H<Message>, model: Model) =>
  h.div
    .attr('class', styles.page)
    .children(
      growthPanel(h),
      regressionPanel(model, h),
      downsamplePanel(model, h),
      densityPanel(h),
    );
