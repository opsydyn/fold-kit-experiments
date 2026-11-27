import '@opsydyn/dataset-explorer/highlighting.css';
import { Mount } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { highlightedCode, sourceLineChanges } from '@opsydyn/dataset-explorer/source-ui';
import { dataTable } from '@opsydyn/foldkit-viz/effect-ui/cartesian';
import { Option, Schema, Stream } from 'effect';

import { frameForWidth } from '#example/frame';

import { chartGeometry } from './chart';
import { lineChart, lineLegend } from './chart-view';
import { EmbedEditor } from './editor-mount';
import { MeasureLineChart } from './measurement';
import { Message } from './message';
import { ActionStatus, Editor, EditorStatus, SourceName, type Model } from './model';
import { currentSource } from './update';

const ObserveLine = Mount.makeStream('ObserveLine', { args: {} }, (element: HTMLElement) =>
  Stream.concat(
    Stream.make(Message.MountedLine()),
    Stream.map(sourceLineChanges(element), Message.NavigatedSourceLine),
  ),
);

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

const panels = [
  ['controls', 'Controls'],
  ['edit', 'Edit live'],
] as const;

function tabMessage(panel: Model['panel'], key: string): Message | undefined {
  if (key === 'Home') return Message.NavigatedPanel({ panel: 'controls' });
  if (key === 'End') return Message.NavigatedPanel({ panel: 'edit' });
  if (key === 'ArrowLeft' || key === 'ArrowRight')
    return Message.NavigatedPanel({ panel: panel === 'edit' ? 'controls' : 'edit' });
  return undefined;
}

