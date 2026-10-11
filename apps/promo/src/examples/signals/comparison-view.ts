import type { CartesianLayout } from '@opsydyn/foldkit-viz/chart/cartesian';
import type { ErrorBarSegment } from '@opsydyn/foldkit-viz/chart/errorBars';
import { resolveSeriesStyle } from '@opsydyn/foldkit-viz/chart/theme';
import { pointSeries } from '@opsydyn/foldkit-viz/foldkit/cartesian';
import type { Html, HtmlBuilder } from 'foldkit/html';

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
  h: HtmlBuilder<Message>,
): Html =>
  h.article(
    [h.Class('signal-comparison-record')],
    [
      h.h3([], [label]),
      record === null
        ? h.p([], [captured ? 'No baseline captured' : 'No current inspection'])
        : h.p([h.Class('signal-comparison-identity')], [`${record.id} / ${utc(record.time)}`]),
      ...(record === null
        ? []
        : [
            h.dl(
              [],
              (['latency', 'errors'] as const).map((metric) => {
                const unit = metric === 'latency' ? 'ms' : '%',
                  reading = record[metric];
                return h.div(
                  [],
                  [
                    h.dt([], [metric === 'latency' ? 'Latency (ms)' : 'Errors (%)']),
                    h.dd(
                      [],
                      [
                        `${readingText(reading)}${readingValue(reading) === null ? '' : ` ${unit}`}`,
                      ],
                    ),
                    h.p([h.Class('signal-reading-detail')], [qualityDetails(reading, unit)]),
                  ],
                );
              }),
            ),
          ]),
      ...(snapshot === null
        ? []
        : [
            h.p(
              [h.Class('signal-reading-detail')],
              [
                `${captured ? 'Baseline source' : 'Current source'}: ${sourceFreshness(snapshot)}${captured ? ' at capture' : ''} · ${snapshot.revision} · as of ${utc(snapshot.asOf)} · updated ${utc(snapshot.updatedAt)} · stale after ${snapshot.staleAfterMs} ms`,
              ],
            ),
          ]),
    ],
  );
