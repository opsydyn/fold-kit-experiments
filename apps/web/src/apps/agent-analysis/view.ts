import { scatterGeometry } from '@opsydyn/foldkit-viz/chart/cartesian';
import { lightTheme, resolveSeriesStyle } from '@opsydyn/foldkit-viz/chart/theme';
import { axis, chartFrame, grid, pointSeries } from '@opsydyn/foldkit-viz/foldkit/cartesian';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import { Filter, Scenario } from './contract';
import type { Service } from './contract';
import { Message } from './message';
import { activeRun, Session, visibleServices } from './model';
import type { Model } from './model';

import * as styles from './agent-analysis.css';

const demoBudget = 100;
const theme = {
  ...lightTheme,
  background: 'var(--chart-bg)',
  text: 'var(--page-text)',
  mutedText: 'var(--chart-label)',
  grid: 'var(--chart-grid)',
  axis: 'var(--chart-axis)',
  labelSize: 12,
};
const baselineFor = (model: Model, service: Service) =>
  model.baseline?.services.find(({ id }) => id === service.id);
const difference = (current: number, baseline: number): string => {
  const change = current - baseline;
  return change === 0 ? 'Unchanged' : `${change > 0 ? '+' : ''}${change}ms`;
};

function headline(model: Model, above: number): string {
  const measurements =
    above === 0 ? 'Services within demo budget' : `${above} services above demo budget`;
  return Session.match(model.session, {
    Idle: () => 'Ready for analysis',
    Connecting: () => 'Connecting to synthetic fixture',
    AwaitingSnapshot: () => 'Awaiting validated measurements',
    Streaming: () => measurements,
    Completed: () => `Analysis complete. ${measurements}`,
    Cancelled: () => 'Analysis cancelled. Data preserved.',
    Failed: () =>
      model.rejection === null
        ? 'Analysis stopped. Data preserved.'
        : 'Invalid update blocked. No partial change.',
  });
}

function chart(model: Model, h: HtmlBuilder<Message>): Html {
  const geometry = scatterGeometry(
    visibleServices(model),
    {
      x: (service) => service.volume,
      y: (service) => service.latency,
      datumKey: (service) => service.id,
      seriesKey: (service) => service.series,
    },
    {
      frame: {
        width: model.isCompact ? 390 : 760,
        height: model.isCompact ? 330 : 370,
        margins: { top: 40, right: 24, bottom: 52, left: 48 },
      },
      xDomain: [0, 2400],
      yDomain: [0, 200],
      xTickCount: model.isCompact ? 3 : 5,
      yTickCount: 5,
    },
  );
  const { layout } = geometry;
  const xTicks = (model.isCompact ? [0, 1200, 2400] : [0, 600, 1200, 1800, 2400]).map((value) => ({
    value,
    position: layout.x(value),
  }));
  const colourFor = (service: Service) =>
    service.series === 'Core' ? 'var(--incident-core)' : 'var(--incident-platform)';
  const trails = geometry.points.flatMap((point) => {
    const baseline = baselineFor(model, point.datum);
    if (
      baseline === undefined ||
      (baseline.latency === point.datum.latency && baseline.volume === point.datum.volume)
    )
      return [];
    const x = layout.x(baseline.volume);
    const y = layout.y(baseline.latency);
    return [
      h.g(
        [h.Key(`baseline-${point.key}`), h.AriaHidden(true)],
        [
          h.line(
            [
              h.X1(String(x)),
              h.Y1(String(y)),
              h.X2(String(point.x)),
              h.Y2(String(point.y)),
              h.Stroke(colourFor(point.datum)),
              h.StrokeWidth('2'),
              h.StrokeDasharray('3 4'),
            ],
            [],
          ),
          h.circle(
            [
              h.DataAttribute('baseline', 'true'),
              h.Cx(String(x)),
              h.Cy(String(y)),
              h.R('7'),
              h.Fill('var(--page-bg)'),
              h.Stroke(colourFor(point.datum)),
              h.StrokeWidth('2'),
            ],
            [],
          ),
        ],
      ),
    ];
  });
  return chartFrame(
    h,
    {
      layout,
      title: 'Traffic vs. latency',
      description:
        'Synthetic service measurements. Traffic in requests/minute; p95 latency in milliseconds. Outlines and trails show the first snapshot baseline. Illustrative 100ms budget, not a production SLO. Select a service in the table.',
      theme,
    },
    [
      grid(h, { ...geometry, xTicks, theme }),
      axis(h, {
        layout,
        orientation: 'bottom',
        ticks: xTicks,
        label: 'Traffic (requests/minute)',
        format: String,
        theme,
      }),
      axis(h, {
        layout,
        orientation: 'left',
        ticks: geometry.yTicks,
        label: 'p95 latency (ms)',
        format: String,
        theme,
      }),
      h.line(
        [
          h.DataAttribute('budget', 'true'),
          h.X1(String(layout.plot.left)),
          h.X2(String(layout.plot.right)),
          h.Y1(String(layout.y(demoBudget))),
          h.Y2(String(layout.y(demoBudget))),
          h.Stroke('var(--incident-budget)'),
          h.StrokeDasharray('5 5'),
          h.StrokeWidth('2'),
          h.AriaHidden(true),
        ],
        [],
      ),
      ...trails,
      ...geometry.points.map((point) =>
        h.g(
          [h.Key(point.key), h.DataAttribute('latency', String(point.datum.latency))],
          [
            pointSeries(h, {
              points: [point],
              activeKey: model.selectedId,
              styleFor: () =>
                resolveSeriesStyle(
                  theme,
                  { pointRadius: 7 },
                  {
                    fill: colourFor(point.datum),
                    stroke: 'var(--page-bg)',
                    symbol: point.seriesKey === 'Core' ? 'circle' : 'diamond',
                  },
                  {},
                ),
              labelFor: (service) =>
                `${service.name}: ${service.volume} requests/minute, ${service.latency} p95 milliseconds`,
            }),
          ],
        ),
      ),
      ...geometry.points
        .filter((point) => point.key === model.selectedId)
        .map((point) =>
          h.circle(
            [
              h.DataAttribute('selected', 'true'),
              h.Cx(String(point.x)),
              h.Cy(String(point.y)),
              h.R('15'),
              h.Fill('none'),
              h.Stroke('var(--page-text)'),
              h.StrokeWidth('2'),
              h.StrokeDasharray('3 2'),
              h.AriaHidden(true),
            ],
            [],
          ),
        ),
      ...geometry.points.map((point) =>
        h.text(
          [
            h.Key(`label-${point.key}`),
            h.X(String(point.x)),
            h.Y(String(point.y - 22)),
            h.TextAnchor('middle'),
            h.FontSize('12'),
            h.Fill('var(--page-text)'),
            h.AriaHidden(true),
          ],
          [point.datum.name],
        ),
      ),
    ],
  );
}

