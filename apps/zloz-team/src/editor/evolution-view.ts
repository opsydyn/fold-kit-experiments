import type { Html } from '@effect/ui/html';
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
  lineSeries,
  pointSeries,
} from '@opsydyn/foldkit-viz/effect-ui/cartesian';
import { symbolPath } from '@opsydyn/foldkit-viz/shape/symbol';

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
  h: Html.H<M>,
  samples: readonly Sample[],
  inspected: Sample,
  perspective: Perspective,
  onReview?: (version: number) => M,
) {
  const active =
    perspective === 'workshop'
      ? workshopSeries
      : architectureSeries.filter(({ key }) => samples.some(({ counts }) => counts[key] > 0));
  if (active.length === 0) return [h.p.children('No nodes or relationships in this window.')];

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
              return h
                .el('rect')
                .key(String(version))
                .attr('data-evolution-version', String(version))
                .attr('x', String(left))
                .attr('y', String(plot.top))
                .attr('width', String(right - left))
                .attr('height', String(plot.height))
                .attr('class', 'evolution-version-target')
                .on('click', onReview(version))
                .children(h.el('title').children(`Review version ${version}`));
            })
          : []),
      ],
    ),
    h.ul
      .class('chart-legend')
      .style({
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        padding: '0',
        margin: '12px 0',
        listStyle: 'none',
        color: theme.text,
        fontFamily: theme.fontFamily,
        fontSize: `${theme.labelSize}px`,
      })
      .children(
        ...entries.map(({ key, label, style }) =>
          h.li
            .key(key)
            .style({ display: 'flex', alignItems: 'center', gap: '6px' })
            .children(
              h
                .el('svg')
                .attrs({
                  width: '20',
                  height: '20',
                  viewBox: '-10 -10 20 20',
                  'aria-hidden': 'true',
                })
                .children(
                  h
                    .el('path')
                    .attrs({
                      'data-symbol': style.symbol,
                      d: symbolPath(style.symbol, 64),
                      fill: style.fill,
                      stroke: style.stroke,
                      'stroke-width': String(style.strokeWidth),
                      opacity: String(style.opacity),
                    })
                    .children(),
                ),
              label,
            ),
        ),
      ),
    ...(onReview ? [h.p.children('Select a point to rewind to its version.')] : []),
  ];
}

export function view<M>(
  h: Html.H<M>,
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
  const heading = h.h2.class('rail-heading').children('Diagram Evolution');
  const contents =
    connection === 'denied'
      ? [h.p.children('Access ended.')]
      : first && last && inspected
        ? [
            h.p
              .class('evolution-window')
              .children(
                first.version === last.version
                  ? `Version ${last.version}`
                  : `Versions ${first.version}–${last.version}`,
              ),
            h.p.children(
              `This tab · up to ${windowSize} consecutive confirmed versions. Reload starts a new window.`,
            ),
            ...(history.restartedAfterGap
              ? [h.p.children('The window restarted after a gap in confirmed versions.')]
              : []),
            ...(connection === 'offline'
              ? [
                  h.p
                    .attr('role', 'status')
                    .children('Showing the latest observed counts while reconnecting.'),
                ]
              : []),
            ...(first.version === last.version
              ? [h.p.children('The chart appears after another confirmed version arrives.')]
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
                  h.label.attr('for', 'board-evolution-version').children('Inspect version'),
                  h.select
                    .id('board-evolution-version')
                    .value(history.inspected === null ? 'latest' : String(history.inspected))
                    .on('change', ({ value }) => onInspect(value))
                    .children(
                      h.option.attr('value', 'latest').children(`Latest (v${last.version})`),
                      ...history.samples.map(({ version }) =>
                        h.option.attr('value', String(version)).children(`Version ${version}`),
                      ),
                    ),
                ]),
            h.button
              .id('board-open-history')
              .attr('type', 'button')
              .disabled(connection !== 'live' || availability === 'blocked')
              .on('click', reviewVersion(inspected.version))
              .children('Open on canvas'),
            dataTable(h, {
              caption: `Counts at version ${inspected.version}`,
              headers: ['Type', 'Count'],
              rows: (perspective === 'workshop' ? workshopSeries : architectureSeries).map(
                ({ key, label }) => [label, String(inspected.counts[key])],
              ),
            }),
          ]
        : [h.p.attr('role', 'status').children('Waiting for the first confirmed diagram version.')];
  return h.section
    .class('board-evolution')
    .attr('aria-label', 'Diagram Evolution')
    .children(heading, ...contents);
}
