import { Schema } from 'effect';
import type { Document, HtmlBuilder } from 'foldkit/html';

import { scatterGeometry } from './chart';
import { points } from './data';
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
  const geometry = scatterGeometry(points, model.settings);
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
                h.svg(
                  [
                    h.ViewBox('0 0 560 320'),
                    h.Role('group'),
                    h.AriaLabel('Scatter plot. Focus or tap a point to inspect its values.'),
                  ],
                  [
                    h.title([], ['Scatter']),
                    h.desc(
                      [],
                      [
                        geometry.points.length +
                          ' illustrative points. X domain 0 to ' +
                          model.settings.xMax +
                          '; Y domain 0 to ' +
                          model.settings.yMax +
                          '.',
                      ],
                    ),
                    h.text([h.X('48'), h.Y('16'), h.Class('scatter-axis-label')], ['Y value']),
                    h.text(
                      [
                        h.X('288'),
                        h.Y('306'),
                        h.TextAnchor('middle'),
                        h.Class('scatter-axis-label'),
                      ],
                      ['X value'],
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
                              h.Class('scatter-grid'),
                            ],
                            [],
                          ),
                          h.text(
                            [
                              h.X('36'),
                              h.Y(String(y + 4)),
                              h.TextAnchor('end'),
                              h.Class('scatter-axis-label'),
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
                          h.Class('scatter-axis-label'),
                        ],
                        [String(value)],
                      ),
                    ),
                    ...geometry.points.map(({ id, group, x, y, cx, cy }) =>
                      h.circle(
                        [
                          h.Cx(String(cx)),
                          h.Cy(String(cy)),
                          h.R(id === model.settings.selectedPoint ? '8' : '6'),
                          h.Class('scatter-point' + (group === 'b' ? ' scatter-point-b' : '')),
                          h.Tabindex(0),
                          h.Role('img'),
                          h.AriaLabel(
                            id + ', Group ' + group.toUpperCase() + ', X ' + x + ', Y ' + y,
                          ),
                          h.AriaCurrent(String(id === model.settings.selectedPoint)),
                          h.OnFocus(Message.SelectedPoint({ id })),
                          h.OnMouseEnter(Message.SelectedPoint({ id })),
                          h.OnClick(Message.SelectedPoint({ id })),
                        ],
                        [h.title([], [id + ': (' + x + ', ' + y + ')'])],
                      ),
                    ),
                  ],
                ),
                h.div(
                  [h.Class('scatter-legend')],
                  [
                    h.span([], [h.i([h.AriaHidden(true)], []), 'Group A']),
                    h.span([], [h.i([h.AriaHidden(true)], []), 'Group B']),
                  ],
                ),
                h.div(
                  [h.Class('scatter-inspector')],
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
                    : [h.p([], ['Focus, tap or choose a point to inspect its values.'])],
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
              [h.Tabindex(0), h.AriaLabel(model.activeFile + ' source code')],
              [h.code([], [currentSource(model)])],
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