function inspector(model: Model, h: HtmlBuilder<Message>): Html {
  const selected = visibleServices(model).find(({ id }) => id === model.selectedId);
  if (selected === undefined)
    return h.aside(
      [h.Class(styles.inspector), h.AriaLabel('Selected service')],
      [
        h.p([h.Class(styles.eyebrow)], ['Selected service']),
        h.p([h.Class(styles.empty)], ['No service selected']),
      ],
    );
  const baseline = baselineFor(model, selected);
  const above = selected.latency > demoBudget;
  const comparison = baseline === undefined ? 'New' : `${baseline.latency}ms`;
  return h.aside(
    [h.Class(styles.inspector), h.AriaLabel('Selected service')],
    [
      h.p([h.Class(styles.eyebrow)], ['Selected service']),
      h.h3([h.Class(styles.serviceName)], [selected.name]),
      h.p([h.Class(styles.muted)], [selected.series]),
      h.p(
        [h.Class(styles.measurement)],
        [
          h.span([h.DataAttribute('testid', 'current-latency')], [String(selected.latency)]),
          h.span([h.Class(styles.unit), h.AriaLabel('p95 milliseconds')], [' ms p95']),
        ],
      ),
      h.p(
        [h.Class(above ? styles.alert : styles.good)],
        [above ? 'Above demo budget' : 'Within demo budget'],
      ),
      h.p(
        [h.Class(styles.comparison)],
        [
          'Baseline: ',
          h.span([h.DataAttribute('testid', 'baseline-latency')], [comparison]),
          ...(baseline === undefined
            ? []
            : [` / ${difference(selected.latency, baseline.latency)}`]),
        ],
      ),
      h.dl(
        [h.Class(styles.facts)],
        [
          h.dt([], ['Traffic']),
          h.dd([h.AriaLabel(`${selected.volume} requests/minute`)], [`${selected.volume} req/min`]),
          h.dt([], ['Budget margin']),
          h.dd([], [`${Math.abs(selected.latency - demoBudget)}ms ${above ? 'above' : 'below'}`]),
          h.dt([], ['Service ID']),
          h.dd([], [selected.id]),
        ],
      ),
      h.p(
        [h.Class(styles.evidenceNote)],
        [
          model.rejection !== null
            ? 'Last valid measurements retained. No rejected operation was applied.'
            : 'Validated measurements, not a diagnosis. The cause of a change is not established.',
        ],
      ),
    ],
  );
}

