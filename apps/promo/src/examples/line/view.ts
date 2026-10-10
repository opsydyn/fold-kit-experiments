import '@opsydyn/dataset-explorer/highlighting.css';
import { highlightedCode } from '@opsydyn/dataset-explorer/highlighting';
import {
  annotation,
  axis,
  chartFrame,
  dataTable,
  grid,
  legend,
  lineSeries,
  pointSeries,
} from '@opsydyn/foldkit-viz/foldkit/cartesian';
import { Option, Schema } from 'effect';
import type { Document, HtmlBuilder } from 'foldkit/html';

import { frameForWidth } from '#example/frame';

import { chartGeometry, chartTheme, seriesStyle, comparisonStyle } from './chart';
import { EmbedEditor } from './editor-mount';
import { MeasureLineChart } from './measurement';
import { Message } from './message';
import { ActionStatus, Editor, EditorStatus, SourceName } from './model';
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
  const frame = frameForWidth(model.chartWidth, 290);
  const geometry = chartGeometry(model.settings, { frame });
  const comparison = chartGeometry(
    { ...model.settings, values: model.settings.values.map((value) => value * 0.75) },
    { frame },
  );
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
      [h.Class('line-range')],
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
  const hasEditor = model.templateUrl !== null && model.embeddedEditor;
  return {
    title: 'Live line — Foldkit Viz',
    body: h.div(
      [h.Class('line-playground')],
      [
        ...(!hasEditor
          ? []
          : [
              h.div(
                [h.Class('line-tabs'), h.Role('tablist'), h.AriaLabel('Example mode')],
                (
                  [
                    ['controls', 'Controls'],
                    ['edit', 'Edit live'],
                  ] as const
                ).map(([panel, label]) =>
                  h.button(
                    [
                      h.Id('line-tab-' + panel),
                      h.Type('button'),
                      h.Role('tab'),
                      h.AriaSelected(model.panel === panel),
                      h.AriaControls('line-panel-' + panel),
                      h.Tabindex(model.panel === panel ? 0 : -1),
                      h.OnClick(Message.SelectedPanel({ panel })),
                      h.OnKeyDownFocus((key) => {
                        const next =
                          key === 'Home'
                            ? 'controls'
                            : key === 'End'
                              ? 'edit'
                              : key === 'ArrowLeft' || key === 'ArrowRight'
                                ? panel === 'edit'
                                  ? 'controls'
                                  : 'edit'
                                : null;
                        return next === null
                          ? Option.none()
                          : Option.some({
                              focusSelector: '#line-tab-' + next,
                              message: Message.SelectedPanel({ panel: next }),
                            });
                      }),
                    ],
                    [label],
                  ),
                ),
              ),
            ]),
        h.div(
          [
            h.Id('line-panel-controls'),
            h.Role(hasEditor ? 'tabpanel' : 'group'),
            !hasEditor
              ? h.AriaLabel('Chart controls and source')
              : h.AriaLabelledBy('line-tab-controls'),
            h.Hidden(model.panel !== 'controls'),
          ],
          [
            h.div(
              [h.Class('line-workbench')],
              [
                h.div(
                  [h.Class('line-preview')],
                  [
                    h.div(
                      [h.Class('line-preview-heading')],
                      [h.span([], ['LIVE PREVIEW']), h.span([], ['Illustrative data'])],
                    ),
                    h.div(
                      [h.Class('chart-viewport'), h.OnMount(MeasureLineChart())],
                      [
                        chartFrame(
                          h,
                          {
                            layout: geometry.cartesian.layout,
                            title: 'Illustrative line chart',
                            description:
                              'Values: ' +
                              model.settings.values.join(', ') +
                              '. Dashed reference is 75% of each value; threshold is 80 units.',
                            theme: chartTheme,
                          },
                          [
                            grid(h, { ...geometry.cartesian, theme: chartTheme }),
                            axis(h, {
                              layout: geometry.cartesian.layout,
                              orientation: 'left',
                              ticks: geometry.cartesian.yTicks,
                              label: 'Value (units)',
                              format: (value) => String(value),
                              theme: chartTheme,
                            }),
                            axis(h, {
                              layout: geometry.cartesian.layout,
                              orientation: 'bottom',
                              ticks: geometry.cartesian.xTicks.filter((t) =>
                                Number.isInteger(t.value),
                              ),
                              label: 'Point',
                              format: (value) => String(value + 1),
                              theme: chartTheme,
                            }),
                            lineSeries(h, { path: comparison.path, style: comparisonStyle }),
                            lineSeries(h, { path: geometry.path, style: seriesStyle }),
                            pointSeries(h, {
                              points: geometry.cartesian.points,
                              styleFor: () => seriesStyle,
                              labelFor: (value) => String(value),
                              activeKey: null,
                            }),
                            annotation(h, {
                              layout: geometry.cartesian.layout,
                              axis: 'y',
                              value: 80,
                              label: 'Threshold 80',
                              style: comparisonStyle,
                            }),
                          ],
                        ),
                      ],
                    ),
                    ...(geometry.points.length === 0
                      ? [h.p([h.Role('status')], ['No values to display'])]
                      : []),
                    legend(h, {
                      theme: chartTheme,
                      entries: [
                        { key: 'values', label: 'Values', style: seriesStyle },
                        { key: 'reference', label: '75% reference', style: comparisonStyle },
                      ],
                    }),
                    h.details(
                      [h.Class('chart-data')],
                      [
                        h.summary([], ['View source data']),
                        dataTable(h, {
                          caption: 'Illustrative line values',
                          headers: ['Point', 'Value', '75% reference'],
                          rows: model.settings.values.map((value, index) => [
                            String(index + 1),
                            String(value),
                            String(value * 0.75),
                          ]),
                        }),
                      ],
                    ),
                    h.p(
                      [h.Class('line-preview-caption')],
                      [
                        'Change a point or the domain. The scales recompute coordinates; the curve connects them.',
                      ],
                    ),
                  ],
                ),
                h.div(
                  [h.Class('line-controls')],
                  [
                    h.fieldset(
                      [],
                      [
                        h.legend([], ['Interpolation']),
                        h.div(
                          [h.Class('line-segmented')],
                          (
                            [
                              ['catmullRom', 'Smooth'],
                              ['linear', 'Linear'],
                              ['step', 'Step'],
                            ] as const
                          ).map(([curve, label]) =>
                            h.button(
                              [
                                h.Type('button'),
                                h.AriaPressed(String(model.settings.curve === curve)),
                                h.OnClick(Message.SelectedCurve({ curve })),
                              ],
                              [label],
                            ),
                          ),
                        ),
                      ],
                    ),
                    h.fieldset(
                      [],
                      [
                        h.legend([], ['Point values']),
                        ...model.settings.values.map((value, index) =>
                          range(
                            'line-point-' + index,
                            'Point ' + (index + 1),
                            value,
                            '0',
                            '100',
                            '1',
                            (raw) => Message.ChangedPoint({ index, value: raw }),
                          ),
                        ),
                      ],
                    ),
                    range(
                      'line-domain',
                      'Y-axis maximum',
                      model.settings.yMax,
                      '100',
                      '200',
                      '10',
                      (value) => Message.ChangedDomain({ value }),
                    ),
                    h.button(
                      [h.Class('line-reset'), h.Type('button'), h.OnClick(Message.ClickedReset())],
                      ['Reset example'],
                    ),
                  ],
                ),
              ],
            ),
            h.div(
              [h.Class('line-source')],
              [
                h.div(
                  [h.Class('line-source-toolbar')],
                  [
                    h.label([h.For('line-source-file')], ['Source file']),
                    h.select(
                      [
                        h.Id('line-source-file'),
                        h.Value(model.activeFile),
                        h.OnChange((value) =>
                          Message.SelectedFile({
                            name: Schema.decodeUnknownSync(SourceName)(value),
                          }),
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
          ],
        ),
        ...(!hasEditor
          ? []
          : [
              h.div(
                [
                  h.Id('line-panel-edit'),
                  h.Role('tabpanel'),
                  h.AriaLabelledBy('line-tab-edit'),
                  h.Hidden(model.panel !== 'edit'),
                ],
                [
                  h.div(
                    [h.Class('line-editor-heading')],
                    [
                      h.div(
                        [],
                        [
                          h.h2([], ['Change the code. See the chart.']),
                          h.p(
                            [],
                            [
                              'Edit settings.ts, chart.ts or view.ts. The preview updates as you edit.',
                            ],
                          ),
                        ],
                      ),
                      h.button(
                        [
                          h.Type('button'),
                          h.Disabled(
                            model.editor._tag === 'Idle' || model.editor.status._tag === 'Loading',
                          ),
                          h.OnClick(Message.ClickedRestartEditor()),
                        ],
                        ['Restart from controls'],
                      ),
                    ],
                  ),
                  h.p(
                    [h.Class('line-editor-note')],
                    [
                      'Edits stay in this editor when switching tabs. Restart replaces them with the current control settings. Use StackBlitz to save or download your code edits; the buttons below export the control settings.',
                    ],
                  ),
                  ...Editor.match(model.editor, {
                    Idle: () => [],
                    Session: (session) => [
                      h.p(
                        [h.Role('status'), h.AriaLive('polite'), h.Class('line-editor-status')],
                        [
                          EditorStatus.match(session.status, {
                            Loading: () => 'Loading the editor… The first start may take a minute.',
                            Ready: () =>
                              'Editor connected. The preview starts after dependencies install.',
                            Failed: ({ error }) => error,
                          }),
                        ],
                      ),
                      h.div(
                        [
                          h.Key('line-editor-' + session.revision),
                          h.Class('line-editor-host'),
                          h.Hidden(session.status._tag === 'Failed'),
                          h.OnMount(
                            EmbedEditor({
                              initialSettings: session.initialSettings,
                              revision: session.revision,
                              templateUrl: model.templateUrl ?? '',
                            }),
                          ),
                        ],
                        [],
                      ),
                    ],
                  }),
                ],
              ),
            ]),
        h.div(
          [h.Class('line-export')],
          [
            h.p([h.Role('status'), h.AriaLive('polite')], [feedback(model)]),
            ...(model.templateUrl === null
              ? []
              : [
                  h.div(
                    [h.Class('line-export-buttons')],
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
