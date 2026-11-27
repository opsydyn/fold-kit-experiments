import type { View } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { resolveSeriesStyle } from '@opsydyn/foldkit-viz/chart/theme';
import { axis, chartFrame, grid, pointSeries } from '@opsydyn/foldkit-viz/effect-ui/cartesian';
import { selectionContainsValue } from '@opsydyn/foldkit-viz/interaction/selection';

import { exampleTheme } from '#example/frame';

import { deriveComparisonChart } from './comparison';
import { comparisonPanel, comparisonLayers, baselineReferenceList } from './comparison-view';
import { currentSignalSource, deriveSignalChart, inspectionNotice, utc } from './derive';
import { eventPanel, eventGuideLayers } from './event-view';
import { ObserveSignalInput } from './input';
import { Message } from './message';
import { Model } from './model';
import type { ReadyModel, ChartRole } from './model';
import { readingText, sourceFreshness } from './quality';
import { qualityLayers, qualityLegend, qualityDetails } from './quality-view';
const labels = { overview: 'Latency overview', latency: 'Latency detail', errors: 'Error detail' };
const theme = { ...exampleTheme, labelSize: 11 };
function signalChart(m: ReadyModel, role: ChartRole, h: Html.H<Message>): View.Content<Message> {
  const chart = deriveSignalChart(m, role);
  const { geometry, inspected } = chart;
  const { layout } = geometry;
  const { plot } = layout;
  const colour =
    role === 'errors'
      ? 'var(--chart-series-b, var(--coral))'
      : 'var(--chart-series-a, var(--blue))';
  const style = resolveSeriesStyle(
    theme,
    { stroke: colour, fill: colour, strokeWidth: 2.5, pointRadius: 3 },
    {},
    {},
  );
  const visiblePin =
    inspected !== null && inspected.time >= m.viewport[0] && inspected.time <= m.viewport[1];
  const point = visiblePin ? geometry.points.filter((p) => p.key === inspected.id) : [];
  const brush =
    m.gesture._tag === 'Brushing'
      ? [
          Math.min(m.gesture.anchorTime, m.gesture.currentTime),
          Math.max(m.gesture.anchorTime, m.gesture.currentTime),
        ]
      : null;
  const interval = brush ?? (m.selection._tag === 'Interval' ? m.selection.domain : null);
  const rect: readonly [number, number] | null =
    interval === null
      ? null
      : [Math.max(plot.left, layout.x(interval[0])), Math.min(plot.right, layout.x(interval[1]))];
  const highlight =
    rect !== null && rect[1] > rect[0]
      ? h
          .el('rect')
          .attr('x', String(rect[0]))
          .attr('y', String(plot.top))
          .attr('width', String(rect[1] - rect[0]))
          .attr('height', String(plot.height))
          .attr('fill', colour)
          .attr('fill-opacity', brush ? '0.1' : '0.16')
          .attr('stroke', colour)
          .attr('stroke-dasharray', brush ? '3 3' : '1 4')
          .attr('aria-hidden', 'true')
          .children()
      : null;
  const cursor =
    visiblePin && inspected !== null
      ? h
          .el('line')
          .attr('class', 'signal-cursor')
          .attr('x1', String(layout.x(inspected.time)))
          .attr('x2', String(layout.x(inspected.time)))
          .attr('y1', String(plot.top))
          .attr('y2', String(plot.bottom))
          .attr('stroke', theme.text)
          .attr('stroke-dasharray', '2 4')
          .attr('aria-hidden', 'true')
          .children()
      : null;
  return h.section
    .attr('class', `signal-plot signal-plot-${role}`)
    .attr('data-chart-role', role)
    .children(
      h.div
        .attr('class', 'signal-plot-heading')
        .children(
          h.h2.children(labels[role]),
          h.span.children(role === 'errors' ? '% / ERROR RATE' : 'ms / RESPONSE TIME'),
        ),
      chartFrame(
        h,
        {
          layout,
          title: labels[role],
          description:
            role === 'overview'
              ? 'Illustrative static telemetry. Drag to select a time interval.'
              : 'Illustrative static telemetry. Drag to pan. Arrow keys inspect; Home and End move to visible boundaries.',
          theme,
        },
        [
          grid(h, { ...geometry, theme }),
          h.el('defs').children(
            h
              .el('clipPath')
              .attr('id', `signal-quality-clip-${role}`)
              .children(
                h
                  .el('rect')
                  .attr('x', String(plot.left))
                  .attr('y', String(plot.top))
                  .attr('width', String(plot.width))
                  .attr('height', String(plot.height))
                  .children(),
              ),
          ),
          ...qualityLayers(
            m,
            role,
            chart,
            h,
            new Set(deriveComparisonChart(m, role, layout).errorBars.map(({ mark }) => mark.key)),
          ),
          h
            .el('g')
            .attr('clip-path', `url(#signal-quality-clip-${role})`)
            .children(
              highlight,
              ...comparisonLayers(m, role, layout, h),
              ...eventGuideLayers(m, role, layout, h),
              pointSeries(h, {
                points: point,
                styleFor: (p) =>
                  (role === 'errors' ? p.datum.errors : p.datum.latency)._tag === 'Estimated'
                    ? { ...style, symbol: 'diamond', fill: 'var(--surface)' }
                    : style,
                labelFor: (d) =>
                  `${d.id}, ${utc(d.time)}, ${readingText(d.latency)} ms, ${readingText(d.errors)}%`,
                activeKey: m.inspection.key,
              }),
              cursor,
            ),
          axis(h, {
            layout,
            orientation: 'bottom',
            ticks: geometry.xTicks,
            label: 'Time (UTC)',
            format: (value) => utc(value).slice(11, 19),
            theme,
          }),
          axis(h, {
            layout,
            orientation: 'left',
            ticks: geometry.yTicks,
            label: role === 'errors' ? 'Errors (%)' : 'Latency (ms)',
            format: (value) =>
              role === 'errors' ? String(Number(value.toPrecision(3))) : String(Math.round(value)),
            theme,
          }),
          h
            .el('rect')
            .attr('data-signal-gesture', '')
            .attr('x', String(plot.left))
            .attr('y', String(plot.top))
            .attr('width', String(plot.width))
            .attr('height', String(plot.height))
            .attr('fill', 'transparent')
            .attr('style', `touch-action:none;cursor:${role === 'overview' ? 'crosshair' : 'grab'}`)
            .children(),
        ],
      )
        .attr('tabindex', '0')
        .onMount(ObserveSignalInput({ role })),
      ...(chart.noDrawable
        ? [h.p.attr('class', 'signal-no-data').children('No drawable measurements in this view.')]
        : []),
      h.ul.attr('class', 'signal-reference-list').children(
        ...baselineReferenceList(m, role, h),
        ...chart.thresholds.map((t) =>
          h.li
            .key(t.id)
            .attr('data-threshold-id', t.id)
            .children(
              `Illustrative reference: ${t.label} · ${t.value} ${role === 'errors' ? '%' : 'ms'}`,
            ),
        ),
      ),
      h.p
        .attr('class', 'signal-input-status')
        .children(
          m.inputStatus[role] === 'Ready'
            ? role === 'overview'
              ? 'Drag a range · tap to inspect'
              : 'Drag to pan · ← → inspect · Home / End'
            : 'Input unavailable · keyboard and range controls remain available',
        ),
    );
}
function readyView(m: ReadyModel, h: Html.H<Message>): View.Content<Message> {
  const inspected = m.records.find((d) => d.id === m.inspection.key);
  const lastIndex = m.records.length - 1;
  const selected = m.selection._tag === 'Interval' ? m.selection.domain : m.bounds;
  const lo = Math.max(
    0,
    m.records.findIndex((d) => d.time >= selected[0]),
  );
  const hi = Math.max(
    lo,
    m.records.findLastIndex((d) => d.time <= selected[1]),
  );
  const button = (label: string, message: Message, disabled = false) =>
    h.button.attr('type', 'button').on('click', message).disabled(disabled).children(label);
  const range = (id: string, label: string, value: number, toMessage: (index: number) => Message) =>
    h.div.attr('class', 'signal-range').children(
      h.label.attr('for', id).children(label, h.span.children(`Record ${value}`)),
      h.input
        .attr('id', id)
        .attr('type', 'range')
        .attr('min', '0')
        .attr('max', String(lastIndex))
        .attr('step', '1')
        .attr('value', String(value))
        .disabled(lastIndex < 1)
        .on('input', ({ value }) => toMessage(Number(value))),
    );
  return h.div.attr('class', 'signal-desk').children(
    h.div
      .attr('class', 'signal-meta')
      .children(
        h.span.children(`${m.records.length} RECORDS · GAPS EXPLICIT`),
        h.span.children(`${utc(m.bounds[0]).slice(0, 10)} / UTC`),
        h.span.children('ILLUSTRATIVE · STATIC'),
      ),
    h.section
      .attr('class', 'signal-source-status')
      .attr('data-freshness', sourceFreshness(m.snapshot))
      .children(
        h.p.children(`Source: ${sourceFreshness(m.snapshot)} · ${m.snapshot.revision}`),
        h.p.children(
          `As of ${utc(m.snapshot.asOf)} · updated ${utc(m.snapshot.updatedAt)} · stale after ${m.snapshot.staleAfterMs} ms`,
        ),
        h.div
          .attr('class', 'signal-controls')
          .children(
            button('Fresh snapshot', Message.ClickedFreshnessScenario({ scenario: 'Fresh' })),
            button('Stale snapshot', Message.ClickedFreshnessScenario({ scenario: 'Stale' })),
          ),
      ),
    qualityLegend(h),
    signalChart(m, 'overview', h),
    h.div.attr('class', 'signal-ranges').children(
      range('signal-range-start', 'Range start', lo, (index) =>
        Message.ChangedRangeStart({ index }),
      ),
      range('signal-range-end', 'Range end', hi, (index) => Message.ChangedRangeEnd({ index })),
    ),
    h.div
      .attr('class', 'signal-controls')
      .children(
        button('Zoom in', Message.ClickedZoomIn(), m.viewport[1] - m.viewport[0] <= 1000),
        button(
          'Zoom out',
          Message.ClickedZoomOut(),
          m.viewport[0] === m.bounds[0] && m.viewport[1] === m.bounds[1],
        ),
        button('Reset view', Message.ClickedResetView()),
        button('Clear selection', Message.ClickedClearSelection()),
        button(
          'Pin inspection',
          Message.ClickedPinInspection(),
          inspected === undefined || m.inspection._tag === 'Pinned',
        ),
        button(
          'Resume inspection',
          Message.ClickedResumeInspection(),
          m.inspection._tag === 'Following',
        ),
      ),
    h.div
      .attr('class', 'signal-view-state')
      .children(
        h.p.children(`View: ${utc(m.viewport[0])} → ${utc(m.viewport[1])}`),
        h.p.children(
          m.selection._tag === 'Interval'
            ? `Selection: ${utc(m.selection.domain[0])} → ${utc(m.selection.domain[1])}`
            : 'Selection: none',
        ),
      ),
    h.section
      .attr('class', 'signal-inspector')
      .attr('aria-live', 'polite')
      .children(
        h.p.attr('class', 'signal-inspection-notice').children(inspectionNotice(m)),
        h.p
          .attr('class', 'signal-reading-detail')
          .children(
            `Source: ${sourceFreshness(m.snapshot)} · ${m.snapshot.revision} · as of ${utc(m.snapshot.asOf)} · updated ${utc(m.snapshot.updatedAt)} · stale after ${m.snapshot.staleAfterMs} ms`,
          ),
        h.dl.children(
          h.div.children(
            h.dt.children('Observation / UTC'),
            h.dd.children(inspected ? `${inspected.id} / ${utc(inspected.time)}` : '—'),
          ),
          h.div.children(
            h.dt.children('Latency (ms)'),
            h.dd.children(inspected ? readingText(inspected.latency) : '—'),
            ...(inspected
              ? [
                  h.p
                    .attr('class', 'signal-reading-detail')
                    .children(qualityDetails(inspected.latency, 'ms')),
                ]
              : []),
          ),
          h.div.children(
            h.dt.children('Errors (%)'),
            h.dd.children(inspected ? readingText(inspected.errors) : '—'),
            ...(inspected
              ? [
                  h.p
                    .attr('class', 'signal-reading-detail')
                    .children(qualityDetails(inspected.errors, '%')),
                ]
              : []),
          ),
        ),
      ),
    comparisonPanel(m, h),
    eventPanel(m, deriveSignalChart(m, 'latency').geometry.layout, h),
    signalChart(m, 'latency', h),
    signalChart(m, 'errors', h),
    h.details.attr('class', 'signal-records').children(
      h.summary.children(`Raw observations (${m.records.length})`),
      h.div.attr('class', 'signal-table-scroll').children(
        h.table.children(
          h.caption.children(
            `Illustrative system telemetry. Source: ${sourceFreshness(m.snapshot)} · ${m.snapshot.revision}. All records, including those outside the current view.`,
          ),
          h.thead.children(
            h.tr.children(
              [
                'Observation',
                'Time (UTC)',
                'Latency (ms)',
                'Errors (%)',
                'Latency quality',
                'Error quality',
                'State',
              ].map((label) => h.th.attr('scope', 'col').children(label)),
            ),
          ),
          h.tbody.children(
            m.records.map((d) => {
              const active = d.id === m.inspection.key;
              const selected = selectionContainsValue(m.selection, 'x', d.time);
              return h.tr
                .key(d.id)
                .attr('data-record-id', d.id)
                .attr(
                  'class',
                  active ? 'signal-row-inspected' : selected ? 'signal-row-selected' : '',
                )
                .children(
                  h.th.attr('scope', 'row').children(d.id),
                  h.td.children(utc(d.time)),
                  h.td.children(readingText(d.latency)),
                  h.td.children(readingText(d.errors)),
                  h.td.children(qualityDetails(d.latency, 'ms')),
                  h.td.children(qualityDetails(d.errors, '%')),
                  h.td.children(
                    `${active ? 'Inspected' : ''}${active && selected ? ' · ' : ''}${selected ? 'Selected' : ''}${!active && !selected ? '—' : ''}`,
                  ),
                );
            }),
          ),
        ),
      ),
    ),
    h.details
      .attr('class', 'signal-source')
      .children(
        h.summary.children('Controlled state / source'),
        h.pre.children(h.code.children(currentSignalSource(m))),
      ),
  );
}
export const view = (h: Html.H<Message>, model: Model) =>
  Model.match(model, {
    Empty: () =>
      h.section
        .attr('class', 'signal-desk')
        .children(
          h.h2.children('No observations'),
          h.p.children('Provide records to explore a signal.'),
        ),
    Invalid: ({ error }) =>
      h.section
        .attr('class', 'signal-desk')
        .children(h.h2.children('Cannot display observations'), h.p.children(error)),
    Ready: (m) => readyView(m, h),
  });
