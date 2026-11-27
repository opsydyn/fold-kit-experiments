import '@opsydyn/dataset-explorer/highlighting.css';
import { Mount } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { highlightedCode, sourceLineChanges } from '@opsydyn/dataset-explorer/source-ui';
import { dataTable } from '@opsydyn/foldkit-viz/effect-ui/cartesian';
import { Option, Schema, Stream } from 'effect';

import { frameForWidth } from '#example/frame';

import { scatterGeometry } from './chart';
import { scatterChart, scatterLegend } from './chart-view';
import { points } from './data';
import { MeasureScatterChart } from './measurement';
import { Message } from './message';
import { ActionStatus, SourceName, type Model } from './model';
import { currentSource } from './update';

const ObserveScatter = Mount.makeStream('ObserveScatter', { args: {} }, (element: HTMLElement) =>
  Stream.concat(
    Stream.make(Message.MountedScatter()),
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

export const view = (h: Html.H<Message>, model: Model) => {
  const geometry = scatterGeometry(points, model.settings, {
    frame: frameForWidth(model.chartWidth, 320),
  });
  const selected = geometry.points.find(({ id }) => id === model.settings.selectedPoint);
  const pending = ActionStatus.is('Pending')(model.actionStatus);
  const action = (label: string, message: Message) =>
    h.button.attr('type', 'button').disabled(pending).on('click', message).children(label);
  const range = (id: string, label: string, axis: 'xMax' | 'yMax') =>
    h.div.class('scatter-range').children(
      h.label.attr('for', id).children(label, h.span(String(model.settings[axis]))),
      h.input
        .attrs({ id, type: 'range', min: '100', max: '200', step: '10' })
        .value(String(model.settings[axis]))
        .on('input', ({ value }) => Message.ChangedDomain({ axis, value })),
    );
  return h.div
    .class('scatter-playground')
    .onMount(Mount.map(ObserveScatter(), (message) => message))
    .children(
      h.div.class('scatter-workbench').children(
        h.div.class('scatter-preview').children(
          h.div
            .class('scatter-preview-heading')
            .children(h.span('LIVE PREVIEW'), h.span('Illustrative data')),
          h.div
            .class('chart-viewport')
            .onMount(Mount.map(MeasureScatterChart(), (message) => message))
            .children(scatterChart(h, geometry, model.settings.selectedPoint)),
          geometry.points.length === 0 &&
            h.p.attr('role', 'status').children('No points to display'),
          scatterLegend(h),
          h.details.class('chart-data').children(
            h.summary('View source data'),
            dataTable(h, {
              caption: 'Illustrative scatter values',
              headers: ['Point', 'Group', 'X', 'Y'],
              rows: geometry.points.map(({ id, group, x, y }) => [
                id,
                group.toUpperCase(),
                String(x),
                String(y),
              ]),
            }),
          ),
          h.div
            .class('scatter-inspector')
            .attr('aria-live', 'polite')
            .children(
              selected
                ? [
                    h.p(h.strong(selected.id), ' · Group ' + selected.group.toUpperCase()),
                    h.dl(
                      h.div(h.dt('X value'), h.dd(String(selected.x))),
                      h.div(h.dt('Y value'), h.dd(String(selected.y))),
                    ),
                  ]
                : h.p('Use arrow keys, tap or choose a point to inspect its values.'),
            ),
          h.p
            .class('scatter-preview-caption')
            .children(
              'Widen either domain to see the same values move through the scales. The data stays fixed.',
            ),
        ),
        h.div.class('scatter-controls').children(
          h.fieldset(
            h.legend('Point groups'),
            h.div.class('scatter-segmented').children(
              ...(
                [
                  ['all', 'All'],
                  ['a', 'Group A'],
                  ['b', 'Group B'],
                ] as const
              ).map(([group, label]) =>
                h.button
                  .attrs({ type: 'button', 'aria-pressed': String(model.settings.group === group) })
                  .on('click', Message.SelectedGroup({ group }))
                  .children(label),
              ),
            ),
          ),
          range('scatter-x-max', 'X domain maximum', 'xMax'),
          range('scatter-y-max', 'Y domain maximum', 'yMax'),
          h.div.class('scatter-inspect-select').children(
            h.label.attr('for', 'scatter-point').children('Inspect point'),
            h.select
              .attr('id', 'scatter-point')
              .value(model.settings.selectedPoint ?? '')
              .on('change', ({ value }) => Message.SelectedPoint({ id: value }))
              .children(
                h.option.attr('value', '').children('Choose a point…'),
                ...geometry.points.map(({ id, group, x, y }) =>
                  h.option
                    .attr('value', id)
                    .children(`${id} · Group ${group.toUpperCase()} (${x}, ${y})`),
                ),
              ),
          ),
          h.button
            .class('scatter-reset')
            .attr('type', 'button')
            .on('click', Message.ClickedReset())
            .children('Reset example'),
        ),
      ),
      h.div.class('scatter-source').children(
        h.div.class('scatter-source-toolbar').children(
          h.label.attr('for', 'scatter-source-file').children('Source file'),
          h.select
            .attr('id', 'scatter-source-file')
            .value(model.activeFile)
            .on('change', ({ value }) =>
              Option.map(Schema.decodeUnknownOption(SourceName)(value), (name) =>
                Message.SelectedFile({ name }),
              ).pipe(Option.getOrUndefined),
            )
            .children(
              ...model.sources.map(({ name }) => h.option.attr('value', name).children(name)),
            ),
          action('Copy file', Message.ClickedCopy()),
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
      h.div
        .class('scatter-export')
        .children(
          h.p.attrs({ role: 'status', 'aria-live': 'polite' }).children(feedback(model)),
          model.templateUrl !== null &&
            h.div
              .class('scatter-export-buttons')
              .children(
                action('Download project', Message.ClickedDownload()),
                action('Open in StackBlitz ↗', Message.ClickedPlayground()),
              ),
        ),
    );
};
