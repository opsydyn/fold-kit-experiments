import {
  flowView,
  flowConnectionCreationField,
  flowConnectionCreationCancel,
  type FlowTheme,
} from '@opsydyn/foldkit-flow/foldkit';
import type { Document, HtmlBuilder } from 'foldkit/html';

import { observe, type Message, type Model } from './state';

/** Host CSS variables keep the island in the page theme without replacing its Model. */
const theme: FlowTheme = {
  tokens: {
    background: 'var(--page)',
    canvasBorder: 'var(--border)',
    gridLine: 'var(--border)',
    gridDot: 'var(--border)',
    nodeBackground: 'var(--surface)',
    nodeColor: 'var(--text)',
    nodeBorder: 'var(--muted)',
    nodeRadius: '8px',
    edge: 'var(--muted)',
    selection: 'var(--blue)',
    outputPort: 'var(--blue)',
    inputPort: 'var(--coral)',
    portBorder: 'var(--surface)',
    validTarget: 'var(--blue)',
    invalidTarget: 'var(--coral)',
    selectionBackground: 'color-mix(in srgb, var(--blue) 12%, transparent)',
  },
};

function caption(id: string): string {
  switch (id) {
    case 'draft':
      return 'Shape the idea.';
    case 'review':
      return 'Make it ready.';
    case 'publish':
      return 'Share the outcome.';
    default:
      return 'A step in your workflow.';
  }
}

export function view(model: Model, h: HtmlBuilder<Message>): Document {
  const { editor } = model;
  const selectedNodes = editor.graph.nodes
    .filter((node) => editor.selectedNodes.includes(node.id))
    .map((node) => node.label);
  const selectedEdges = editor.graph.edges
    .filter((edge) => editor.selectedEdges.includes(edge.id))
    .map(
      (edge) =>
        edge.label ??
        `${editor.graph.nodes.find((node) => node.id === edge.source.node)?.label ?? edge.source.node} → ${editor.graph.nodes.find((node) => node.id === edge.target.node)?.label ?? edge.target.node}`,
    );
  const selected = [...selectedNodes, ...selectedEdges];
  const action = (
    label: string,
    type: 'UndoPressed' | 'RedoPressed' | 'FitViewClicked',
    disabled: boolean,
  ) =>
    h.button(
      [
        h.Class('compose-button'),
        h.Type('button'),
        h.Disabled(disabled),
        h.OnClick(observe({ type })),
      ],
      [label],
    );
  return {
    title: 'Compose — Foldkit Zloz',
    body: h.div(
      [h.Class('compose-example')],
      [
        h.div(
          [h.Class('compose-toolbar')],
          [
            h.p([h.AriaLabel('Current selection')], [`Selected: ${selected.join(', ') || 'None'}`]),
            h.div(
              [h.Role('group'), h.AriaLabel('Workflow history'), h.Class('compose-actions')],
              [
                action('Undo', 'UndoPressed', editor.past.length === 0),
                action('Redo', 'RedoPressed', editor.future.length === 0),
                action('Fit view', 'FitViewClicked', editor.surface === null),
              ],
            ),
          ],
        ),
        flowView(h, editor, {
          id: 'promo-compose',
          label: 'Interactive Compose workflow',
          onEvent: observe,
          theme,
          height: 420,
          minimalMode: true,
          resizeHandles: false,
          viewportControls: false,
          wheelNavigation: 'off',
          pinchZoom: true,
          connectionCreation: true,
          renderNode: (node, builder) =>
            builder.p([builder.Class('compose-node-note')], [caption(node.id)]),
          renderConnectionCreation: (context, builder) =>
            builder.div(
              [
                builder.Class('compose-chooser'),
                builder.Role('group'),
                builder.AriaLabel('Create a connection'),
              ],
              [
                builder.h3([], ['Connect the next step.']),
                builder.p(
                  [],
                  [
                    'Choose Review’s output, then Publish’s input. You can also drag between the ports or activate them in order.',
                  ],
                ),
                flowConnectionCreationField(builder, context.source, observe, {
                  idPrefix: 'promo-compose-chooser',
                }),
                flowConnectionCreationField(builder, context.target, observe, {
                  idPrefix: 'promo-compose-chooser',
                }),
                flowConnectionCreationCancel(builder, context, observe, [
                  builder.Class('compose-button'),
                ]),
              ],
            ),
          renderLayout: (parts, builder) =>
            builder.div(
              [builder.Class('compose-layout')],
              [
                builder.div(
                  [builder.Class('compose-canvas')],
                  [parts.help, parts.canvas, parts.status],
                ),
                builder.div(
                  [builder.Class('compose-sidebar')],
                  [
                    ...(parts.creation ? [parts.creation] : []),
                    builder.div([builder.Class('compose-links')], [parts.connections]),
                  ],
                ),
              ],
            ),
        }),
        h.p(
          [h.Class('compose-notice')],
          [
            editor.notice ??
              'Select a node by its title. Connect Review to Publish, then try Undo.',
          ],
        ),
      ],
    ),
  };
}
