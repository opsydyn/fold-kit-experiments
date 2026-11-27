import type { Html } from '@effect/ui/html';
import { scatterGeometry } from '@opsydyn/foldkit-viz/chart/cartesian';
import { lightTheme, resolveSeriesStyle } from '@opsydyn/foldkit-viz/chart/theme';
import { axis, chartFrame, grid, pointSeries } from '@opsydyn/foldkit-viz/effect-ui/cartesian';

import { Filter, Scenario } from './contract';
import type { Service } from './contract';
import { Message } from './message';
import { activeRun, Session, visibleServices } from './model';
import type { Model } from './model';
import { ObserveAgentEnvironment } from './navigation';

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

function chart(model: Model, h: Html.H<Message>) {
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
      h
        .el('g')
        .key(`baseline-${point.key}`)
        .attr('aria-hidden', 'true')
        .children(
          h
            .el('line')
            .attr('x1', String(x))
            .attr('y1', String(y))
            .attr('x2', String(point.x))
            .attr('y2', String(point.y))
            .attr('stroke', colourFor(point.datum))
            .attr('stroke-width', '2')
            .attr('stroke-dasharray', '3 4')
            .children(),
          h
            .el('circle')
            .attr('data-baseline', 'true')
            .attr('cx', String(x))
            .attr('cy', String(y))
            .attr('r', '7')
            .attr('fill', 'var(--page-bg)')
            .attr('stroke', colourFor(point.datum))
            .attr('stroke-width', '2')
            .children(),
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
      h
        .el('line')
        .attr('data-budget', 'true')
        .attr('x1', String(layout.plot.left))
        .attr('x2', String(layout.plot.right))
        .attr('y1', String(layout.y(demoBudget)))
        .attr('y2', String(layout.y(demoBudget)))
        .attr('stroke', 'var(--incident-budget)')
        .attr('stroke-dasharray', '5 5')
        .attr('stroke-width', '2')
        .attr('aria-hidden', 'true')
        .children(),
      ...trails,
      ...geometry.points.map((point) =>
        h
          .el('g')
          .key(point.key)
          .attr('data-latency', String(point.datum.latency))
          .children(
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
          ),
      ),
      ...geometry.points
        .filter((point) => point.key === model.selectedId)
        .map((point) =>
          h
            .el('circle')
            .attr('data-selected', 'true')
            .attr('cx', String(point.x))
            .attr('cy', String(point.y))
            .attr('r', '15')
            .attr('fill', 'none')
            .attr('stroke', 'var(--page-text)')
            .attr('stroke-width', '2')
            .attr('stroke-dasharray', '3 2')
            .attr('aria-hidden', 'true')
            .children(),
        ),
      ...geometry.points.map((point) =>
        h
          .el('text')
          .key(`label-${point.key}`)
          .attr('x', String(point.x))
          .attr('y', String(point.y - 22))
          .attr('text-anchor', 'middle')
          .attr('font-size', '12')
          .attr('fill', 'var(--page-text)')
          .attr('aria-hidden', 'true')
          .children(point.datum.name),
      ),
    ],
  );
}

function inspector(model: Model, h: Html.H<Message>) {
  const selected = visibleServices(model).find(({ id }) => id === model.selectedId);
  if (selected === undefined)
    return h.aside
      .class(styles.inspector)
      .attr('aria-label', 'Selected service')
      .children(
        h.p.class(styles.eyebrow).children('Selected service'),
        h.p.class(styles.empty).children('No service selected'),
      );
  const baseline = baselineFor(model, selected);
  const above = selected.latency > demoBudget;
  const comparison = baseline === undefined ? 'New' : `${baseline.latency}ms`;
  return h.aside
    .class(styles.inspector)
    .attr('aria-label', 'Selected service')
    .children(
      h.p.class(styles.eyebrow).children('Selected service'),
      h.h3.class(styles.serviceName).children(selected.name),
      h.p.class(styles.muted).children(selected.series),
      h.p
        .class(styles.measurement)
        .children(
          h.span.attr('data-testid', 'current-latency').children(String(selected.latency)),
          h.span.class(styles.unit).attr('aria-label', 'p95 milliseconds').children(' ms p95'),
        ),
      h.p
        .class(above ? styles.alert : styles.good)
        .children(above ? 'Above demo budget' : 'Within demo budget'),
      h.p
        .class(styles.comparison)
        .children(
          'Baseline: ',
          h.span.attr('data-testid', 'baseline-latency').children(comparison),
          ...(baseline === undefined
            ? []
            : [` / ${difference(selected.latency, baseline.latency)}`]),
        ),
      h.dl
        .class(styles.facts)
        .children(
          h.dt.children('Traffic'),
          h.dd
            .attr('aria-label', `${selected.volume} requests/minute`)
            .children(`${selected.volume} req/min`),
          h.dt.children('Budget margin'),
          h.dd.children(
            `${Math.abs(selected.latency - demoBudget)}ms ${above ? 'above' : 'below'}`,
          ),
          h.dt.children('Service ID'),
          h.dd.children(selected.id),
        ),
      h.p
        .class(styles.evidenceNote)
        .children(
          model.rejection !== null
            ? 'Last valid measurements retained. No rejected operation was applied.'
            : 'Validated measurements, not a diagnosis. The cause of a change is not established.',
        ),
    );
}

