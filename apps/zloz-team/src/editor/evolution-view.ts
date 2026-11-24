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

type Series = Readonly<{
  key: SeriesKey;
  label: string;
  color: string;
  symbol: SeriesStyle['symbol'];
  dashPattern: string;
}>;
export type Perspective = 'workshop' | 'architecture';
const workshopSeries: readonly Series[] = [
  { key: 'events', label: 'Domain events', color: 'var(--ddd)', symbol: 'square', dashPattern: '' },
  {
    key: 'openHotspots',
    label: 'Open hotspots',
    color: 'var(--danger)',
    symbol: 'diamond',
    dashPattern: '5 3',
  },
];
const architectureSeries: readonly Series[] = [
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

function plot<M>(
  h: HtmlBuilder<M>,
  samples: readonly Sample[],
  inspected: Sample,
  perspective: Perspective,
  onReview?: (version: number) => M,
) {
  const active =
    perspective === 'workshop'
      ? workshopSeries
      : architectureSeries.filter(({ key }) => samples.some(({ counts }) => counts[key] > 0));
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
        description:
          'Counts by confirmed version. Use Inspect version for exact counts and Open on canvas to rewind.',
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
            perspective === 'workshop'
              ? points
              : points.filter(({ datum }) => datum.version === inspected.version),
          ),
          styleFor: (point) => styleFor(point.seriesKey),
          labelFor: (row) => `${row.label}: ${row.count}`,
          activeKey: `${inspected.version}/openHotspots`,
        }),
        ...(onReview
          ? samples.map(({ version }) => {
              const { plot, x } = geometry.layout;
              const left = Math.max(plot.left, x(version - 0.5));
              const right = Math.min(plot.right, x(version + 0.5));
              return h.rect(
                [
                  h.Key(String(version)),
                  h.DataAttribute('evolution-version', String(version)),
                  h.X(String(left)),
                  h.Y(String(plot.top)),
                  h.Width(String(right - left)),
                  h.Height(String(plot.height)),
                  h.Class('evolution-version-target'),
                  h.OnClick(onReview(version)),
                ],
                [h.title([], [`Review version ${version}`])],
              );
            })
          : []),
      ],
    ),
    legend(h, { entries, theme }),
    ...(onReview ? [h.p([], ['Select a point to rewind to its version.'])] : []),
  ];
}

export function view<M>(
  h: HtmlBuilder<M>,
  history: History,
  connection: 'live' | 'offline' | 'denied',
  onInspect: (value: string) => M,
  onReview: (version: number, baseline?: number) => M,
  availability: 'available' | 'blocked',
  perspective: Perspective,
) {
  const first = history.samples[0];
  const last = history.samples.at(-1);
  const inspected = history.samples.find(({ version }) => version === history.inspected) ?? last;
  const reviewVersion = (version: number) =>
    onReview(
      version,
      perspective === 'workshop' && first && version > first.version ? version - 1 : undefined,
    );
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
                  ...plot(
                    h,
                    history.samples,
                    inspected,
                    perspective,
                    connection === 'live' && availability === 'available'
                      ? reviewVersion
                      : undefined,
                  ),
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
                h.Disabled(connection !== 'live' || availability === 'blocked'),
                h.OnClick(reviewVersion(inspected.version)),
              ],
              ['Open on canvas'],
            ),
            dataTable(h, {
              caption: `Counts at version ${inspected.version}`,
              headers: ['Type', 'Count'],
              rows: (perspective === 'workshop' ? workshopSeries : architectureSeries).map(
                ({ key, label }) => [label, String(inspected.counts[key])],
              ),
            }),
          ]
        : [h.p([h.Role('status')], ['Waiting for the first confirmed diagram version.'])];
  return h.section(
    [h.Class('board-evolution'), h.AriaLabel('Diagram Evolution')],
    [heading, ...contents],
  );
}
