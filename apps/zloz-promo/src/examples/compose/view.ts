import { Mount } from '@effect/ui';
import { Html } from '@effect/ui/html';
import {
  portBoundaryPosition,
  resolveConnectionCreation,
  resolveConnectionPreview,
  resolveEdgeGeometry,
  type EditorState,
  type ZlozConnectionCreationFieldContext,
  type ZlozEdge,
  type ZlozNode,
} from '@opsydyn/foldkit-zloz';
import { surfaceInput } from '@opsydyn/foldkit-zloz/effect-ui';

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

const svg = (tag: string) => new Html.Element<Message>(tag);

function nodeView(h: Html.H<Message>, editor: EditorState, node: ZlozNode) {
  const selected = editor.selectedNodes.includes(node.id);
  return h.div
    .key(node.id)
    .class('compose-node')
    .attr('data-flow-node', node.id)
    .style({
      left: `${node.position.x}px`,
      top: `${node.position.y}px`,
      width: `${node.size.width}px`,
      height: `${node.size.height}px`,
    })
    .children(
      h.button
        .class('compose-node-title')
        .attr('type', 'button')
        .attr('data-flow-handle', node.id)
        .attr('aria-label', `Select ${node.label}`)
        .attr('aria-pressed', String(selected))
        .children(node.label),
      h.p.class('compose-node-note').children(captions.get(node.id) ?? 'A step in your workflow.'),
      ...node.ports.map((port) => {
        const point = portBoundaryPosition(node, port.id);
        const active = editor.connection?.node === node.id && editor.connection.port === port.id;
        return h.button
          .key(port.id)
          .class('compose-port')
          .attr('type', 'button')
          .attr('data-flow-owner', node.id)
          .attr('data-flow-port', port.id)
          .attr('data-flow-port-kind', port.kind)
          .attr(
            'aria-label',
            `Connect ${port.kind === 'output' ? 'from' : 'to'} ${node.label}: ${port.label ?? port.id}`,
          )
          .attr('aria-pressed', String(active))
          .style({
            left: `${point.x - node.position.x}px`,
            top: `${point.y - node.position.y}px`,
          })
          .children();
      }),
    );
}

function canvas(h: Html.H<Message>, editor: EditorState) {
  const preview = resolveConnectionPreview(editor);
  const paths = editor.graph.edges.map((edge) => {
    const { path } = resolveEdgeGeometry(editor.graph, edge);
    return svg('path')
      .key(edge.id)
      .class('compose-edge')
      .attr('d', path)
      .attr('data-flow-edge', edge.id)
      .attr('data-selected', String(editor.selectedEdges.includes(edge.id)))
      .attr('marker-end', 'url(#promo-compose-arrow)')
      .children();
  });
  return h.div.class('compose-canvas').children(
    h.p
      .id('promo-compose-help')
      .class('compose-help')
      .children(
        'Select nodes by their titles. Use the arrow keys to move a selected node or the canvas.',
      ),
    h.div
      .class('compose-surface')
      .attr('role', 'region')
      .attr('aria-label', 'Interactive Compose workflow')
      .attr('aria-describedby', 'promo-compose-help')
      .attr('tabindex', '0')
      .attr('data-flow-surface', 'promo-compose')
      .attr('data-flow-wheel-navigation', 'off')
      .attr('data-flow-pinch-zoom', 'true')
      .onMount(Mount.map(surfaceInput(), (event) => observe(decodeBrowserInput(event))))
      .children(
        h.div
          .class('compose-world')
          .style({
            transform: `translate(${editor.viewport.x}px, ${editor.viewport.y}px) scale(${editor.viewport.zoom})`,
          })
          .children(
            svg('svg')
              .class('compose-edges')
              .attr('aria-hidden', 'true')
              .children(
                svg('defs').children(
                  svg('marker')
                    .id('promo-compose-arrow')
                    .attr('viewBox', '0 0 10 10')
                    .attr('refX', '9')
                    .attr('refY', '5')
                    .attr('markerWidth', '6')
                    .attr('markerHeight', '6')
                    .attr('orient', 'auto')
                    .children(svg('path').attr('d', 'M 0 0 L 10 5 L 0 10 Z').children()),
                ),
                ...paths,
                ...(preview
                  ? [
                      svg('path')
                        .key('preview')
                        .class('compose-preview')
                        .attr('d', preview.path)
                        .children(),
                    ]
                  : []),
              ),
            ...editor.graph.nodes.map((node) => nodeView(h, editor, node)),
          ),
      ),
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
