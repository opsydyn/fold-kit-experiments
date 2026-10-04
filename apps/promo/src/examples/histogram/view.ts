import { Schema } from 'effect';
import type { Document, HtmlBuilder } from 'foldkit/html';

import { histogramGeometry } from './chart';
import { datasets } from './data';
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
  const geometry = histogramGeometry(datasets[model.settings.dataset], model.settings.binCount);
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
                h.svg(
                  [
                    h.ViewBox('0 0 560 290'),
                    h.Role('img'),
                    h.AriaLabel('Histogram of illustrative values'),
                  ],
                  [
                    h.title([], ['Histogram']),
                    h.desc(
                      [],
                      [
                        model.settings.dataset +
                          ' dataset. ' +
                          geometry.total +
                          ' observations in ' +
                          model.settings.binCount +
                          ' bins on a 0 to 100 domain. ' +
                          geometry.bars
                            .map(({ interval, count }) => interval + ': ' + count)
                            .join('; '),
                      ],
                    ),
                    ...geometry.yTicks.map(({ value, y }) =>
                      h.g(
                        [],
                        [
                          h.line(
                            [
                              h.X1('48'),
                              h.X2('528'),
                              h.Y1(String(y)),
                              h.Y2(String(y)),
                              h.Class('histogram-grid'),
                            ],
                            [],
                          ),
                          h.text(
                            [
                              h.X('36'),
                              h.Y(String(y + 4)),
                              h.TextAnchor('end'),
                              h.Class('histogram-axis-label'),
                            ],
                            [String(value)],
                          ),
                        ],
                      ),
                    ),
                    ...geometry.xTicks.map(({ value, x }) =>
                      h.text(
                        [
                          h.X(String(x)),
                          h.Y('276'),
                          h.TextAnchor('middle'),
                          h.Class('histogram-axis-label'),
                        ],
                        [String(value)],
                      ),
                    ),
                    ...geometry.bars.map(({ x, y, width, height, interval, count }) =>
                      h.g(
                        [],
                        [
                          h.rect(
                            [
                              h.X(String(x)),
                              h.Y(String(y)),
                              h.Width(String(width)),
                              h.Height(String(height)),
                              h.Class('histogram-bar'),
                            ],
                            [h.title([], [interval + ': ' + count + ' observations'])],
                          ),
                          h.text(
                            [
                              h.X(String(x + width / 2)),
                              h.Y(String(y - 7)),
                              h.TextAnchor('middle'),
                              h.Class('histogram-axis-label'),
                            ],
                            [String(count)],
                          ),
                        ],
                      ),
                    ),
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
                    'The same 40 observations, grouped differently. Bar labels show counts; the Y-axis rescales to the largest bin.',
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
              [h.Tabindex(0), h.AriaLabel(model.activeFile + ' source code')],
              [h.code([], [currentSource(model)])],
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