function table(model: Model, h: Html.H<Message>) {
  return h.div
    .class(styles.scroll)
    .attr('data-testid', 'table-scroll')
    .attr('tabindex', '0')
    .attr('aria-label', 'Service table')
    .children(
      h.table.class(styles.table).children(
        h.caption.class(styles.srOnly).children('Synthetic service measurements'),
        h.thead.children(
          h.tr.children(
            h.th.attr('scope', 'col').children('Service'),
            h.th
              .attr('scope', 'col')
              .children(h.el('abbr').attr('title', 'requests/minute').children('Req/min')),
            h.th
              .attr('scope', 'col')
              .children(h.el('abbr').attr('title', 'p95 milliseconds').children('p95')),
            h.th.attr('scope', 'col').children('vs. baseline'),
          ),
        ),
        h.tbody.children(
          visibleServices(model).map((service) => {
            const baseline = baselineFor(model, service);
            return h.tr
              .key(service.id)
              .attr('data-service-id', service.id)
              .attr('data-selected', String(service.id === model.selectedId))
              .children(
                h.th.attr('scope', 'row').children(
                  h.button
                    .class(styles.serviceButton)
                    .attr('data-service-id', service.id)
                    .attr('aria-pressed', String(model.selectedId === service.id))
                    .on('click', Message.ClickedService({ id: service.id }))
                    .children(service.name),
                ),
                h.td
                  .attr('aria-label', `${service.volume} requests/minute`)
                  .children(String(service.volume)),
                h.td
                  .class(service.latency > demoBudget ? styles.alert : styles.good)
                  .attr('aria-label', `${service.latency} p95 milliseconds`)
                  .children(`${service.latency}ms`),
                h.td.children(
                  baseline === undefined ? 'New' : difference(service.latency, baseline.latency),
                ),
              );
          }),
        ),
      ),
    );
}

