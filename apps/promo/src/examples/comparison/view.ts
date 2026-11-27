import '@opsydyn/dataset-explorer/highlighting.css';
import { Mount } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { highlightedCode, sourceLineChanges } from '@opsydyn/dataset-explorer/source-ui';
import { Stream } from 'effect';

import { workbenchView } from '../../../../web/src/apps/comparison/workbench-view';
import { Message } from './message';
import { ActionStatus, type Model } from './model';
import { currentSource } from './update';

import './comparison-host.css';

const ObserveSource = Mount.makeStream(
  'ObserveComparisonSource',
  { args: {} },
  (element: HTMLElement) =>
    Stream.concat(
      Stream.make(Message.MountedSourceViewer()),
      Stream.map(sourceLineChanges(element), Message.NavigatedSourceLine),
    ),
);

const feedback = (model: Model): string =>
  ActionStatus.match(model.actionStatus, {
    Ready: () => '',
    Pending: () => 'Preparing...',
    Succeeded: ({ action }) =>
      ({
        copy: 'File copied.',
        download: 'Project downloaded.',
        playground: 'Opening StackBlitz...',
      })[action],
    Failed: ({ error }) => error,
  });

export function view(h: Html.H<Message>, model: Model) {
  const pending = model.actionStatus._tag === 'Pending';
  return h.div
    .class('comparison-host')
    .onMount(Mount.map(ObserveSource(), (message) => message))
    .children(
      workbenchView(h, model.workbench, (message) => Message.ReceivedWorkbenchMessage({ message })),
      h.div.class('comparison-source').children(
        h.div.class('comparison-source-toolbar').children(
          h.label.attr('for', 'comparison-source-file').children('Source file'),
          h.select
            .id('comparison-source-file')
            .value(model.activeFile)
            .on('change', ({ value: name }) => Message.SelectedFile({ name }))
            .children(
              ...model.sources.map(({ name }) => h.option.attr('value', name).children(name)),
            ),
          h.button
            .attr('type', 'button')
            .disabled(pending || model.sources.length === 0)
            .on('click', Message.ClickedCopy())
            .children('Copy file'),
        ),
        h.pre
          .class('syntax-highlight')
          .attrs({ tabindex: '0', 'aria-label': model.activeFile + ' source code' })
          .children(
            h.code.children(
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
        .class('comparison-export')
        .children(
          h.p.attrs({ role: 'status', 'aria-live': 'polite' }).children(feedback(model)),
          model.templateUrl === null
            ? undefined
            : [
                h.button
                  .attr('type', 'button')
                  .disabled(pending)
                  .on('click', Message.ClickedDownload())
                  .children('Download project'),
                h.button
                  .attr('type', 'button')
                  .disabled(pending)
                  .on('click', Message.ClickedPlayground())
                  .children('Open in StackBlitz'),
              ],
        ),
    );
}
