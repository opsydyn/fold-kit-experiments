import type { View } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import type { CartesianLayout } from '@opsydyn/foldkit-viz/chart/cartesian';
import type { ErrorBarSegment } from '@opsydyn/foldkit-viz/chart/errorBars';
import { resolveSeriesStyle } from '@opsydyn/foldkit-viz/chart/theme';
import { pointSeries } from '@opsydyn/foldkit-viz/effect-ui/cartesian';

import { exampleTheme } from '#example/frame';

import { Baseline } from './baseline';
import { deriveComparisonChart, deriveSignalComparison, MetricComparison } from './comparison';
import { utc } from './derive';
import { Message } from './message';
import type { ReadyModel, ChartRole } from './model';
import { readingText, readingValue, sourceFreshness } from './quality';
import type { SignalRecord, SourceSnapshot } from './quality';
import { qualityDetails } from './quality-view';

const recordSummary = (
  label: string,
  record: SignalRecord | null,
  snapshot: SourceSnapshot | null,
  captured: boolean,
  h: Html.H<Message>,
): View.Content<Message> =>
  h.article.attr('class', 'signal-comparison-record').children(
    h.h3.children(label),
    record === null
      ? h.p.children(captured ? 'No baseline captured' : 'No current inspection')
      : h.p
          .attr('class', 'signal-comparison-identity')
          .children(`${record.id} / ${utc(record.time)}`),
    ...(record === null
      ? []
      : [
          h.dl.children(
            (['latency', 'errors'] as const).map((metric) => {
              const unit = metric === 'latency' ? 'ms' : '%',
                reading = record[metric];
              return h.div.children(
                h.dt.children(metric === 'latency' ? 'Latency (ms)' : 'Errors (%)'),
                h.dd.children(
                  `${readingText(reading)}${readingValue(reading) === null ? '' : ` ${unit}`}`,
                ),
                h.p.attr('class', 'signal-reading-detail').children(qualityDetails(reading, unit)),
              );
            }),
          ),
        ]),
    ...(snapshot === null
      ? []
      : [
          h.p
            .attr('class', 'signal-reading-detail')
            .children(
              `${captured ? 'Baseline source' : 'Current source'}: ${sourceFreshness(snapshot)}${captured ? ' at capture' : ''} · ${snapshot.revision} · as of ${utc(snapshot.asOf)} · updated ${utc(snapshot.updatedAt)} · stale after ${snapshot.staleAfterMs} ms`,
            ),
        ]),
  );
