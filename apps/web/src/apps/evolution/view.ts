import { lineGeometry } from '@opsydyn/foldkit-viz/chart/cartesian';
import type { AxisTick } from '@opsydyn/foldkit-viz/chart/cartesian';
import { darkTheme, resolveSeriesStyle } from '@opsydyn/foldkit-viz/chart/theme';
import type { ChartTheme, SeriesStyle } from '@opsydyn/foldkit-viz/chart/theme';
import {
  axis,
  chartFrame,
  dataTable,
  grid,
  lineSeries,
  pointSeries,
} from '@opsydyn/foldkit-viz/foldkit/cartesian';
import { timeTicks } from '@opsydyn/foldkit-viz/math/time';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import { Message } from './message';
import { clock, eventLabel, evolutionRows, SERIES } from './model';
import type { Curve, EvolutionRow, Model, SeriesKey } from './model';

import * as styles from './evolution.css';

const { palette } = styles;
const FRAME = { width: 440, height: 240, margins: { top: 28, right: 16, bottom: 40, left: 36 } };

const theme: ChartTheme = {
  ...darkTheme,
  background: 'transparent',
  text: palette.text,
  mutedText: palette.muted,
  grid: 'var(--evolution-grid, #1c2723)',
  axis: palette.border,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  labelSize: 10,
};

const isSeriesKey = (key: string): key is SeriesKey => SERIES.some((series) => series.key === key);
const colour = (key: string): string => (isSeriesKey(key) ? palette[key] : palette.muted);
const nameOf = (key: string): string => SERIES.find((series) => series.key === key)?.plural ?? key;

/** A highlighted series stands out by dimming the others. */
const styleFor = (model: Model, key: string): SeriesStyle =>
  resolveSeriesStyle(
    theme,
    { strokeWidth: 1.5, pointRadius: 3.5 },
    { stroke: colour(key), fill: colour(key) },
    { opacity: model.highlighted === null || model.highlighted === key ? 1 : 0.2 },
  );

const chart = (model: Model, h: HtmlBuilder<Message>): Html => {
  const rows = evolutionRows(model.events);
  const first = model.events[0]?.time ?? 0;
  const last = model.events.at(-1)?.time ?? first + 1;
  const geometry = lineGeometry(
    rows,
    {
      x: (row) => row.time,
      y: (row) => row.count,
      datumKey: (row) => row.key,
      seriesKey: (row) => row.series,
    },
    {
      frame: FRAME,
      xDomain: [first, last],
      includeZero: { x: false, y: true },
      yTickCount: 4,
      curve: model.curve,
    },
  );
  // Times are plotted as epoch milliseconds, so the x ticks come from the time
  // scale's calendar-aware steps rather than the linear default.
  const xTicks: ReadonlyArray<AxisTick> = timeTicks([new Date(first), new Date(last)], 5).map(
    (date) => ({
      value: date.getTime(),
      position: geometry.layout.x(date.getTime()),
    }),
  );
  const yTicks = geometry.yTicks.filter((tick) => Number.isInteger(tick.value));
  // Draw the highlighted series last, so it sits above the others.
  const ordered = [...geometry.series].sort(
    (a, b) => Number(a.key === model.highlighted) - Number(b.key === model.highlighted),
  );
  const latest = ordered.flatMap((series) => {
    const point = series.points.at(-1);
    return point === undefined ? [] : [point];
  });
  const total = (key: string): number =>
    rows.filter((row) => row.series === key).at(-1)?.count ?? 0;
  return chartFrame(
    h,
    {
      layout: geometry.layout,
      title: 'Diagram evolution',
      description: `Running count of each element type over ${model.events.length} changes, from ${clock(first)} to ${clock(last)} UTC.`,
      theme,
    },
    [
      grid(h, { layout: geometry.layout, xTicks, yTicks, theme }),
      axis(h, {
        layout: geometry.layout,
        orientation: 'bottom',
        ticks: xTicks,
        label: 'Time (UTC)',
        format: clock,
        theme,
      }),
      axis(h, {
        layout: geometry.layout,
        orientation: 'left',
        ticks: yTicks,
        label: 'Count',
        format: String,
        theme,
      }),
      ...ordered.map((series) =>
        lineSeries(h, { path: series.path, style: styleFor(model, series.key) }),
      ),
      pointSeries<EvolutionRow, Message>(h, {
        points: latest,
        styleFor: (point) => styleFor(model, point.seriesKey),
        labelFor: (row) => `${nameOf(row.series)}: ${total(row.series)}`,
        activeKey: null,
      }),
    ],
  );
};

const curveToggle = (model: Model, h: HtmlBuilder<Message>, curve: Curve, label: string): Html =>
  h.button(
    [
      h.Type('button'),
      h.Class(styles.toggle),
      h.AriaPressed(model.curve === curve ? 'true' : 'false'),
      h.OnClick(Message.ChoseCurve({ curve })),
    ],
    [label],
  );

const legend = (model: Model, h: HtmlBuilder<Message>): Html => {
  const rows = evolutionRows(model.events);
  return h.ul(
    [h.Class(styles.legend), h.AriaLabel('Series')],
    SERIES.map(({ key, plural }) => {
      const count = rows.filter((row) => row.series === key).at(-1)?.count ?? 0;
      return h.li(
        [h.Key(key)],
        [
          h.button(
            [
              h.Type('button'),
              h.Class(styles.legendButton),
              h.AriaPressed(model.highlighted === key ? 'true' : 'false'),
              h.OnMouseEnter(Message.HighlightedSeries({ key })),
              h.OnMouseLeave(Message.HighlightedSeries({ key: null })),
              h.OnFocus(Message.HighlightedSeries({ key })),
              h.OnBlur(Message.HighlightedSeries({ key: null })),
            ],
            [
              h.span(
                [h.Class(styles.swatch), h.Style({ background: colour(key) }), h.AriaHidden(true)],
                [],
              ),
              `${plural} ${count}`,
            ],
          ),
        ],
      );
    }),
  );
};

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Diagram Evolution — foldkit-viz',
  body: h.section(
    [h.Class(styles.card), h.AriaLabel('Diagram evolution')],
    [
      h.h2([h.Class(styles.title)], ['Evolution']),
      h.p([h.Class(styles.meta), h.AriaLive('polite')], [eventLabel(model.events.at(-1))]),
      h.div(
        [h.Class(styles.controls), h.Role('group'), h.AriaLabel('Line shape')],
        [
          curveToggle(model, h, 'stepAfter', 'Stepped'),
          curveToggle(model, h, 'monotoneX', 'Smoothed'),
        ],
      ),
      h.div([h.Class(styles.canvas)], [chart(model, h)]),
      legend(model, h),
      h.details(
        [h.Class(styles.tableToggle)],
        [
          h.summary([], ['Change log']),
          dataTable(h, {
            caption: 'Diagram changes, oldest first',
            headers: ['Time (UTC)', 'Change'],
            rows: model.events.map((event) => [
              clock(event.time),
              eventLabel(event).split(' · ').slice(0, 2).join(' · '),
            ]),
          }),
        ],
      ),
    ],
  ),
});