function table(model: Model, h: HtmlBuilder<Message>): Html {
  return h.div(
    [
      h.Class(styles.scroll),
      h.DataAttribute('testid', 'table-scroll'),
      h.Tabindex(0),
      h.AriaLabel('Service table'),
    ],
    [
      h.table(
        [h.Class(styles.table)],
        [
          h.caption([h.Class(styles.srOnly)], ['Synthetic service measurements']),
          h.thead(
            [],
            [
              h.tr(
                [],
                [
                  h.th([h.Attribute('scope', 'col')], ['Service']),
                  h.th(
                    [h.Attribute('scope', 'col')],
                    [h.abbr([h.Title('requests/minute')], ['Req/min'])],
                  ),
                  h.th(
                    [h.Attribute('scope', 'col')],
                    [h.abbr([h.Title('p95 milliseconds')], ['p95'])],
                  ),
                  h.th([h.Attribute('scope', 'col')], ['vs. baseline']),
                ],
              ),
            ],
          ),
          h.tbody(
            [],
            visibleServices(model).map((service) => {
              const baseline = baselineFor(model, service);
              return h.tr(
                [
                  h.Key(service.id),
                  h.DataAttribute('service-id', service.id),
                  h.DataAttribute('selected', String(service.id === model.selectedId)),
                ],
                [
                  h.th(
                    [h.Attribute('scope', 'row')],
                    [
                      h.button(
                        [
                          h.Class(styles.serviceButton),
                          h.DataAttribute('service-id', service.id),
                          h.AriaPressed(String(model.selectedId === service.id)),
                          h.OnClick(Message.ClickedService({ id: service.id })),
                        ],
                        [service.name],
                      ),
                    ],
                  ),
                  h.td(
                    [h.AriaLabel(`${service.volume} requests/minute`)],
                    [String(service.volume)],
                  ),
                  h.td(
                    [
                      h.Class(service.latency > demoBudget ? styles.alert : styles.good),
                      h.AriaLabel(`${service.latency} p95 milliseconds`),
                    ],
                    [`${service.latency}ms`],
                  ),
                  h.td(
                    [],
                    [
                      baseline === undefined
                        ? 'New'
                        : difference(service.latency, baseline.latency),
                    ],
                  ),
                ],
              );
            }),
          ),
        ],
      ),
    ],
  );
}

