import { lineGeometry } from '@opsydyn/foldkit-viz/chart/cartesian';
import {
  lightTheme,
  resolveSeriesStyle,
  type ChartTheme,
  type SeriesStyle,
} from '@opsydyn/foldkit-viz/chart/theme';
import {
  axis,
  chartFrame,
  dataTable,
  grid,
  legend,
  lineSeries,
  pointSeries,
} from '@opsydyn/foldkit-viz/foldkit/cartesian';
import type { HtmlBuilder } from 'foldkit/html';

import { windowSize, type History, type Sample, type SeriesKey } from './evolution';

const series: readonly {
  key: SeriesKey;
  label: string;
  color: string;
  symbol: SeriesStyle['symbol'];
  dashPattern: string;
}[] = [
  {
    key: 'person',
    label: 'People',
    color: 'var(--output-port)',
    symbol: 'circle',
    dashPattern: '',
  },
  {
    key: 'software-system',
    label: 'Software systems',
    color: 'var(--c4)',
    symbol: 'square',
    dashPattern: '6 3',
  },
  {
    key: 'external-system',
    label: 'External systems',
    color: 'var(--ddd)',
    symbol: 'triangle',
    dashPattern: '3 3',
  },
  {
    key: 'container',
    label: 'Containers',
    color: 'var(--accent)',
    symbol: 'diamond',
    dashPattern: '8 3 2 3',
  },
  {
    key: 'component',
    label: 'Components',
    color: 'var(--danger)',
    symbol: 'cross',
    dashPattern: '4 2 1 2',
  },
  { key: 'other', label: 'Other nodes', color: 'var(--muted)', symbol: 'wye', dashPattern: '1 3' },
  {
    key: 'relationships',
    label: 'Relationships',
    color: 'var(--edge)',
    symbol: 'star',
    dashPattern: '10 3',
  },
];
const frame = { width: 360, height: 190, margins: { top: 14, right: 20, bottom: 44, left: 44 } };
const theme: ChartTheme = {
  ...lightTheme,
  background: 'transparent',
  text: 'var(--ink)',
  mutedText: 'var(--muted)',
  grid: 'var(--rule)',
  axis: 'var(--edge)',
};

type Row = Readonly<{ key: SeriesKey; label: string; version: number; count: number }>;

function plot<M>(h: HtmlBuilder<M>, samples: readonly Sample[], inspected: Sample) {
  const active = series.filter(({ key }) => samples.some(({ counts }) => counts[key] > 0));
  if (active.length === 0) return [h.p([], ['No nodes or relationships in this window.'])];

  const rows: readonly Row[] = samples.flatMap(({ version, counts }) =>
    active.map(({ key, label }) => ({ key, label, version, count: counts[key] })),
  );
  const geometry = lineGeometry(
    rows,
    {
      x: (row) => row.version,
      y: (row) => row.count,
      datumKey: (row) => `${row.version}/${row.key}`,
      seriesKey: (row) => row.key,
    },
    {
      frame,
      xTickCount: 4,
      yTickCount: 4,
      includeZero: { x: false, y: true },
      curve: 'stepAfter',
    },
  );
  const xTicks = geometry.xTicks.filter(({ value }) => Number.isInteger(value));
  const yTicks = geometry.yTicks.filter(({ value }) => Number.isInteger(value));
  const entries = active.map(({ key, label, color, symbol, dashPattern }) => ({
    key,
    label,
    style: resolveSeriesStyle(
      theme,
      { strokeWidth: 2, pointRadius: 3 },
      { stroke: color, fill: color, symbol, dashPattern },
      {},
    ),
  }));
  const styles = new Map<string, SeriesStyle>(entries.map(({ key, style }) => [key, style]));
  const styleFor = (key: string) => styles.get(key) ?? theme.series;
  return [
    chartFrame(
      h,
      {
        layout: geometry.layout,
        title: 'Diagram Evolution',
        description: 'Stepped counts by confirmed version. Use Inspect version for exact counts.',
        theme,
      },
      [
        grid(h, { layout: geometry.layout, xTicks, yTicks, theme }),
        axis(h, {
          layout: geometry.layout,
          orientation: 'bottom',
          ticks: xTicks,
          label: 'Confirmed version',
          format: String,
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
        ...geometry.series.map(({ key, path }) => lineSeries(h, { path, style: styleFor(key) })),
        pointSeries<Row, M>(h, {
          points: geometry.series.flatMap(({ points }) =>
            points.filter(({ datum }) => datum.version === inspected.version),
          ),
          styleFor: (point) => styleFor(point.seriesKey),
          labelFor: (row) => `${row.label}: ${row.count}`,
          activeKey: null,
        }),
      ],
    ),
    legend(h, { entries, theme }),
  ];
}

export function view<M>(
  h: HtmlBuilder<M>,
  history: History,
  connection: 'live' | 'offline' | 'denied',
  onInspect: (value: string) => M,
  onReview: (version: number) => M,
  availability: 'available' | 'blocked',
) {
  const first = history.samples[0];
  const last = history.samples.at(-1);
  const inspected = history.samples.find(({ version }) => version === history.inspected) ?? last;
  const heading = h.h2([h.Class('rail-heading')], ['Diagram Evolution']);
  const contents =
    connection === 'denied'
      ? [h.p([], ['Access ended.'])]
      : first && last && inspected
        ? [
            h.p(
              [h.Class('evolution-window')],
              [
                first.version === last.version
                  ? `Version ${last.version}`
                  : `Versions ${first.version}–${last.version}`,
              ],
            ),
            h.p(
              [],
              [
                `This tab · up to ${windowSize} consecutive confirmed versions. Reload starts a new window.`,
              ],
            ),
            ...(history.restartedAfterGap
              ? [h.p([], ['The window restarted after a gap in confirmed versions.'])]
              : []),
            ...(connection === 'offline'
              ? [
                  h.p(
                    [h.Role('status')],
                    ['Showing the latest observed counts while reconnecting.'],
                  ),
                ]
              : []),
            ...(first.version === last.version
              ? [h.p([], ['The chart appears after another confirmed version arrives.'])]
              : [
                  ...plot(h, history.samples, inspected),
                  h.label([h.For('board-evolution-version')], ['Inspect version']),
                  h.select(
                    [
                      h.Id('board-evolution-version'),
                      h.Value(history.inspected === null ? 'latest' : String(history.inspected)),
                      h.OnChange(onInspect),
                    ],
                    [
                      h.option([h.Value('latest')], [`Latest (v${last.version})`]),
                      ...history.samples.map(({ version }) =>
                        h.option([h.Value(String(version))], [`Version ${version}`]),
                      ),
                    ],
                  ),
                ]),
            h.button(
              [
                h.Id('board-open-history'),
                h.Type('button'),
                h.Disabled(availability === 'blocked'),
                h.OnClick(onReview(inspected.version)),
              ],
              ['Open on canvas'],
            ),
            dataTable(h, {
              caption: `Counts at version ${inspected.version}`,
              headers: ['Type', 'Count'],
              rows: series.map(({ key, label }) => [label, String(inspected.counts[key])]),
            }),
          ]
        : [h.p([h.Role('status')], ['Waiting for the first confirmed diagram version.'])];
  return h.section(
    [h.Class('board-evolution'), h.AriaLabel('Diagram Evolution')],
    [heading, ...contents],
  );
}