export const comparisonPanel = (model: ReadyModel, h: Html.H<Message>): View.Content<Message> => {
  const comparison = deriveSignalComparison(model);
  const captured = Baseline.match(model.baseline, { None: () => null, Captured: (b) => b });
  const delta = (label: string, value: MetricComparison) =>
    h.div.children(
      h.dt.children(label),
      MetricComparison.match(value, {
        Available: (r) =>
          h.dd
            .attr('class', 'signal-comparison-delta')
            .children(`${r.delta > 0 ? '+' : ''}${r.delta} ${r.unit}`),
        Unavailable: (r) =>
          h.dd.attr('class', 'signal-comparison-unavailable').children(
            {
              NoBaseline: 'No baseline captured',
              NoCurrent: 'No current inspection',
              NonNumeric: 'Comparison unavailable',
            }[r.reason],
          ),
      }),
    );
  return h.section.attr('class', 'signal-comparison').children(
    h.h2.children('Compare observations'),
    h.p
      .attr('class', 'signal-reading-detail')
      .children(
        'Capture a baseline, then resume inspection to compare another record. Supplied ranges describe each reading; differences do not imply statistical significance.',
      ),
    h.div.attr('class', 'signal-controls').children(
      h.button
        .attr('type', 'button')
        .on('click', Message.ClickedCaptureBaseline())
        .disabled(comparison.current === null)
        .children(captured === null ? 'Capture baseline' : 'Replace baseline'),
      h.button
        .attr('type', 'button')
        .on('click', Message.ClickedClearBaseline())
        .disabled(captured === null)
        .children('Clear baseline'),
    ),
    h.div
      .attr('class', 'signal-comparison-grid')
      .attr('aria-live', 'polite')
      .children(
        recordSummary(
          'Captured baseline',
          captured?.record ?? null,
          captured?.snapshot ?? null,
          true,
          h,
        ),
        recordSummary(
          'Current inspection',
          comparison.current,
          comparison.current === null ? null : model.snapshot,
          false,
          h,
        ),
        h.dl
          .attr('class', 'signal-comparison-differences')
          .children(
            delta('Latency difference', comparison.latency),
            delta('Error rate difference', comparison.errors),
          ),
        ...(comparison.baselineOutsideView
          ? [
              h.p
                .attr('class', 'signal-comparison-outside')
                .children('Outside current view · captured baseline retained'),
            ]
          : []),
      ),
  );
};
export const comparisonLayers = (
  model: ReadyModel,
  role: ChartRole,
  layout: CartesianLayout,
  h: Html.H<Message>,
): ReadonlyArray<View.Content<Message>> => {
  const chart = deriveComparisonChart(model, role, layout),
    metric = role === 'errors' ? 'errors' : 'latency';
  const colour =
    role === 'errors'
      ? 'var(--chart-series-b, var(--coral))'
      : 'var(--chart-series-a, var(--blue))';
  const segment = (part: ErrorBarSegment, cap: boolean) =>
    h
      .el('line')
      .attr('class', cap ? 'signal-error-bar-cap' : 'signal-error-bar-stem')
      .attr('x1', String(part.start[0]))
      .attr('y1', String(part.start[1]))
      .attr('x2', String(part.end[0]))
      .attr('y2', String(part.end[1]))
      .children();
  const layers: View.Content<Message>[] = chart.errorBars.map(({ purpose, mark }) => {
    const estimated = mark.datum[metric]._tag === 'Estimated';
    const equal =
      mark.lowerCap.start[0] === mark.upperCap.start[0] &&
      mark.lowerCap.start[1] === mark.upperCap.start[1];
    return h
      .el('g')
      .key(`${purpose}-${mark.key}`)
      .attr('class', 'signal-comparison-error-bar')
      .attr('data-comparison-purpose', purpose)
      .attr(
        'aria-label',
        `${purpose === 'inspection' ? 'Inspected interval' : 'Comparison baseline interval'}: ${mark.key} · ${mark.datum[metric]._tag}`,
      )
      .attr('stroke', colour)
      .attr('stroke-width', '1.5')
      .attr('stroke-dasharray', purpose === 'inspection' ? (estimated ? '7 4' : '') : '3 3')
      .attr('fill', 'none')
      .children(
        segment(mark.stem, false),
        segment(mark.lowerCap, true),
        ...(equal ? [] : [segment(mark.upperCap, true)]),
      );
  });
  const reference = chart.baselineReference;
  if (reference !== null) {
    const x = layout.x(reference.record.time),
      y = layout.y(reference.value);
    if (role !== 'overview')
      layers.push(
        h
          .el('line')
          .attr('class', 'signal-baseline-reference')
          .attr(
            'aria-label',
            `Comparison baseline: ${reference.record.id} · ${reference.value} ${metric === 'latency' ? 'ms' : '%'}`,
          )
          .attr('x1', String(layout.plot.left))
          .attr('x2', String(layout.plot.right))
          .attr('y1', String(y))
          .attr('y2', String(y))
          .attr('stroke', colour)
          .attr('stroke-width', '1')
          .attr('stroke-dasharray', '3 3')
          .children(),
      );
    else if (
      reference.record.time >= layout.xDomain[0] &&
      reference.record.time <= layout.xDomain[1]
    )
      layers.push(
        h
          .el('line')
          .attr('class', 'signal-baseline-time')
          .attr('aria-label', `Baseline time: ${utc(reference.record.time)}`)
          .attr('x1', String(x))
          .attr('x2', String(x))
          .attr('y1', String(layout.plot.top))
          .attr('y2', String(layout.plot.bottom))
          .attr('stroke', colour)
          .attr('stroke-width', '1')
          .attr('stroke-dasharray', '3 3')
          .children(),
      );
    if (reference.record.id !== model.inspection.key)
      layers.push(
        pointSeries(h, {
          points: [{ datum: reference.record, key: reference.record.id, seriesKey: role, x, y }],
          styleFor: () =>
            resolveSeriesStyle(
              exampleTheme,
              {
                stroke: colour,
                fill: reference.reading._tag === 'Estimated' ? 'var(--surface)' : colour,
                strokeWidth: 1.5,
                pointRadius: 3,
                symbol: reference.reading._tag === 'Estimated' ? 'diamond' : 'circle',
              },
              {},
              {},
            ),
          labelFor: (d) => `Comparison baseline ${d.id} · ${reference.reading._tag}`,
          activeKey: null,
        }),
      );
  }
  return layers;
};
export const baselineReferenceList = (
  model: ReadyModel,
  role: ChartRole,
  h: Html.H<Message>,
): ReadonlyArray<View.Content<Message>> =>
  role === 'overview'
    ? []
    : Baseline.match(model.baseline, {
        None: () => [],
        Captured: ({ record }) => {
          const reading = role === 'errors' ? record.errors : record.latency,
            value = readingValue(reading);
          return value === null
            ? []
            : [
                h.li
                  .key(`baseline-${role}`)
                  .attr('class', 'signal-baseline-meaning')
                  .children(
                    `Comparison baseline: ${record.id} / ${utc(record.time)} · ${value} ${role === 'errors' ? '%' : 'ms'} · ${qualityDetails(reading, role === 'errors' ? '%' : 'ms')}`,
                  ),
              ];
        },
      });
