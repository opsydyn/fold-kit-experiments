import { Mount } from '@effect/ui';
import type { Html } from '@effect/ui/html';

import { EmbedDatasetEditor } from './editor-mount';
import { Message } from './message';
import { Editor, EditorStatus, Status, type Model } from './model';

export const view = (h: Html.H<Message>, model: Model) => {
  const action = (label: string, message: Message, disabled = false) =>
    h.button
      .class('button button-secondary')
      .attr('type', 'button')
      .disabled(disabled)
      .on('click', message)
      .children(label);
  const status = (text: string) =>
    h.p.class('small-note').attrs({ role: 'status', 'aria-live': 'polite' }).children(text);
  const editor = Editor.match(model.editor, {
    Idle: () => undefined,
    Session: ({ revision, status: editorStatus }) =>
      h.section
        .class('dataset-editor')
        .attrs({
          'aria-label': 'Live code editor',
          hidden: model.editorVisible ? undefined : '',
        })
        .children(
          h.div
            .class('dataset-editor-heading')
            .children(
              h.h2('Change the code. See the chart.'),
              h.div
                .class('dataset-actions')
                .children(
                  action(
                    EditorStatus.is('Failed')(editorStatus) ? 'Retry editor' : 'Restart starter',
                    Message.ClickedRestartEditor(),
                    EditorStatus.is('Loading')(editorStatus),
                  ),
                  action('Close editor', Message.ClickedCloseEditor()),
                ),
            ),
          h.p
            .class('small-note')
            .children(
              'Edit chart.ts for curves, colours and layers, or open the dataset JSON files to change observations. The preview updates as you edit.',
            ),
          h.p
            .class('small-note')
            .children(
              'Closing preserves edits in this page. Restart replaces them with the starter. Use the editor’s StackBlitz tools to save or download your edits; the download above contains the original starter.',
            ),
          status(
            EditorStatus.match(editorStatus, {
              Loading: () => 'Loading the editor… The first start may take a minute.',
              Ready: () => 'Editor connected. The preview starts after dependencies install.',
              Failed: ({ error }) => error,
            }),
          ),
          h.div
            .key('dataset-editor-' + revision)
            .class('dataset-editor-host')
            .attr('hidden', EditorStatus.is('Failed')(editorStatus) ? '' : undefined)
            .onMount(
              Mount.map(
                EmbedDatasetEditor({ templateUrl: model.templateUrl, revision }),
                (message) => message,
              ),
            )
            .children(),
        ),
  });

  return h.div.class('dataset-launcher').children(
    h.div.class('dataset-actions').children(
      model.embeddedEditor &&
        h.button
          .class('button button-primary')
          .attr('type', 'button')
          .on('click', Message.ClickedEditor())
          .children('Edit live'),
      action(
        'Open in StackBlitz ↗',
        Message.ClickedPlayground(),
        Status.is('Pending')(model.status),
      ),
      h.a
        .class('button button-secondary')
        .attrs({
          href: model.downloadUrl,
          download: 'foldkit-viz-dataset-explorer.zip',
        })
        .children('Download standalone project ↓'),
    ),
    editor,
    status(
      Status.match(model.status, {
        Ready: () =>
          'Open StackBlitz to edit the code, or download the Vite starter to run with npm or Bun. All three datasets and the maintained Effect UI source are included.',
        Pending: () => 'Preparing the project…',
        Opened: () => 'Opening StackBlitz…',
        Failed: ({ error }) => error,
      }),
    ),
  );
};
