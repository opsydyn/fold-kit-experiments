import '@opsydyn/dataset-explorer/highlighting.css';
import { Mount } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { highlightedCode, sourceLineChanges } from '@opsydyn/dataset-explorer/source-ui';
import { dataTable } from '@opsydyn/foldkit-viz/effect-ui/cartesian';
import { Option, Schema, Stream } from 'effect';

import { frameForWidth } from '#example/frame';

import { histogramGeometry } from './chart';
import { histogramChart } from './chart-view';
import { datasets } from './data';
import { MeasureHistogramChart } from './measurement';
import { Message } from './message';
import { ActionStatus, SourceName, type Model } from './model';
import { currentSource } from './update';

const ObserveHistogram = Mount.makeStream(
  'ObserveHistogram',
  { args: {} },
  (element: HTMLElement) =>
    Stream.concat(
      Stream.make(Message.MountedHistogram()),
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
  const values = datasets[model.settings.dataset];
  const geometry = histogramGeometry(values, model.settings.binCount, {
    frame: frameForWidth(model.chartWidth, 290),
  });
  const pending = ActionStatus.is('Pending')(model.actionStatus);
  const action = (label: string, message: Message) =>
    h.button.attr('type', 'button').disabled(pending).on('click', message).children(label);
  return h.div
    .class('histogram-playground')
    .onMount(Mount.map(ObserveHistogram(), (message) => message))
    .children(
      h.div.class('histogram-workbench').children(
        h.div.class('histogram-preview').children(
          h.div
            .class('histogram-preview-heading')
            .children(h.span('LIVE PREVIEW'), h.span('Illustrative data')),
          h.div
            .class('chart-viewport')
            .onMount(Mount.map(MeasureHistogramChart(), (message) => message))
            .children(histogramChart(h, geometry)),
          geometry.total === 0 && h.p.attr('role', 'status').children('No values to display'),
          h.details.class('chart-data').children(
            h.summary('View source data'),
            dataTable(h, {
              caption: 'Illustrative histogram values',
              headers: ['Observation', 'Value'],
              rows: values.map((value, index) => [String(index + 1), String(value)]),
            }),
          ),
          h.div
            .class('histogram-intervals')
            .children(
              h.p.class('histogram-intervals-heading').children('INTERVAL / OBSERVATIONS'),
              h.ul
                .attrs({ tabindex: '0', 'aria-label': 'Bin intervals and counts' })
                .children(
                  ...geometry.bars.map(({ interval, count }) =>
                    h.li(h.span(interval), h.strong(String(count))),
                  ),
                ),
            ),
          h.p
            .class('histogram-preview-caption')
            .children(
              'The same 40 observations, grouped differently. The interval list shows counts; the Y-axis rescales to the largest bin.',
            ),
        ),
        h.div.class('histogram-controls').children(
          h.fieldset(
            h.legend('Dataset'),
            h.div.class('histogram-segmented').children(
              ...(
                [
                  ['spread', 'Spread'],
                  ['clustered', 'Clustered'],
                ] as const
              ).map(([dataset, label]) =>
                h.button
                  .attrs({
                    type: 'button',
                    'aria-pressed': String(model.settings.dataset === dataset),
                  })
                  .on('click', Message.SelectedDataset({ dataset }))
                  .children(label),
              ),
            ),
          ),
          h.div.class('histogram-range').children(
            h.label
              .attr('for', 'histogram-bins')
              .children('Number of bins', h.span(String(model.settings.binCount))),
            h.input
              .attrs({ id: 'histogram-bins', type: 'range', min: '2', max: '20', step: '1' })
              .value(String(model.settings.binCount))
              .on('input', ({ value }) => Message.ChangedBinCount({ value })),
          ),
          h.p
            .class('histogram-preview-caption')
            .children(
              'Intervals include their lower edge. Only the final bin includes its upper edge (100).',
            ),
          h.button
            .class('histogram-reset')
            .attr('type', 'button')
            .on('click', Message.ClickedReset())
            .children('Reset example'),
        ),
      ),
      h.div.class('histogram-source').children(
        h.div.class('histogram-source-toolbar').children(
          h.label.attr('for', 'histogram-source-file').children('Source file'),
          h.select
            .attr('id', 'histogram-source-file')
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
        .class('histogram-export')
        .children(
          h.p.attrs({ role: 'status', 'aria-live': 'polite' }).children(feedback(model)),
          model.templateUrl !== null &&
            h.div
              .class('histogram-export-buttons')
              .children(
                action('Download project', Message.ClickedDownload()),
                action('Open in StackBlitz ↗', Message.ClickedPlayground()),
              ),
        ),
    );
};
