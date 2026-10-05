import type { Document, HtmlBuilder } from 'foldkit/html';

import { EmbedDatasetEditor } from './editor-mount';
import { Message } from './message';
import { Editor, EditorStatus, Status } from './model';
import type { Model } from './model';

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Dataset explorer — Foldkit Viz',
  body: h.div(
    [h.Class('dataset-launcher')],
    [
      h.div(
        [h.Class('dataset-actions')],
        [
          h.button(
            [
              h.Type('button'),
              h.Class('button button-primary'),
              h.OnClick(Message.ClickedEditor()),
            ],
            ['Edit live'],
          ),
          h.button(
            [
              h.Type('button'),
              h.Class('button button-secondary'),
              h.Disabled(model.status._tag === 'Pending'),
              h.OnClick(Message.ClickedPlayground()),
            ],
            ['Open in StackBlitz ↗'],
          ),
          h.a(
            [
              h.Class('button button-secondary'),
              h.Href('/downloads/dataset-explorer.zip'),
              h.Attribute('download', 'foldkit-viz-dataset-explorer.zip'),
            ],
            ['Download standalone project ↓'],
          ),
        ],
      ),
      ...Editor.match(model.editor, {
        Idle: () => [],
        Session: (session) => [
          h.section(
            [
              h.Class('dataset-editor'),
              h.AriaLabel('Live code editor'),
              h.Hidden(!model.editorVisible),
            ],
            [
              h.div(
                [h.Class('dataset-editor-heading')],
                [
                  h.h2([], ['Change the code. See the chart.']),
                  h.div(
                    [h.Class('dataset-actions')],
                    [
                      h.button(
                        [
                          h.Type('button'),
                          h.Class('button button-secondary'),
                          h.Disabled(session.status._tag === 'Loading'),
                          h.OnClick(Message.ClickedRestartEditor()),
                        ],
                        [session.status._tag === 'Failed' ? 'Retry editor' : 'Restart starter'],
                      ),
                      h.button(
                        [
                          h.Type('button'),
                          h.Class('button button-secondary'),
                          h.OnClick(Message.ClickedCloseEditor()),
                        ],
                        ['Close editor'],
                      ),
                    ],
                  ),
                ],
              ),
              h.p(
                [h.Class('small-note')],
                [
                  'Edit chart.ts for curves, colours and layers, or open the dataset JSON files to change observations. The preview updates as you edit.',
                ],
              ),
              h.p(
                [h.Class('small-note')],
                [
                  'Closing preserves edits in this page. Restart replaces them with the starter. Use the editor’s StackBlitz tools to save or download your edits; the download above contains the original starter.',
                ],
              ),
              h.p(
                [h.Class('small-note'), h.Role('status'), h.AriaLive('polite')],
                [
                  EditorStatus.match(session.status, {
                    Loading: () => 'Loading the editor… The first start may take a minute.',
                    Ready: () => 'Editor connected. The preview starts after dependencies install.',
                    Failed: ({ error }) => error,
                  }),
                ],
              ),
              h.div(
                [
                  h.Key('dataset-editor-' + session.revision),
                  h.Class('dataset-editor-host'),
                  h.Hidden(session.status._tag === 'Failed'),
                  h.OnMount(
                    EmbedDatasetEditor({
                      templateUrl: model.templateUrl,
                      revision: session.revision,
                    }),
                  ),
                ],
                [],
              ),
            ],
          ),
        ],
      }),
      h.p(
        [h.Class('small-note'), h.Role('status'), h.AriaLive('polite')],
        [
          Status.match(model.status, {
            Ready: () =>
              'Edit in your browser, or download the Vite starter to run with npm or Bun. All three datasets and native FoldKit source are included.',
            Pending: () => 'Preparing the project…',
            Opened: () => 'Opening StackBlitz…',
            Failed: ({ error }) => error,
          }),
        ],
      ),
    ],
  ),
});
