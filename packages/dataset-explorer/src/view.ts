import { Mount } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { Stream } from 'effect';

import { hourLabel, snapshotChart } from './chart';
import { datasetIds, datasets } from './data';
import { frameForWidth } from './frame';
import { MeasureDatasetChart } from './measurement';
import { Message } from './message';
import type { Model } from './model';
import { DatasetQuery, status } from './query';
import { sourceLineChanges } from './source-ui';
import { sourcePanel } from './source-view';

const ObserveExplorer = Mount.makeStream('ObserveExplorer', { args: {} }, (element: HTMLElement) =>
  Stream.concat(
    Stream.make(Message.MountedExplorer()),
    Stream.map(sourceLineChanges(element), Message.NavigatedSourceLine),
  ),
);

export const view = (h: Html.H<Message>, model: Model) => {
  const entry = DatasetQuery.read(model.datasets, {
    source: model.transport,
    dataset: model.selected,
  });
  const { snapshot, pending, error } = entry;
  const cached = datasetIds.filter(
    (dataset) =>
      DatasetQuery.read(model.datasets, { source: model.transport, dataset }).snapshot !==
      undefined,
  ).length;
  const button = (label: string, message: Message) =>
    h.button
      .class('query-action')
      .attr('type', 'button')
      .disabled(pending !== undefined)
      .on('click', message)
      .children(label);
  const hint = (text: string) => h.p.class('query-hint').children(text);
  const chart = snapshot
    ? snapshotChart(snapshot, h, { frame: frameForWidth(model.chartWidth) })
    : h.div.class('query-empty').children(error ?? 'Loading observations…');
  return h.div
    .class('query-explorer')
    .onMount(Mount.map(ObserveExplorer(), (message) => message))
    .children(
      h.div.class('query-toolbar').children(
        h.div
          .class('query-stations')
          .attrs({ role: 'group', 'aria-label': 'Dataset selection' })
          .children(
            ...datasetIds.map((dataset) =>
              h.button
                .class('query-station')
                .attrs({ type: 'button', 'aria-pressed': String(dataset === model.selected) })
                .style({ '--station-colour': datasets[dataset].colour })
                .on('click', Message.ClickedDataset({ dataset }))
                .children(datasets[dataset].label),
            ),
          ),
        h.span
          .class('query-cache-count')
          .children(`${cached} / ${datasetIds.length} datasets retained`),
      ),
      h.section
        .class('query-panel')
        .attr('aria-label', 'Dataset preview')
        .children(
          h.div.class('query-readout').children(
            h.div(
              h.span.class('query-eyebrow').children('REMOTE OBSERVATIONS'),
              h.h2(datasets[model.selected].label),
            ),
            h.div
              .class('query-state')
              .attrs({ role: 'status', 'aria-live': 'polite' })
              .children(
                h.strong(status(entry)),
                h.span(
                  snapshot
                    ? `Snapshot ${snapshot.revision} · ${snapshot.points.length} observations`
                    : 'Awaiting a snapshot',
                ),
              ),
          ),
          h.div
            .class('query-chart-viewport')
            .onMount(Mount.map(MeasureDatasetChart(), (message) => message))
            .children(chart),
          error !== undefined &&
            h.p
              .class('query-error')
              .attr('role', 'alert')
              .children(
                error,
                snapshot ? ' Your last snapshot stays visible.' : ' Try refresh dataset.',
              ),
          h.div
            .class('query-actions')
            .children(
              button('Refresh dataset', Message.ClickedRefresh()),
              button('Simulate failed refresh', Message.ClickedFailedRefresh()),
              button('Run response race', Message.ClickedResponseRace()),
            ),
          hint(
            'Switch stations to reuse retained data. Refresh keeps the current chart visible while its replacement loads.',
          ),
        ),
      h.div.class('query-lower').children(
        h.section
          .class('query-panel')
          .attr('aria-label', 'Response log')
          .children(
            h.h2.class('query-section-title').children('Response log'),
            hint(
              'Race: launch a slow request, reset, then launch a fast replacement. Reset invalidates old responses; it does not cancel the request.',
            ),
            h.ol
              .class('query-log')
              .attr('aria-live', 'polite')
              .children(
                ...model.trace.toReversed().map(({ dataset, revision, outcome }) =>
                  h.li
                    .key(`${dataset}-${revision}`)
                    .class('query-log-row')
                    .attr('data-outcome', outcome)
                    .children(
                      h.span(`${datasets[dataset].label} · snapshot ${revision}`),
                      h.strong(outcome),
                    ),
                ),
              ),
            model.trace.length === 0 && hint('Responses appear here as requests finish.'),
          ),
        h.section
          .class('query-panel')
          .attr('aria-label', 'Source observations')
          .children(
            h.h2.class('query-section-title').children('Source observations'),
            snapshot
              ? h.table
                  .class('chart-data-table')
                  .children(
                    h.caption(`Illustrative data · snapshot ${snapshot.revision}`),
                    h.thead(
                      h.tr(
                        h.th.attr('scope', 'col').children('Hour'),
                        h.th.attr('scope', 'col').children('Wind speed (m/s)'),
                      ),
                    ),
                    h.tbody(
                      ...snapshot.points.map(({ hour, value }) =>
                        h.tr(h.td(hourLabel(hour)), h.td(String(value))),
                      ),
                    ),
                  )
              : hint('No snapshot loaded yet.'),
          ),
      ),
      sourcePanel(h, model),
    );
};
