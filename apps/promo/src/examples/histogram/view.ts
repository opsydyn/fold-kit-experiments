import '@opsydyn/dataset-explorer/highlighting.css';
import { highlightedCode } from '@opsydyn/dataset-explorer/highlighting';
import {
  axis,
  barSeries,
  chartFrame,
  dataTable,
  grid,
} from '@opsydyn/foldkit-viz/foldkit/cartesian';
import { Schema } from 'effect';
import type { Document, HtmlBuilder } from 'foldkit/html';

import { frameForWidth } from '#example/frame';

import { histogramGeometry, chartTheme, seriesStyle } from './chart';
import { datasets } from './data';
import { MeasureHistogramChart } from './measurement';
import { Message } from './message';
import { ActionStatus, SourceName } from './model';
import type { Model } from './model';
import { currentSource } from './update';

const feedback = (model: Model): string =>
  ActionStatus.match(model.actionStatus, {
    Ready: () =>
      'The configuration follows your controls. Other files show the code running this example.',
    Pending: () => 'Preparing…',
    Succeeded: ({ action }) =>
      ({
        copy: 'File copied.',
        download: 'Project downloaded with your current settings.',
        playground: 'Opening StackBlitz…',
      })[action],
    Failed: ({ error }) => error,
  });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const values = datasets[model.settings.dataset];
  const geometry = histogramGeometry(values, model.settings.binCount, {
    frame: frameForWidth(model.chartWidth, 290),
  });
  const pending = model.actionStatus._tag === 'Pending';
  const range = (
    id: string,
    name: string,
    value: number,
    min: string,
    max: string,
    step: string,
    toMessage: (value: string) => Message,
  ) =>
    h.div(
      [h.Class('histogram-range')],
      [
        h.label([h.For(id)], [name, h.span([], [String(value)])]),
        h.input([
          h.Id(id),
          h.Type('range'),
          h.Min(min),
          h.Max(max),
          h.Step(step),
          h.Value(String(value)),
          h.OnInput(toMessage),
        ]),
      ],
    );
  return {
    title: 'Live histogram — Foldkit Viz',
    body: h.div(
      [h.Class('histogram-playground')],
      [
        h.div(
          [h.Class('histogram-workbench')],
          [
            h.div(
              [h.Class('histogram-preview')],
              [
                h.div(
                  [h.Class('histogram-preview-heading')],
                  [h.span([], ['LIVE PREVIEW']), h.span([], ['Illustrative data'])],
                ),
                h.div(
                  [h.Class('chart-viewport'), h.OnMount(MeasureHistogramChart())],
                  [
                    chartFrame(
                      h,
                      {
                        layout: geometry.cartesian.layout,
                        title: 'Illustrative histogram',
                        description:
                          geometry.total +
                          ' observations. Intervals include the lower edge and the final upper edge.',
                        theme: chartTheme,
                      },
                      [
                        grid(h, {
                          ...geometry.cartesian,
                          yTicks: geometry.cartesian.yTicks.filter((t) =>
                            Number.isInteger(t.value),
                          ),
                          theme: chartTheme,
                        }),
                        axis(h, {
                          layout: geometry.cartesian.layout,
                          orientation: 'left',
                          ticks: geometry.cartesian.yTicks.filter((t) => Number.isInteger(t.value)),
                          label: 'Count',
                          format: (value) => String(value),
                          theme: chartTheme,
                        }),
                        axis(h, {
                          layout: geometry.cartesian.layout,
                          orientation: 'bottom',
                          ticks: geometry.cartesian.xTicks,
                          label: 'Value (units)',
                          format: (value) => String(value),
                          theme: chartTheme,
                        }),
                        barSeries(h, {
                          bins: geometry.cartesian.bins,
                          styleFor: () => seriesStyle,
                          labelFor: (bin) => `${bin.x0} to ${bin.x1}: ${bin.count} observations`,
                        }),
                      ],
                    ),
                  ],
                ),
                ...(geometry.total === 0
                  ? [h.p([h.Role('status')], ['No values to display'])]
                  : []),
                h.details(
                  [h.Class('chart-data')],
                  [
                    h.summary([], ['View source data']),
                    dataTable(h, {
                      caption: 'Illustrative histogram values',
                      headers: ['Observation', 'Value'],
                      rows: values.map((value, index) => [String(index + 1), String(value)]),
                    }),
                  ],
                ),
                h.div(
                  [h.Class('histogram-intervals')],
                  [
                    h.p([h.Class('histogram-intervals-heading')], ['INTERVAL / OBSERVATIONS']),
                    h.ul(
                      [h.Tabindex(0), h.AriaLabel('Bin intervals and counts')],
                      geometry.bars.map(({ interval, count }) =>
                        h.li([], [h.span([], [interval]), h.strong([], [String(count)])]),
                      ),
                    ),
                  ],
                ),
                h.p(
                  [h.Class('histogram-preview-caption')],
                  [
                    'The same 40 observations, grouped differently. The interval list shows counts; the Y-axis rescales to the largest bin.',
                  ],
                ),
              ],
            ),
            h.div(
              [h.Class('histogram-controls')],
              [
                h.fieldset(
                  [],
                  [
                    h.legend([], ['Dataset']),
                    h.div(
                      [h.Class('histogram-segmented')],
                      (
                        [
                          ['spread', 'Spread'],
                          ['clustered', 'Clustered'],
                        ] as const
                      ).map(([dataset, label]) =>
                        h.button(
                          [
                            h.Type('button'),
                            h.AriaPressed(String(model.settings.dataset === dataset)),
                            h.OnClick(Message.SelectedDataset({ dataset })),
                          ],
                          [label],
                        ),
                      ),
                    ),
                  ],
                ),
                range(
                  'histogram-bins',
                  'Number of bins',
                  model.settings.binCount,
                  '2',
                  '20',
                  '1',
                  (value) => Message.ChangedBinCount({ value }),
                ),
                h.p(
                  [h.Class('histogram-preview-caption')],
                  [
                    'Intervals include their lower edge. Only the final bin includes its upper edge (100).',
                  ],
                ),
                h.button(
                  [h.Class('histogram-reset'), h.Type('button'), h.OnClick(Message.ClickedReset())],
                  ['Reset example'],
                ),
              ],
            ),
          ],
        ),
        h.div(
          [h.Class('histogram-source')],
          [
            h.div(
              [h.Class('histogram-source-toolbar')],
              [
                h.label([h.For('histogram-source-file')], ['Source file']),
                h.select(
                  [
                    h.Id('histogram-source-file'),
                    h.Value(model.activeFile),
                    h.OnChange((value) =>
                      Message.SelectedFile({ name: Schema.decodeUnknownSync(SourceName)(value) }),
                    ),
                  ],
                  model.sources.map(({ name }) => h.option([h.Value(name)], [name])),
                ),
                h.button(
                  [h.Type('button'), h.Disabled(pending), h.OnClick(Message.ClickedCopy())],
                  ['Copy file'],
                ),
              ],
            ),
            h.pre(
              [
                h.Class('syntax-highlight'),
                h.Tabindex(0),
                h.AriaLabel(model.activeFile + ' source code'),
              ],
              [
                h.code(
                  [],
                  highlightedCode(
                    h,
                    currentSource(model),
                    model.activeFile,
                    model.highlightedSource,
                  ),
                ),
              ],
            ),
          ],
        ),
        h.div(
          [h.Class('histogram-export')],
          [
            h.p([h.Role('status'), h.AriaLive('polite')], [feedback(model)]),
            ...(model.templateUrl === null
              ? []
              : [
                  h.div(
                    [h.Class('histogram-export-buttons')],
                    [
                      h.button(
                        [
                          h.Type('button'),
                          h.Disabled(pending),
                          h.OnClick(Message.ClickedDownload()),
                        ],
                        ['Download project'],
                      ),
                      h.button(
                        [
                          h.Type('button'),
                          h.Disabled(pending),
                          h.OnClick(Message.ClickedPlayground()),
                        ],
                        ['Open in StackBlitz ↗'],
                      ),
                    ],
                  ),
                ]),
          ],
        ),
      ],
    ),
  };
};