export const view = (h: Html.H<Message>, model: Model) => {
  const frame = frameForWidth(model.chartWidth, 290);
  const geometry = chartGeometry(model.settings, { frame });
  const reference = model.settings.values.map((value) => value * 0.75);
  const comparison = chartGeometry({ ...model.settings, values: reference }, { frame });
  const pending = model.actionStatus._tag === 'Pending';
  const templateUrl = model.templateUrl;
  const hasEditor = templateUrl !== null && model.embeddedEditor;

  const action = (label: string, message: Message, disabled = false) =>
    h.button.attr('type', 'button').disabled(disabled).on('click', message).children(label);
  const range = (
    id: string,
    name: string,
    value: number,
    min: string,
    max: string,
    step: string,
    toMessage: (value: string) => Message,
  ) =>
    h.div.class('line-range').children(
      h.label.attr('for', id).children(name, h.span(String(value))),
      h.input
        .attrs({ id, type: 'range', min, max, step })
        .value(String(value))
        .on('input', ({ value }) => toMessage(value)),
    );

  return h.div
    .class('line-playground')
    .onMount(Mount.map(ObserveLine(), (message) => message))
    .children(
      hasEditor &&
        h.div
          .class('line-tabs')
          .attrs({ role: 'tablist', 'aria-label': 'Example mode' })
          .children(
            ...panels.map(([panel, label]) =>
              h.button
                .attrs({
                  id: 'line-tab-' + panel,
                  type: 'button',
                  role: 'tab',
                  'aria-selected': String(model.panel === panel),
                  'aria-controls': 'line-panel-' + panel,
                  tabindex: model.panel === panel ? '0' : '-1',
                })
                .on('click', Message.SelectedPanel({ panel }))
                .on(
                  'keydown',
                  ({ key, composing }) => (composing ? undefined : tabMessage(panel, key)),
                  { preventDefault: true },
                )
                .children(label),
            ),
          ),
      h.div
        .attrs({
          id: 'line-panel-controls',
          role: hasEditor ? 'tabpanel' : 'group',
          'aria-label': hasEditor ? undefined : 'Chart controls and source',
          'aria-labelledby': hasEditor ? 'line-tab-controls' : undefined,
          hidden: model.panel === 'controls' ? undefined : '',
        })
        .children(
          h.div.class('line-workbench').children(
            h.div.class('line-preview').children(
              h.div
                .class('line-preview-heading')
                .children(h.span('LIVE PREVIEW'), h.span('Illustrative data')),
              h.div
                .class('chart-viewport')
                .onMount(Mount.map(MeasureLineChart(), (message) => message))
                .children(lineChart(h, geometry, comparison.path, model.settings.values)),
              geometry.points.length === 0 &&
                h.p.attr('role', 'status').children('No values to display'),
              lineLegend(h),
              h.details.class('chart-data').children(
                h.summary('View source data'),
                dataTable(h, {
                  caption: 'Illustrative line values',
                  headers: ['Point', 'Value', '75% reference'],
                  rows: model.settings.values.map((value, index) => [
                    String(index + 1),
                    String(value),
                    String(value * 0.75),
                  ]),
                }),
              ),
              h.p
                .class('line-preview-caption')
                .children(
                  'Change a point or the domain. The scales recompute coordinates; the curve connects them.',
                ),
            ),
            h.div.class('line-controls').children(
              h.fieldset(
                h.legend('Interpolation'),
                h.div.class('line-segmented').children(
                  ...(
                    [
                      ['catmullRom', 'Smooth'],
                      ['linear', 'Linear'],
                      ['step', 'Step'],
                    ] as const
                  ).map(([curve, label]) =>
                    h.button
                      .attrs({
                        type: 'button',
                        'aria-pressed': String(model.settings.curve === curve),
                      })
                      .on('click', Message.SelectedCurve({ curve }))
                      .children(label),
                  ),
                ),
              ),
              h.fieldset(
                h.legend('Point values'),
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
              h.button
                .class('line-reset')
                .attr('type', 'button')
                .on('click', Message.ClickedReset())
                .children('Reset example'),
            ),
          ),
          h.div.class('line-source').children(
            h.div.class('line-source-toolbar').children(
              h.label.attr('for', 'line-source-file').children('Source file'),
              h.select
                .attr('id', 'line-source-file')
                .value(model.activeFile)
                .on('change', ({ value }) =>
                  Option.map(Schema.decodeUnknownOption(SourceName)(value), (name) =>
                    Message.SelectedFile({ name }),
                  ).pipe(Option.getOrUndefined),
                )
                .children(
                  ...model.sources.map(({ name }) => h.option.attr('value', name).children(name)),
                ),
              action('Copy file', Message.ClickedCopy(), pending),
            ),
            h.pre
              .class('syntax-highlight')
              .attrs({ tabindex: '0', 'aria-label': model.activeFile + ' source code' })
              .children(
                h.code(
                  ...highlightedCode(
                    h,
                    currentSource(model),
                    model.activeFile,
                    model.highlightedSource,
                    model.activeFile,
                  ),
                ),
              ),
          ),
        ),
      hasEditor &&
        h.div
          .attrs({
            id: 'line-panel-edit',
            role: 'tabpanel',
            'aria-labelledby': 'line-tab-edit',
            hidden: model.panel === 'edit' ? undefined : '',
          })
          .children(
            h.div
              .class('line-editor-heading')
              .children(
                h.div(
                  h.h2('Change the code. See the chart.'),
                  h.p('Edit settings.ts, chart.ts or view.ts. The preview updates as you edit.'),
                ),
                action(
                  'Restart from controls',
                  Message.ClickedRestartEditor(),
                  model.editor._tag === 'Idle' || model.editor.status._tag === 'Loading',
                ),
              ),
            h.p
              .class('line-editor-note')
              .children(
                'Edits stay in this editor when switching tabs. Restart replaces them with the current control settings. Use StackBlitz to save or download your code edits; the buttons below export the control settings.',
              ),
            Editor.match(model.editor, {
              Idle: () => undefined,
              Session: ({ initialSettings, revision, status }) => [
                h.p
                  .class('line-editor-status')
                  .attrs({ role: 'status', 'aria-live': 'polite' })
                  .children(
                    EditorStatus.match(status, {
                      Loading: () => 'Loading the editor… The first start may take a minute.',
                      Ready: () =>
                        'Editor connected. The preview starts after dependencies install.',
                      Failed: ({ error }) => error,
                    }),
                  ),
                h.div
                  .key('line-editor-' + revision)
                  .class('line-editor-host')
                  .attr('hidden', status._tag === 'Failed' ? '' : undefined)
                  .onMount(
                    Mount.map(
                      EmbedEditor({ initialSettings, revision, templateUrl }),
                      (message) => message,
                    ),
                  )
                  .children(),
              ],
            }),
          ),
      h.div
        .class('line-export')
        .children(
          h.p.attrs({ role: 'status', 'aria-live': 'polite' }).children(feedback(model)),
          templateUrl !== null &&
            h.div
              .class('line-export-buttons')
              .children(
                action('Download project', Message.ClickedDownload(), pending),
                action('Open in StackBlitz ↗', Message.ClickedPlayground(), pending),
              ),
        ),
    );
};
