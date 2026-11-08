import { zlozView } from '@opsydyn/foldkit-zloz/foldkit';
import type { Document, HtmlBuilder } from 'foldkit/html';

import { Message } from './message';
import type { Model } from './model';

export function view(model: Model, h: HtmlBuilder<Message>): Document {
  const button = (label: string, message: Message) =>
    h.button(
      [h.Type('button'), h.OnClick(message), h.Style({ padding: '10px 16px', cursor: 'pointer' })],
      [label],
    );
  return {
    title: 'Foldkit Zloz',
    body: h.div(
      [],
      [
        h.p(
          [],
          [
            'Connect a source to a review, edit the labels and arrange the graph. Changes stay in this example’s Model; Save stores a graph in this browser.',
          ],
        ),
        h.div(
          [
            h.Role('group'),
            h.AriaLabel('Graph actions'),
            h.Style({ display: 'flex', gap: '8px', 'flex-wrap': 'wrap', 'margin-bottom': '12px' }),
          ],
          [
            button('Add node', Message.ClickedAdd()),
            button('Arrange with ELK', Message.ClickedArrange()),
            button('Fit view', Message.ClickedFit()),
            button('Undo', Message.ObservedZlozInput({ message: { type: 'UndoPressed' } })),
            button('Redo', Message.ObservedZlozInput({ message: { type: 'RedoPressed' } })),
            button(
              'Delete selected',
              Message.ObservedZlozInput({ message: { type: 'DeletePressed' } }),
            ),
            button('Save', Message.ClickedSave()),
            button('Load saved', Message.ClickedLoad()),
          ],
        ),
        zlozView(h, model.editor, {
          id: 'flow-demo',
          label: 'Workflow editor',
          onEvent: (message) => Message.ObservedZlozInput({ message }),
          renderNode: (node, builder) =>
            builder.input([
              builder.AriaLabel(`Label for ${node.id}`),
              builder.Value(node.label),
              builder.OnInput((label) =>
                Message.ObservedZlozInput({
                  message: { type: 'NodeLabelChanged', id: node.id, label },
                }),
              ),
              builder.Style({
                width: '100%',
                'box-sizing': 'border-box',
                'margin-top': '8px',
                'min-height': '30px',
              }),
            ]),
        }),
        h.p([h.Role('status'), h.AriaLive('polite')], [model.notice]),
      ],
    ),
  };
}
