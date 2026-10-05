import type { Document, HtmlBuilder } from 'foldkit/html';

import { Message } from './message';
import { Status } from './model';
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
