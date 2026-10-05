import { dataTable } from '@opsydyn/foldkit-viz/foldkit/cartesian';
import { Option } from 'effect';
import { getData, getError, hasData, isPending, matchData } from 'foldkit/asyncData';
import type { Document, HtmlBuilder } from 'foldkit/html';

import { hourLabel, snapshotChart } from './chart';
import { datasetIds, datasets } from './data';
import { Message } from './message';
import type { Model } from './model';
import { DatasetQuery } from './query';
import { sourcePanel } from './source-view';

export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const args = {
    source: model.transport,
    dataset: model.selected,
    revision: model.nextRevision,
    profile: 'normal' as const,
    fail: false,
  };
  const data = DatasetQuery.read(model.datasets, args);
  const busy = isPending(data);
  const snapshot = getData(data);
  const cached = datasetIds.filter((dataset) =>
    hasData(DatasetQuery.read(model.datasets, { ...args, dataset })),
  ).length;
  const button = (label: string, message: Message) =>
    h.button(
      [h.Type('button'), h.Class('query-action'), h.Disabled(busy), h.OnClick(message)],
      [label],
    );
  const body = h.div(
    [h.Class('query-explorer')],
    [
      h.div(
        [h.Class('query-toolbar')],
        [
          h.div(
            [h.Role('group'), h.AriaLabel('Dataset selection'), h.Class('query-stations')],
            datasetIds.map((dataset) =>
              h.button(
                [
                  h.Type('button'),
                  h.Class('query-station'),
                  h.Style({ '--station-colour': datasets[dataset].colour }),
                  h.AriaPressed(dataset === model.selected ? 'true' : 'false'),
                  h.OnClick(Message.ClickedDataset({ dataset })),
                ],
                [datasets[dataset].label],
              ),
            ),
          ),
          h.span(
            [h.Class('query-cache-count')],
            [`${cached} / ${datasetIds.length} datasets retained`],
          ),
        ],
      ),
      h.section(
        [h.Class('query-panel'), h.AriaLabel('Dataset preview')],
        [
          h.div(
            [h.Class('query-readout')],
            [
              h.div(
                [],
                [
                  h.span([h.Class('query-eyebrow')], ['REMOTE OBSERVATIONS']),
                  h.h2([], [datasets[model.selected].label]),
                ],
              ),
              h.div(
                [h.Class('query-state'), h.Role('status'), h.AriaLive('polite')],
                [
                  h.strong([], [data._tag]),
                  h.span(
                    [],
                    [
                      Option.match(snapshot, {
                        onNone: () => 'Awaiting a snapshot',
                        onSome: (snapshot) =>
                          `Snapshot ${snapshot.revision} · ${snapshot.points.length} observations`,
                      }),
                    ],
                  ),
                ],
              ),
            ],
          ),
          matchData(data, {
            onEmpty: () => h.div([h.Class('query-empty')], ['Loading observations…']),
            onFailure: (error) => h.div([h.Class('query-empty')], [error]),
            onData: (snapshot) => snapshotChart(snapshot, h),
          }),
          ...Option.match(getError(data), {
            onNone: () => [],
            onSome: (error) => [
              h.p(
                [h.Class('query-error'), h.Role('alert')],
                [
                  error,
                  hasData(data) ? ' Your last snapshot stays visible.' : ' Try refresh dataset.',
                ],
              ),
            ],
          }),
          h.div(
            [h.Class('query-actions')],
            [
              button('Refresh dataset', Message.ClickedRefresh()),
              button('Simulate failed refresh', Message.ClickedFailedRefresh()),
              button('Run response race', Message.ClickedResponseRace()),
            ],
          ),
          h.p(
            [h.Class('query-hint')],
            [
              'Switch stations to reuse retained data. Refresh keeps the current chart visible while its replacement loads.',
            ],
          ),
        ],
      ),
      h.div(
        [h.Class('query-lower')],
        [
          h.section(
            [h.Class('query-panel'), h.AriaLabel('Response log')],
            [
              h.h2([h.Class('query-section-title')], ['Response log']),
              h.p(
                [h.Class('query-hint')],
                [
                  'Race: launch a slow request, reset, then launch a fast replacement. Reset invalidates old responses; it does not cancel the request.',
                ],
              ),
              h.ol(
                [h.Class('query-log'), h.AriaLive('polite')],
                model.trace
                  .toReversed()
                  .map((fact) =>
                    h.li(
                      [
                        h.Key(`${fact.dataset}-${fact.revision}`),
                        h.Class('query-log-row'),
                        h.DataAttribute('outcome', fact.outcome),
                      ],
                      [
                        h.span([], [`${datasets[fact.dataset].label} · snapshot ${fact.revision}`]),
                        h.strong([], [fact.outcome]),
                      ],
                    ),
                  ),
              ),
              ...(model.trace.length === 0
                ? [h.p([h.Class('query-hint')], ['Responses appear here as requests finish.'])]
                : []),
            ],
          ),
          h.section(
            [h.Class('query-panel'), h.AriaLabel('Source observations')],
            [
              h.h2([h.Class('query-section-title')], ['Source observations']),
              ...Option.match(snapshot, {
                onNone: () => [h.p([h.Class('query-hint')], ['No snapshot loaded yet.'])],
                onSome: (snapshot) => [
                  dataTable(h, {
                    caption: `Illustrative data · snapshot ${snapshot.revision}`,
                    headers: ['Hour', 'Wind speed (m/s)'],
                    rows: snapshot.points.map((point) => [
                      hourLabel(point.hour),
                      String(point.value),
                    ]),
                  }),
                ],
              }),
            ],
          ),
        ],
      ),
      ...sourcePanel(model, h),
    ],
  );
  return { title: 'Dataset explorer — FoldKit Query', body };
};
