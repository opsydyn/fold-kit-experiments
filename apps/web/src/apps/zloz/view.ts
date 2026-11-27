import type { Html } from '@effect/ui/html';
import { BrowserInput, graphSurface } from '@opsydyn/foldkit-zloz/effect-ui';
import { Schema } from 'effect';

import { Message } from './message';
import type { Model } from './model';

const decodeBrowserInput = Schema.decodeUnknownSync(BrowserInput);

export function view(h: Html.H<Message>, model: Model) {
  const button = (label: string, message: Message) =>
    h.button
      .attr('type', 'button')
      .on('click', message)
      .style({ padding: '10px 16px', cursor: 'pointer' })
      .children(label);

  return h.div(
    h.p(
      'Connect a source to a review, edit the labels and arrange the graph. Save stores a graph in this browser.',
    ),
    h.div
      .attr('role', 'group')
      .attr('aria-label', 'Graph actions')
      .style({ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' })
      .children(
        button('Add node', Message.ClickedAdd()),
        button('Arrange with ELK', Message.ClickedArrange()),
        button('Fit view', Message.ClickedFit()),
        button('Undo', Message.ClickedUndo()),
        button('Redo', Message.ClickedRedo()),
        button('Delete selected', Message.ClickedDelete()),
        button('Save', Message.ClickedSave()),
        button('Load saved', Message.ClickedLoad()),
      ),
    graphSurface(h, model.editor, {
      id: 'flow-demo',
      label: 'Workflow editor',
      onInput: (event) => Message.ObservedBrowserInput({ event: decodeBrowserInput(event) }),
      renderNodeShell: ({ node }, builder) => ({
        body: builder.input
          .attr('aria-label', `Label for ${node.id}`)
          .attr('value', node.label)
          .on('input', ({ value }) => Message.ChangedNodeLabel({ id: node.id, label: value }))
          .style({ width: '100%', boxSizing: 'border-box', marginTop: '8px', minHeight: '30px' }),
      }),
    }),
    h.p.attr('role', 'status').attr('aria-live', 'polite').children(model.notice),
  );
}
