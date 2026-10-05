import { resolveSeriesStyle } from '@opsydyn/foldkit-viz/chart/theme';
import { axis, chartFrame, grid, pointSeries } from '@opsydyn/foldkit-viz/foldkit/cartesian';
import { selectionContainsValue } from '@opsydyn/foldkit-viz/interaction/selection';
import { Option, Schema } from 'effect';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import { exampleTheme } from '#example/frame';

import { currentSignalSource, deriveSignalChart, inspectionNotice, utc } from './derive';
import { ObserveSignalInput } from './input';
import { Message } from './message';
import { Model } from './model';
import type { ReadyModel, ChartRole } from './model';
import { readingText, sourceFreshness } from './quality';
import { qualityLayers, qualityLegend, qualityDetails } from './quality-view';
const labels = { overview: 'Latency overview', latency: 'Latency detail', errors: 'Error detail' };
const Key = Schema.Literals(['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape']);
const theme = { ...exampleTheme, labelSize: 11 };
function signalChart(m: ReadyModel, role: ChartRole, h: HtmlBuilder<Message>): Html {
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
      ? h.rect(
          [
            h.X(String(rect[0])),
            h.Y(String(plot.top)),
            h.Width(String(rect[1] - rect[0])),
            h.Height(String(plot.height)),
            h.Fill(colour),
            h.FillOpacity(brush ? '0.1' : '0.16'),
            h.Stroke(colour),
            h.StrokeDasharray(brush ? '3 3' : '1 4'),
            h.AriaHidden(true),
          ],
          [],
        )
      : null;
  const cursor =
    visiblePin && inspected !== null
      ? h.line(
          [
            h.Class('signal-cursor'),
            h.X1(String(layout.x(inspected.time))),
            h.X2(String(layout.x(inspected.time))),
            h.Y1(String(plot.top)),
            h.Y2(String(plot.bottom)),
            h.Stroke(theme.text),
            h.StrokeDasharray('2 4'),
            h.AriaHidden(true),
          ],
          [],
        )
      : null;
  return h.section(
    [h.Class(`signal-plot signal-plot-${role}`), h.DataAttribute('chart-role', role)],
    [
      h.div(
        [h.Class('signal-plot-heading')],
        [
          h.h2([], [labels[role]]),
          h.span([], [role === 'errors' ? '% / ERROR RATE' : 'ms / RESPONSE TIME']),
        ],
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
          interactive: true,
          onMount: ObserveSignalInput({ role }),
          onKeyDown: (key) =>
            Schema.is(Key)(key)
              ? Option.some(Message.PressedInspectionKey({ role, key }))
              : Option.none(),
        },
        [
          grid(h, { ...geometry, theme }),
          h.defs(
            [],
            [
              h.clipPath(
                [h.Id(`signal-quality-clip-${role}`)],
                [
                  h.rect(
                    [
                      h.X(String(plot.left)),
                      h.Y(String(plot.top)),
                      h.Width(String(plot.width)),
                      h.Height(String(plot.height)),
                    ],
                    [],
                  ),
                ],
              ),
            ],
          ),
          ...qualityLayers(m, role, chart, h),
          h.g(
            [h.Attribute('clip-path', `url(#signal-quality-clip-${role})`)],
            [
              highlight,

              // Single observations still have an honest visible mark, even without a line segment.
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
            ],
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
          h.rect(
            [
              h.DataAttribute('signal-gesture', ''),
              h.X(String(plot.left)),
              h.Y(String(plot.top)),
              h.Width(String(plot.width)),
              h.Height(String(plot.height)),
              h.Fill('transparent'),
              h.Style({
                'touch-action': 'none',
                cursor: role === 'overview' ? 'crosshair' : 'grab',
              }),
            ],
            [],
          ),
        ],
      ),
      ...(chart.noDrawable
        ? [h.p([h.Class('signal-no-data')], ['No drawable measurements in this view.'])]
        : []),
      h.ul(
        [h.Class('signal-reference-list')],
        chart.thresholds.map((t) =>
          h.li(
            [h.Key(t.id), h.DataAttribute('threshold-id', t.id)],
            [`Illustrative reference: ${t.label} · ${t.value} ${role === 'errors' ? '%' : 'ms'}`],
          ),
        ),
      ),
      h.p(
        [h.Class('signal-input-status')],
        [
          m.inputStatus[role] === 'Ready'
            ? role === 'overview'
              ? 'Drag a range · tap to inspect'
              : 'Drag to pan · ← → inspect · Home / End'
            : 'Input unavailable · keyboard and range controls remain available',
        ],
      ),
    ],
  );
}
function readyView(m: ReadyModel, h: HtmlBuilder<Message>): Html {
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
    h.button([h.Type('button'), h.OnClick(message), h.Disabled(disabled)], [label]);
  const range = (id: string, label: string, value: number, toMessage: (index: number) => Message) =>
    h.div(
      [h.Class('signal-range')],
      [
        h.label([h.For(id)], [label, h.span([], [`Record ${value}`])]),
        h.input([
          h.Id(id),
          h.Type('range'),
          h.Min('0'),
          h.Max(String(lastIndex)),
          h.Step('1'),
          h.Value(String(value)),
          h.Disabled(lastIndex < 1),
          h.OnInput((value) => toMessage(Number(value))),
        ]),
      ],
    );
  return h.div(
    [h.Class('signal-desk')],
    [
      h.div(
        [h.Class('signal-meta')],
        [
          h.span([], [`${m.records.length} RECORDS · GAPS EXPLICIT`]),
          h.span([], [`${utc(m.bounds[0]).slice(0, 10)} / UTC`]),
          h.span([], ['ILLUSTRATIVE · STATIC']),
        ],
      ),
      h.section(
        [
          h.Class('signal-source-status'),
          h.DataAttribute('freshness', sourceFreshness(m.snapshot)),
        ],
        [
          h.p([], [`Source: ${sourceFreshness(m.snapshot)} · ${m.snapshot.revision}`]),
          h.p(
            [],
            [
              `As of ${utc(m.snapshot.asOf)} · updated ${utc(m.snapshot.updatedAt)} · stale after ${m.snapshot.staleAfterMs} ms`,
            ],
          ),
          h.div(
            [h.Class('signal-controls')],
            [
              button('Fresh snapshot', Message.ClickedFreshnessScenario({ scenario: 'Fresh' })),
              button('Stale snapshot', Message.ClickedFreshnessScenario({ scenario: 'Stale' })),
            ],
          ),
        ],
      ),
      qualityLegend(h),
      signalChart(m, 'overview', h),
      h.div(
        [h.Class('signal-ranges')],
        [
          range('signal-range-start', 'Range start', lo, (index) =>
            Message.ChangedRangeStart({ index }),
          ),
          range('signal-range-end', 'Range end', hi, (index) => Message.ChangedRangeEnd({ index })),
        ],
      ),
      h.div(
        [h.Class('signal-controls')],
        [
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
        ],
      ),
      h.div(
        [h.Class('signal-view-state')],
        [
          h.p([], [`View: ${utc(m.viewport[0])} → ${utc(m.viewport[1])}`]),
          h.p(
            [],
            [
              m.selection._tag === 'Interval'
                ? `Selection: ${utc(m.selection.domain[0])} → ${utc(m.selection.domain[1])}`
                : 'Selection: none',
            ],
          ),
        ],
      ),
      h.section(
        [h.Class('signal-inspector'), h.AriaLive('polite')],
        [
          h.p([h.Class('signal-inspection-notice')], [inspectionNotice(m)]),
          h.p(
            [h.Class('signal-reading-detail')],
            [
              `Source: ${sourceFreshness(m.snapshot)} · ${m.snapshot.revision} · as of ${utc(m.snapshot.asOf)} · updated ${utc(m.snapshot.updatedAt)} · stale after ${m.snapshot.staleAfterMs} ms`,
            ],
          ),
          h.dl(
            [],
            [
              h.div(
                [],
                [
                  h.dt([], ['Observation / UTC']),
                  h.dd([], [inspected ? `${inspected.id} / ${utc(inspected.time)}` : '—']),
                ],
              ),
              h.div(
                [],
                [
                  h.dt([], ['Latency (ms)']),
                  h.dd([], [inspected ? readingText(inspected.latency) : '—']),
                  ...(inspected
                    ? [
                        h.p(
                          [h.Class('signal-reading-detail')],
                          [qualityDetails(inspected.latency, 'ms')],
                        ),
                      ]
                    : []),
                ],
              ),
              h.div(
                [],
                [
                  h.dt([], ['Errors (%)']),
                  h.dd([], [inspected ? readingText(inspected.errors) : '—']),
                  ...(inspected
                    ? [
                        h.p(
                          [h.Class('signal-reading-detail')],
                          [qualityDetails(inspected.errors, '%')],
                        ),
                      ]
                    : []),
                ],
              ),
            ],
          ),
        ],
      ),
      signalChart(m, 'latency', h),
      signalChart(m, 'errors', h),
      h.details(
        [h.Class('signal-records')],
        [
          h.summary([], [`Raw observations (${m.records.length})`]),
          h.div(
            [h.Class('signal-table-scroll')],
            [
              h.table(
                [],
                [
                  h.caption(
                    [],
                    [
                      `Illustrative system telemetry. Source: ${sourceFreshness(m.snapshot)} · ${m.snapshot.revision}. All records, including those outside the current view.`,
                    ],
                  ),
                  h.thead(
                    [],
                    [
                      h.tr(
                        [],
                        [
                          'Observation',
                          'Time (UTC)',
                          'Latency (ms)',
                          'Errors (%)',
                          'Latency quality',
                          'Error quality',
                          'State',
                        ].map((label) => h.th([h.Scope('col')], [label])),
                      ),
                    ],
                  ),
                  h.tbody(
                    [],
                    m.records.map((d) => {
                      const active = d.id === m.inspection.key;
                      const selected = selectionContainsValue(m.selection, 'x', d.time);
                      return h.tr(
                        [
                          h.Key(d.id),
                          h.DataAttribute('record-id', d.id),
                          h.Class(
                            active ? 'signal-row-inspected' : selected ? 'signal-row-selected' : '',
                          ),
                        ],
                        [
                          h.th([h.Scope('row')], [d.id]),
                          h.td([], [utc(d.time)]),
                          h.td([], [readingText(d.latency)]),
                          h.td([], [readingText(d.errors)]),
                          h.td([], [qualityDetails(d.latency, 'ms')]),
                          h.td([], [qualityDetails(d.errors, '%')]),
                          h.td(
                            [],
                            [
                              `${active ? 'Inspected' : ''}${active && selected ? ' · ' : ''}${selected ? 'Selected' : ''}${!active && !selected ? '—' : ''}`,
                            ],
                          ),
                        ],
                      );
                    }),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
      h.details(
        [h.Class('signal-source')],
        [
          h.summary([], ['Controlled state / source']),
          h.pre([], [h.code([], [currentSignalSource(m)])]),
        ],
      ),
    ],
  );
}
export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Signal desk — Foldkit Viz',
  body: Model.match(model, {
    Empty: () =>
      h.section(
        [h.Class('signal-desk')],
        [h.h2([], ['No observations']), h.p([], ['Provide records to explore a signal.'])],
      ),
    Invalid: ({ error }) =>
      h.section(
        [h.Class('signal-desk')],
        [h.h2([], ['Cannot display observations']), h.p([], [error])],
      ),
    Ready: (m) => readyView(m, h),
  }),
});
