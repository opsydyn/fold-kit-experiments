import '@opsydyn/dataset-explorer/highlighting.css';
import { highlightedCode } from '@opsydyn/dataset-explorer/highlighting';
import type { Document, HtmlBuilder } from 'foldkit/html';
import { defineView } from 'foldkit/submodel';

import type * as Comparison from '../../../../web/src/apps/comparison/main';
import { body } from '../../../../web/src/apps/comparison/view';
import { Message } from './message';
import { ActionStatus } from './model';
import type { Model } from './model';
import { currentSource } from './update';

import './comparison-host.css';

const workbenchView = defineView<Comparison.Model, Comparison.Message>(body);
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

export function view(model: Model, h: HtmlBuilder<Message>): Document {
  const pending = model.actionStatus._tag === 'Pending';
  return {
    title: 'Chart comparison - Foldkit Viz',
    body: h.div(
      [h.Class('comparison-host')],
      [
        h.submodel({
          slotId: 'workbench',
          model: model.workbench,
          view: workbenchView,
          toParentMessage: (message) => Message.GotWorkbenchMessage({ message }),
        }),
        h.div(
          [h.Class('comparison-source')],
          [
            h.div(
              [h.Class('comparison-source-toolbar')],
              [
                h.label([h.For('comparison-source-file')], ['Source file']),
                h.select(
                  [
                    h.Id('comparison-source-file'),
                    h.Value(model.activeFile),
                    h.OnChange((name) => Message.SelectedFile({ name })),
                  ],
                  model.sources.map(({ name }) => h.option([h.Value(name)], [name])),
                ),
                h.button(
                  [
                    h.Type('button'),
                    h.Disabled(pending || model.sources.length === 0),
                    h.OnClick(Message.ClickedCopy()),
                  ],
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
                  ),
                ),
              ],
            ),
          ],
        ),
        h.div(
          [h.Class('comparison-export')],
          [
            h.p([h.Role('status'), h.AriaLive('polite')], [feedback(model)]),
            ...(model.templateUrl === null
              ? []
              : [
                  h.button(
                    [h.Type('button'), h.Disabled(pending), h.OnClick(Message.ClickedDownload())],
                    ['Download project'],
                  ),
                  h.button(
                    [h.Type('button'), h.Disabled(pending), h.OnClick(Message.ClickedPlayground())],
                    ['Open in StackBlitz'],
                  ),
                ]),
          ],
        ),
      ],
    ),
  };
}
