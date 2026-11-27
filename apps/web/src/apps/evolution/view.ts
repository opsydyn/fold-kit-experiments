import type { Html } from '@effect/ui/html';
import { lineGeometry } from '@opsydyn/foldkit-viz/chart/cartesian';
import { darkTheme, resolveSeriesStyle } from '@opsydyn/foldkit-viz/chart/theme';
import type { ChartTheme, SeriesStyle } from '@opsydyn/foldkit-viz/chart/theme';
import {
  axis,
  chartFrame,
  dataTable,
  grid,
  lineSeries,
  pointSeries,
} from '@opsydyn/foldkit-viz/effect-ui/cartesian';

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

const chart = (model: Model, h: Html.H<Message>) => {
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
      // A UTC time axis: ticks on UTC boundaries, labelled the same on the
      // server and in every browser.
      xScale: { type: 'time' },
      xTickCount: 5,
      includeZero: { x: false, y: true },
      yTickCount: 4,
      curve: model.curve,
    },
  );
  const xTicks = geometry.xTicks;
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

const curveToggle = (model: Model, h: Html.H<Message>, curve: Curve, label: string) =>
  h.button
    .attrs({
      type: 'button',
      class: styles.toggle,
      'aria-pressed': model.curve === curve ? 'true' : 'false',
    })
    .on('click', Message.ChoseCurve({ curve }))
    .children(label);

const legend = (model: Model, h: Html.H<Message>) => {
  const rows = evolutionRows(model.events);
  return h.ul.attrs({ class: styles.legend, 'aria-label': 'Series' }).children(
    SERIES.map(({ key, plural }) => {
      const count = rows.filter((row) => row.series === key).at(-1)?.count ?? 0;
      return h.li.key(key).children(
        h.button
          .attrs({
            type: 'button',
            class: styles.legendButton,
            'aria-pressed': model.highlighted === key ? 'true' : 'false',
          })
          .on('mouseenter', Message.HighlightedSeries({ key }))
          .on('mouseleave', Message.HighlightedSeries({ key: null }))
          .on('focus', Message.HighlightedSeries({ key }))
          .on('blur', Message.HighlightedSeries({ key: null }))
          .children(
            h.span.attrs({
              class: styles.swatch,
              style: `background:${colour(key)}`,
              'aria-hidden': String(true),
            }),
            `${plural} ${count}`,
          ),
      );
    }),
  );
};

export const view = (h: Html.H<Message>, model: Model) =>
  h.section.attrs({ class: styles.card, 'aria-label': 'Diagram evolution' }).children(
    h.h2.attr('class', styles.title).children('Evolution'),
    h.p
      .attrs({ class: styles.meta, 'aria-live': 'polite' })
      .children(eventLabel(model.events.at(-1))),
    h.div
      .attrs({ class: styles.controls, role: 'group', 'aria-label': 'Line shape' })
      .children(
        curveToggle(model, h, 'stepAfter', 'Stepped'),
        curveToggle(model, h, 'monotoneX', 'Smoothed'),
      ),
    h.div.attr('class', styles.canvas).children(chart(model, h)),
    legend(model, h),
    h.details.attr('class', styles.tableToggle).children(
      h.summary.children('Change log'),
      dataTable(h, {
        caption: 'Diagram changes, oldest first',
        headers: ['Time (UTC)', 'Change'],
        rows: model.events.map((event) => [
          clock(event.time),
          eventLabel(event).split(' · ').slice(0, 2).join(' · '),
        ]),
      }),
    ),
  );
