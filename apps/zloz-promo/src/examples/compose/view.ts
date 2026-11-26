import { Html } from '@effect/ui/html';
import {
  resolveConnectionCreation,
  type EditorState,
  type ZlozConnectionCreationFieldContext,
  type ZlozEdge,
} from '@opsydyn/foldkit-zloz';
import { graphSurface } from '@opsydyn/foldkit-zloz/effect-ui';

import { decodeBrowserInput, observe, type ComposeEvent, type Message, type Model } from './state';

const captions = new Map([
  ['draft', 'Shape the idea.'],
  ['review', 'Make it ready.'],
  ['publish', 'Share the outcome.'],
]);

const edgeLabel = (editor: EditorState, edge: ZlozEdge) => {
  const label = (id: string) => editor.graph.nodes.find((node) => node.id === id)?.label ?? id;
  return edge.label ?? `${label(edge.source.node)} → ${label(edge.target.node)}`;
};

function canvas(h: Html.H<Message>, editor: EditorState) {
  return h.div.class('compose-canvas').children(
    h.p
      .id('promo-compose-help')
      .class('compose-help')
      .children(
        'Select nodes by their titles. Use the arrow keys to move a selected node or the canvas.',
      ),
    graphSurface(h, editor, {
      id: 'promo-compose',
      label: 'Interactive Compose workflow',
      descriptionId: 'promo-compose-help',
      onInput: (event) => observe(decodeBrowserInput(event)),
      nodeNote: (node) => captions.get(node.id) ?? 'A step in your workflow.',
    }),
  );
}

function creationField(h: Html.H<Message>, field: ZlozConnectionCreationFieldContext) {
  const id = `promo-compose-${field.end}`;
  const hint = field.reason ?? field.hint;
  return h.div(
    h.label.attr('for', id).children(field.label),
    h.select
      .id(id)
      .attr('aria-describedby', hint ? `${id}-hint` : undefined)
      .on('keydown', ({ key }) => (key === 'Escape' ? observe(field.cancel.event) : undefined))
      .on('change', ({ value }) => {
        const entry = field.entries.find(
          (choice) => choice.value === value && choice.reason === null,
        );
        return entry ? observe(entry.event) : undefined;
      })
      .children(
        h.option
          .attr('value', '')
          .selected(field.value === '')
          .disabled(true)
          .children(field.placeholder),
        ...field.entries.map((entry) =>
          h.option
            .key(entry.value)
            .attr('value', entry.value)
            .selected(entry.current)
            .disabled(entry.reason !== null)
            .children(entry.label),
        ),
      ),
    ...(hint ? [h.p.id(`${id}-hint`).children(hint)] : []),
  );
}

export function view(h: Html.H<Message>, { editor }: Model) {
  const selected = [
    ...editor.graph.nodes
      .filter((node) => editor.selectedNodes.includes(node.id))
      .map(({ label }) => label),
    ...editor.graph.edges
      .filter((edge) => editor.selectedEdges.includes(edge.id))
      .map((edge) => edgeLabel(editor, edge)),
  ];
  const action = (label: string, event: ComposeEvent, disabled: boolean) =>
    h.button
      .class('compose-button')
      .attr('type', 'button')
      .disabled(disabled)
      .on('click', observe(event))
      .children(label);

  const creation = resolveConnectionCreation(editor);
  return h.div.class('compose-example').children(
    h.div.class('compose-toolbar').children(
      h.p
        .attr('aria-label', 'Current selection')
        .children(`Selected: ${selected.join(', ') || 'None'}`),
      h.div
        .class('compose-actions')
        .attr('role', 'group')
        .attr('aria-label', 'Workflow history')
        .children(
          action('Undo', { type: 'UndoPressed' }, editor.past.length === 0),
          action('Redo', { type: 'RedoPressed' }, editor.future.length === 0),
          action('Fit view', { type: 'FitViewClicked' }, editor.surface === null),
        ),
    ),
    h.div.class('compose-layout').children(
      canvas(h, editor),
      h.div.class('compose-sidebar').children(
        h.div
          .class('compose-chooser')
          .attr('role', 'group')
          .attr('aria-label', 'Create a connection')
          .children(
            h.h3('Connect the next step.'),
            h.p(
              'Choose Review’s output, then Publish’s input. You can also drag between the ports or activate them in order.',
            ),
            creationField(h, creation.source),
            creationField(h, creation.target),
            action('Cancel connection', creation.cancel.event, creation.cancel.reason !== null),
          ),
        h.div.class('compose-links').children(
          h.button
            .attr('type', 'button')
            .attr('aria-expanded', String(editor.connectionsExpanded))
            .attr('aria-controls', 'promo-compose-links')
            .on('click', observe({ type: 'ConnectionListToggled' }))
            .children('Connections'),
          h.div
            .id('promo-compose-links')
            .attr('role', 'group')
            .attr('aria-label', 'Connections')
            .attr('hidden', editor.connectionsExpanded ? undefined : '')
            .children(
              ...editor.graph.edges.map((edge) =>
                h.button
                  .key(edge.id)
                  .attr('type', 'button')
                  .attr('aria-pressed', String(editor.selectedEdges.includes(edge.id)))
                  .on('click', observe({ type: 'EdgeSelected', id: edge.id, additive: false }))
                  .children(edgeLabel(editor, edge)),
              ),
            ),
        ),
      ),
    ),
    h.p
      .class('compose-notice')
      .attr('role', 'status')
      .children(
        editor.notice ?? 'Select a node by its title. Connect Review to Publish, then try Undo.',
      ),
  );
}