export function view(h: Html.H<Message>, model: Model) {
  const active = activeRun(model) !== null;
  const services = model.wire?.services ?? [];
  const above = services.filter(({ latency }) => latency > demoBudget).length;
  return h.section
    .onMount(ObserveAgentEnvironment())
    .class(styles.root)
    .attr('aria-label', 'Service analysis')
    .children(
      h.div.class(styles.controls).children(
        h.label.attr('for', 'agent-scenario').class(styles.eyebrow).children('Scenario'),
        h.select
          .id('agent-scenario')
          .class(styles.control)
          .on('change', ({ value }) =>
            Message.SelectedScenario({
              scenario: Scenario.literals.find((scenario) => scenario === value) ?? model.scenario,
            }),
          )
          .children(
            (
              [
                ['normal', 'Normal'],
                ['invalid', 'Invalid patch'],
                ['slow', 'Slow'],
              ] as const
            ).map(([value, label]) =>
              h.option
                .attr('value', value)
                .selected(model.scenario === value)
                .children(label),
            ),
          ),
        h.button
          .id('agent-run')
          .class(styles.primary)
          .disabled(active)
          .on('click', Message.ClickedRun())
          .children('Run analysis'),
        h.button
          .id('agent-cancel')
          .class(styles.control)
          .disabled(!active)
          .on('click', Message.ClickedCancel())
          .children('Cancel'),
        h.span.class(styles.labLabel).children('Synthetic fixture / no live agent'),
      ),
      h.div
        .class(styles.summary)
        .children(
          h.div.children(
            h.p
              .class(styles.eyebrow)
              .children(
                h.span
                  .attr('data-testid', 'status')
                  .attr('aria-live', 'polite')
                  .attr('role', 'status')
                  .children(model.session._tag),
              ),
            h.h2
              .class(styles.headline)
              .attr('data-testid', 'summary-headline')
              .children(headline(model, above)),
            h.p
              .class(styles.muted)
              .children(
                model.wire === null
                  ? 'No service measurements'
                  : `${services.length} synthetic services. Last valid data is visible.`,
              ),
          ),
          h.div.children(
            h.p.class(styles.eyebrow).children('Above budget'),
            h.p
              .class(styles.stat)
              .children(
                h.span.attr('data-testid', 'above-budget-count').children(String(above)),
                h.span.class(styles.unit).children(` / ${services.length} services`),
              ),
            h.p.class(styles.muted).children('Demo budget: p95 <= 100ms'),
          ),
          h.div.children(
            h.p.class(styles.eyebrow).children('Validated state updates'),
            h.p.class(styles.stat).attr('data-testid', 'accepted').children(String(model.accepted)),
            h.p.class(styles.muted).children('Accepted after full validation'),
          ),
        ),
      ...(model.session._tag === 'Failed'
        ? [
            h.div
              .class(styles.rejection)
              .attr('role', 'status')
              .children(
                h.div.children(
                  h.p.children(
                    model.rejection === null
                      ? 'Analysis stopped. Last valid data retained.'
                      : 'Unsafe update rejected. Measurements unchanged.',
                  ),
                  ...(model.rejection === null
                    ? [h.p.class(styles.muted).children(model.session.failure.reason.slice(0, 400))]
                    : [
                        h.pre
                          .attr('data-testid', 'rejected-update')
                          .children(model.rejection.detail),
                      ]),
                ),
                h.button
                  .id('agent-recover')
                  .class(styles.control)
                  .on('click', Message.ClickedRecover())
                  .children('Restart analysis'),
              ),
          ]
        : [
            h.button
              .id('agent-recover')
              .class(styles.srOnly)
              .disabled(true)
              .children('Restart analysis'),
          ]),
      h.div
        .class(styles.workspace)
        .children(
          h.div
            .class(styles.plotRegion)
            .children(
              h.div
                .class(styles.sectionHeader)
                .children(
                  h.h3.class(styles.heading).children('Traffic vs. latency'),
                  h.p.class(styles.legend).children('Core (circle) / Platform (diamond)'),
                ),
              h.div
                .class(styles.chart)
                .attr('data-testid', 'chart-scroll')
                .attr('tabindex', '0')
                .attr('aria-label', 'Service chart')
                .children(chart(model, h)),
              h.p
                .class(styles.muted)
                .children(
                  'Outline: baseline / dashed trail: validated change / dashed line: 100ms demo budget',
                ),
            ),
          inspector(model, h),
        ),
      h.div.class(styles.lower).children(
        h.div.class(styles.tableRegion).children(
          h.div.class(styles.sectionHeader).children(
            h.h3.class(styles.heading).children('Service measurements'),
            h.div
              .class(styles.filters)
              .attr('role', 'group')
              .attr('aria-label', 'Service series')
              .children(
                Filter.literals.map((filter) =>
                  h.button
                    .class(styles.filter)
                    .attr('data-filter', filter)
                    .attr('aria-pressed', String(model.filter === filter))
                    .on('click', Message.ClickedFilter({ filter }))
                    .children(filter),
                ),
              ),
          ),
          table(model, h),
        ),
        h.section
          .class(styles.activity)
          .attr('aria-label', 'Run evidence')
          .children(
            h.h3.class(styles.heading).children('Run evidence'),
            h.ol.children(model.activity.slice(-12).map((entry) => h.li.children(entry))),
            h.details.children(
              h.summary.children('Protocol details'),
              h.p.children(
                `Run generation: ${model.generation}. Validated state updates: ${model.accepted}. AG-UI state snapshots and atomic JSON Patch deltas.`,
              ),
            ),
          ),
      ),
      h.p
        .class(styles.footer)
        .children('AG-UI / Effect UI / Astro. Demo budget is illustrative, not a production SLO.'),
    );
}