export function body(model: Model, h: HtmlBuilder<Message>): Html {
  const active = activeRun(model) !== null;
  const services = model.wire?.services ?? [];
  const above = services.filter(({ latency }) => latency > demoBudget).length;
  return h.section(
    [h.Class(styles.root), h.AriaLabel('Service analysis')],
    [
      h.div(
        [h.Class(styles.controls)],
        [
          h.label([h.For('agent-scenario'), h.Class(styles.eyebrow)], ['Scenario']),
          h.select(
            [
              h.Id('agent-scenario'),
              h.Class(styles.control),
              h.OnChange((value) =>
                Message.SelectedScenario({
                  scenario:
                    Scenario.literals.find((scenario) => scenario === value) ?? model.scenario,
                }),
              ),
            ],
            (
              [
                ['normal', 'Normal'],
                ['invalid', 'Invalid patch'],
                ['slow', 'Slow'],
              ] as const
            ).map(([value, label]) =>
              h.option([h.Value(value), h.Selected(model.scenario === value)], [label]),
            ),
          ),
          h.button(
            [
              h.Id('agent-run'),
              h.Class(styles.primary),
              h.Disabled(active),
              h.OnClick(Message.ClickedRun()),
            ],
            ['Run analysis'],
          ),
          h.button(
            [
              h.Id('agent-cancel'),
              h.Class(styles.control),
              h.Disabled(!active),
              h.OnClick(Message.ClickedCancel()),
            ],
            ['Cancel'],
          ),
          h.span([h.Class(styles.labLabel)], ['Synthetic fixture / no live agent']),
        ],
      ),
      h.div(
        [h.Class(styles.summary)],
        [
          h.div(
            [],
            [
              h.p(
                [h.Class(styles.eyebrow)],
                [
                  h.span(
                    [h.DataAttribute('testid', 'status'), h.AriaLive('polite'), h.Role('status')],
                    [model.session._tag],
                  ),
                ],
              ),
              h.h2(
                [h.Class(styles.headline), h.DataAttribute('testid', 'summary-headline')],
                [headline(model, above)],
              ),
              h.p(
                [h.Class(styles.muted)],
                [
                  model.wire === null
                    ? 'No service measurements'
                    : `${services.length} synthetic services. Last valid data is visible.`,
                ],
              ),
            ],
          ),
          h.div(
            [],
            [
              h.p([h.Class(styles.eyebrow)], ['Above budget']),
              h.p(
                [h.Class(styles.stat)],
                [
                  h.span([h.DataAttribute('testid', 'above-budget-count')], [String(above)]),
                  h.span([h.Class(styles.unit)], [` / ${services.length} services`]),
                ],
              ),
              h.p([h.Class(styles.muted)], ['Demo budget: p95 <= 100ms']),
            ],
          ),
          h.div(
            [],
            [
              h.p([h.Class(styles.eyebrow)], ['Validated state updates']),
              h.p(
                [h.Class(styles.stat), h.DataAttribute('testid', 'accepted')],
                [String(model.accepted)],
              ),
              h.p([h.Class(styles.muted)], ['Accepted after full validation']),
            ],
          ),
        ],
      ),
      ...(model.session._tag === 'Failed'
        ? [
            h.div(
              [h.Class(styles.rejection), h.Role('status')],
              [
                h.div(
                  [],
                  [
                    h.p(
                      [],
                      [
                        model.rejection === null
                          ? 'Analysis stopped. Last valid data retained.'
                          : 'Unsafe update rejected. Measurements unchanged.',
                      ],
                    ),
                    ...(model.rejection === null
                      ? [h.p([h.Class(styles.muted)], [model.session.failure.reason.slice(0, 400)])]
                      : [
                          h.pre(
                            [h.DataAttribute('testid', 'rejected-update')],
                            [model.rejection.detail],
                          ),
                        ]),
                  ],
                ),
                h.button(
                  [
                    h.Id('agent-recover'),
                    h.Class(styles.control),
                    h.OnClick(Message.ClickedRecover()),
                  ],
                  ['Restart analysis'],
                ),
              ],
            ),
          ]
        : [
            h.button(
              [h.Id('agent-recover'), h.Class(styles.srOnly), h.Disabled(true)],
              ['Restart analysis'],
            ),
          ]),
      h.div(
        [h.Class(styles.workspace)],
        [
          h.div(
            [h.Class(styles.plotRegion)],
            [
              h.div(
                [h.Class(styles.sectionHeader)],
                [
                  h.h3([h.Class(styles.heading)], ['Traffic vs. latency']),
                  h.p([h.Class(styles.legend)], ['Core (circle) / Platform (diamond)']),
                ],
              ),
              h.div(
                [
                  h.Class(styles.chart),
                  h.DataAttribute('testid', 'chart-scroll'),
                  h.Tabindex(0),
                  h.AriaLabel('Service chart'),
                ],
                [chart(model, h)],
              ),
              h.p(
                [h.Class(styles.muted)],
                [
                  'Outline: baseline / dashed trail: validated change / dashed line: 100ms demo budget',
                ],
              ),
            ],
          ),
          inspector(model, h),
        ],
      ),
      h.div(
        [h.Class(styles.lower)],
        [
          h.div(
            [h.Class(styles.tableRegion)],
            [
              h.div(
                [h.Class(styles.sectionHeader)],
                [
                  h.h3([h.Class(styles.heading)], ['Service measurements']),
                  h.div(
                    [h.Class(styles.filters), h.Role('group'), h.AriaLabel('Service series')],
                    Filter.literals.map((filter) =>
                      h.button(
                        [
                          h.Class(styles.filter),
                          h.DataAttribute('filter', filter),
                          h.AriaPressed(String(model.filter === filter)),
                          h.OnClick(Message.ClickedFilter({ filter })),
                        ],
                        [filter],
                      ),
                    ),
                  ),
                ],
              ),
              table(model, h),
            ],
          ),
          h.section(
            [h.Class(styles.activity), h.AriaLabel('Run evidence')],
            [
              h.h3([h.Class(styles.heading)], ['Run evidence']),
              h.ol(
                [],
                model.activity.slice(-12).map((entry) => h.li([], [entry])),
              ),
              h.details(
                [],
                [
                  h.summary([], ['Protocol details']),
                  h.p(
                    [],
                    [
                      `Run generation: ${model.generation}. Validated state updates: ${model.accepted}. AG-UI state snapshots and atomic JSON Patch deltas.`,
                    ],
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
      h.p(
        [h.Class(styles.footer)],
        ['AG-UI / FoldKit / Astro. Demo budget is illustrative, not a production SLO.'],
      ),
    ],
  );
}

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Service Incident Lab',
  body: body(model, h),
});
