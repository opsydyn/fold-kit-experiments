import '@opsydyn/dataset-explorer/highlighting.css';
import { highlightedCode } from '@opsydyn/dataset-explorer/highlighting';
import {
  axis,
  chartFrame,
  dataTable,
  grid,
  legend,
  pointSeries,
  tooltip,
} from '@opsydyn/foldkit-viz/foldkit/cartesian';
import { Option, Schema } from 'effect';
import type { Document, HtmlBuilder } from 'foldkit/html';

import { frameForWidth } from '#example/frame';

import { scatterGeometry, chartTheme, seriesStyles } from './chart';
import { points } from './data';
import { MeasureScatterChart } from './measurement';
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
  const geometry = scatterGeometry(points, model.settings, {
    frame: frameForWidth(model.chartWidth, 320),
  });
  const styleFor = (key: string) => seriesStyles.get(key) ?? chartTheme.series;
  const selectedPoint = geometry.cartesian.points.find(
    (point) => point.key === model.settings.selectedPoint,
  );
  const selected = geometry.points.find((point) => point.id === model.settings.selectedPoint);
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
      [h.Class('scatter-range')],
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
    title: 'Live scatter — Foldkit Viz',
    body: h.div(
      [h.Class('scatter-playground')],
      [
        h.div(
          [h.Class('scatter-workbench')],
          [
            h.div(
              [h.Class('scatter-preview')],
              [
                h.div(
                  [h.Class('scatter-preview-heading')],
                  [h.span([], ['LIVE PREVIEW']), h.span([], ['Illustrative data'])],
                ),
                h.div(
                  [h.Class('chart-viewport'), h.OnMount(MeasureScatterChart())],
                  [
                    chartFrame(
                      h,
                      {
                        layout: geometry.cartesian.layout,
                        title: 'Illustrative scatter plot',
                        description:
                          geometry.points.length +
                          ' points. Use arrow keys, Home or End to inspect; Escape clears inspection. Group A uses circles and Group B squares.',
                        theme: chartTheme,
                        interactive: true,
                        onKeyDown: (key) =>
                          [
                            'ArrowLeft',
                            'ArrowRight',
                            'ArrowUp',
                            'ArrowDown',
                            'Home',
                            'End',
                            'Escape',
                          ].includes(key)
                            ? Option.some(Message.PressedChartKey({ key }))
                            : Option.none(),
                      },
                      [
                        grid(h, { ...geometry.cartesian, theme: chartTheme }),
                        axis(h, {
                          layout: geometry.cartesian.layout,
                          orientation: 'left',
                          ticks: geometry.cartesian.yTicks,
                          label: 'Y value',
                          format: (value) => String(value),
                          theme: chartTheme,
                        }),
                        axis(h, {
                          layout: geometry.cartesian.layout,
                          orientation: 'bottom',
                          ticks: geometry.cartesian.xTicks,
                          label: 'X value',
                          format: (value) => String(value),
                          theme: chartTheme,
                        }),
                        pointSeries(h, {
                          points: geometry.cartesian.points,
                          styleFor: (point) => styleFor(point.seriesKey),
                          labelFor: (point) =>
                            `${point.id}, Group ${point.group.toUpperCase()}, X ${point.x}, Y ${point.y}`,
                          activeKey: model.settings.selectedPoint,
                          onInspect: (id) => Message.SelectedPoint({ id }),
                        }),
                        ...(selectedPoint
                          ? [
                              tooltip(h, {
                                point: selectedPoint,
                                style: styleFor(selectedPoint.seriesKey),
                                theme: chartTheme,
                                render: (context, builder) => {
                                  const { plot } = geometry.cartesian.layout;
                                  const width = Math.min(180, plot.width);
                                  const x = Math.max(
                                    plot.left,
                                    Math.min(plot.right - width, context.x - width / 2),
                                  );
                                  const y = Math.max(plot.top, context.y - 64);
                                  return builder.g(
                                    [
                                      builder.Class('chart-tooltip'),
                                      builder.Style({ 'pointer-events': 'none' }),
                                    ],
                                    [
                                      builder.rect(
                                        [
                                          builder.X(String(x)),
                                          builder.Y(String(y)),
                                          builder.Width(String(width)),
                                          builder.Height('54'),
                                          builder.Rx('5'),
                                          builder.Fill(chartTheme.tooltipBackground),
                                          builder.Stroke(context.style.stroke),
                                        ],
                                        [],
                                      ),
                                      builder.text(
                                        [
                                          builder.X(String(x + 10)),
                                          builder.Y(String(y + 20)),
                                          builder.Fill(chartTheme.tooltipText),
                                          builder.FontSize('12'),
                                        ],
                                        [
                                          context.datum.id +
                                            ' · Group ' +
                                            context.datum.group.toUpperCase(),
                                        ],
                                      ),
                                      builder.text(
                                        [
                                          builder.X(String(x + 10)),
                                          builder.Y(String(y + 40)),
                                          builder.Fill(chartTheme.tooltipText),
                                          builder.FontSize('12'),
                                        ],
                                        [`X ${context.datum.x} · Y ${context.datum.y}`],
                                      ),
                                    ],
                                  );
                                },
                              }),
                            ]
                          : []),
                      ],
                    ),
                  ],
                ),
                ...(geometry.points.length === 0
                  ? [h.p([h.Role('status')], ['No points to display'])]
                  : []),
                legend(h, {
                  theme: chartTheme,
                  entries: [
                    { key: 'a', label: 'Group A · circles', style: styleFor('a') },
                    { key: 'b', label: 'Group B · squares', style: styleFor('b') },
                  ],
                }),
                h.details(
                  [h.Class('chart-data')],
                  [
                    h.summary([], ['View source data']),
                    dataTable(h, {
                      caption: 'Illustrative scatter values',
                      headers: ['Point', 'Group', 'X', 'Y'],
                      rows: geometry.points.map((point) => [
                        point.id,
                        point.group.toUpperCase(),
                        String(point.x),
                        String(point.y),
                      ]),
                    }),
                  ],
                ),
                h.div(
                  [h.Class('scatter-inspector'), h.AriaLive('polite')],
                  selected
                    ? [
                        h.p(
                          [],
                          [h.strong([], [selected.id]), ' · Group ' + selected.group.toUpperCase()],
                        ),
                        h.dl(
                          [],
                          [
                            h.div([], [h.dt([], ['X value']), h.dd([], [String(selected.x)])]),
                            h.div([], [h.dt([], ['Y value']), h.dd([], [String(selected.y)])]),
                          ],
                        ),
                      ]
                    : [h.p([], ['Use arrow keys, tap or choose a point to inspect its values.'])],
                ),
                h.p(
                  [h.Class('scatter-preview-caption')],
                  [
                    'Widen either domain to see the same values move through the scales. The data stays fixed.',
                  ],
                ),
              ],
            ),
            h.div(
              [h.Class('scatter-controls')],
              [
                h.fieldset(
                  [],
                  [
                    h.legend([], ['Point groups']),
                    h.div(
                      [h.Class('scatter-segmented')],
                      (
                        [
                          ['all', 'All'],
                          ['a', 'Group A'],
                          ['b', 'Group B'],
                        ] as const
                      ).map(([group, label]) =>
                        h.button(
                          [
                            h.Type('button'),
                            h.AriaPressed(String(model.settings.group === group)),
                            h.OnClick(Message.SelectedGroup({ group })),
                          ],
                          [label],
                        ),
                      ),
                    ),
                  ],
                ),
                range(
                  'scatter-x-max',
                  'X domain maximum',
                  model.settings.xMax,
                  '100',
                  '200',
                  '10',
                  (value) => Message.ChangedDomain({ axis: 'xMax', value }),
                ),
                range(
                  'scatter-y-max',
                  'Y domain maximum',
                  model.settings.yMax,
                  '100',
                  '200',
                  '10',
                  (value) => Message.ChangedDomain({ axis: 'yMax', value }),
                ),
                h.div(
                  [h.Class('scatter-inspect-select')],
                  [
                    h.label([h.For('scatter-point')], ['Inspect point']),
                    h.select(
                      [
                        h.Id('scatter-point'),
                        h.Value(model.settings.selectedPoint ?? ''),
                        h.OnChange((id) => Message.SelectedPoint({ id })),
                      ],
                      [
                        h.option([h.Value('')], ['Choose a point…']),
                        ...geometry.points.map(({ id, group, x, y }) =>
                          h.option(
                            [h.Value(id)],
                            [id + ' · Group ' + group.toUpperCase() + ' (' + x + ', ' + y + ')'],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                h.button(
                  [h.Class('scatter-reset'), h.Type('button'), h.OnClick(Message.ClickedReset())],
                  ['Reset example'],
                ),
              ],
            ),
          ],
        ),
        h.div(
          [h.Class('scatter-source')],
          [
            h.div(
              [h.Class('scatter-source-toolbar')],
              [
                h.label([h.For('scatter-source-file')], ['Source file']),
                h.select(
                  [
                    h.Id('scatter-source-file'),
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
                    model.activeFile,
                  ),
                ),
              ],
            ),
          ],
        ),
        h.div(
          [h.Class('scatter-export')],
          [
            h.p([h.Role('status'), h.AriaLive('polite')], [feedback(model)]),
            ...(model.templateUrl === null
              ? []
              : [
                  h.div(
                    [h.Class('scatter-export-buttons')],
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