export const comparisonPanel = (model: ReadyModel, h: HtmlBuilder<Message>): Html => {
  const comparison = deriveSignalComparison(model);
  const captured = Baseline.match(model.baseline, { None: () => null, Captured: (b) => b });
  const delta = (label: string, value: MetricComparison) =>
    h.div(
      [],
      [
        h.dt([], [label]),
        MetricComparison.match(value, {
          Available: (r) =>
            h.dd(
              [h.Class('signal-comparison-delta')],
              [`${r.delta > 0 ? '+' : ''}${r.delta} ${r.unit}`],
            ),
          Unavailable: (r) =>
            h.dd(
              [h.Class('signal-comparison-unavailable')],
              [
                {
                  NoBaseline: 'No baseline captured',
                  NoCurrent: 'No current inspection',
                  NonNumeric: 'Comparison unavailable',
                }[r.reason],
              ],
            ),
        }),
      ],
    );
  return h.section(
    [h.Class('signal-comparison')],
    [
      h.h2([], ['Compare observations']),
      h.p(
        [h.Class('signal-reading-detail')],
        [
          'Capture a baseline, then resume inspection to compare another record. Supplied ranges describe each reading; differences do not imply statistical significance.',
        ],
      ),
      h.div(
        [h.Class('signal-controls')],
        [
          h.button(
            [
              h.Type('button'),
              h.OnClick(Message.ClickedCaptureBaseline()),
              h.Disabled(comparison.current === null),
            ],
            [captured === null ? 'Capture baseline' : 'Replace baseline'],
          ),
          h.button(
            [
              h.Type('button'),
              h.OnClick(Message.ClickedClearBaseline()),
              h.Disabled(captured === null),
            ],
            ['Clear baseline'],
          ),
        ],
      ),
      h.div(
        [h.Class('signal-comparison-grid'), h.AriaLive('polite')],
        [
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
          h.dl(
            [h.Class('signal-comparison-differences')],
            [
              delta('Latency difference', comparison.latency),
              delta('Error rate difference', comparison.errors),
            ],
          ),
          ...(comparison.baselineOutsideView
            ? [
                h.p(
                  [h.Class('signal-comparison-outside')],
                  ['Outside current view · captured baseline retained'],
                ),
              ]
            : []),
        ],
      ),
    ],
  );
};
export const comparisonLayers = (
  model: ReadyModel,
  role: ChartRole,
  layout: CartesianLayout,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => {
  const chart = deriveComparisonChart(model, role, layout),
    metric = role === 'errors' ? 'errors' : 'latency';
  const colour =
    role === 'errors'
      ? 'var(--chart-series-b, var(--coral))'
      : 'var(--chart-series-a, var(--blue))';
  const segment = (part: ErrorBarSegment, cap: boolean) =>
    h.line(
      [
        h.Class(cap ? 'signal-error-bar-cap' : 'signal-error-bar-stem'),
        h.X1(String(part.start[0])),
        h.Y1(String(part.start[1])),
        h.X2(String(part.end[0])),
        h.Y2(String(part.end[1])),
      ],
      [],
    );
  const layers: Html[] = chart.errorBars.map(({ purpose, mark }) => {
    const estimated = mark.datum[metric]._tag === 'Estimated';
    const equal =
      mark.lowerCap.start[0] === mark.upperCap.start[0] &&
      mark.lowerCap.start[1] === mark.upperCap.start[1];
    return h.g(
      [
        h.Key(`${purpose}-${mark.key}`),
        h.Class('signal-comparison-error-bar'),
        h.DataAttribute('comparison-purpose', purpose),
        h.AriaLabel(
          `${purpose === 'inspection' ? 'Inspected interval' : 'Comparison baseline interval'}: ${mark.key} · ${mark.datum[metric]._tag}`,
        ),
        h.Stroke(colour),
        h.StrokeWidth('1.5'),
        h.StrokeDasharray(purpose === 'inspection' ? (estimated ? '7 4' : '') : '3 3'),
        h.Fill('none'),
      ],
      [
        segment(mark.stem, false),
        segment(mark.lowerCap, true),
        ...(equal ? [] : [segment(mark.upperCap, true)]),
      ],
    );
  });
  const reference = chart.baselineReference;
  if (reference !== null) {
    const x = layout.x(reference.record.time),
      y = layout.y(reference.value);
    if (role !== 'overview')
      layers.push(
        h.line(
          [
            h.Class('signal-baseline-reference'),
            h.AriaLabel(
              `Comparison baseline: ${reference.record.id} · ${reference.value} ${metric === 'latency' ? 'ms' : '%'}`,
            ),
            h.X1(String(layout.plot.left)),
            h.X2(String(layout.plot.right)),
            h.Y1(String(y)),
            h.Y2(String(y)),
            h.Stroke(colour),
            h.StrokeWidth('1'),
            h.StrokeDasharray('3 3'),
          ],
          [],
        ),
      );
    else if (
      reference.record.time >= layout.xDomain[0] &&
      reference.record.time <= layout.xDomain[1]
    )
      layers.push(
        h.line(
          [
            h.Class('signal-baseline-time'),
            h.AriaLabel(`Baseline time: ${utc(reference.record.time)}`),
            h.X1(String(x)),
            h.X2(String(x)),
            h.Y1(String(layout.plot.top)),
            h.Y2(String(layout.plot.bottom)),
            h.Stroke(colour),
            h.StrokeWidth('1'),
            h.StrokeDasharray('3 3'),
          ],
          [],
        ),
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
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> =>
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
                h.li(
                  [h.Key(`baseline-${role}`), h.Class('signal-baseline-meaning')],
                  [
                    `Comparison baseline: ${record.id} / ${utc(record.time)} · ${value} ${role === 'errors' ? '%' : 'ms'} · ${qualityDetails(reading, role === 'errors' ? '%' : 'ms')}`,
                  ],
                ),
              ];
        },
      });
