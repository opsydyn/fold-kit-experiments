import type { FlowEdge } from '@opsydyn/foldkit-flow';
import { flowView } from '@opsydyn/foldkit-flow/foldkit';
import type { Document, HtmlBuilder } from 'foldkit/html';

import { Message } from './message';
import type { Model } from './model';

export function view(model: Model, h: HtmlBuilder<Message>): Document {
  const button = (label: string, message: Message) =>
    h.button(
      [h.Type('button'), h.OnClick(message), h.Style({ padding: '10px 16px', cursor: 'pointer' })],
      [label],
    );
  const selectedEdge = model.editor.graph.edges.find((edge) =>
    model.editor.selectedEdges.includes(edge.id),
  );
  const endpointSelect = (edge: FlowEdge, end: 'source' | 'target') => {
    const kind = end === 'source' ? 'output' : 'input';
    const label = end === 'source' ? 'Source port' : 'Target port';
    const ports = model.editor.graph.nodes.flatMap((node) =>
      node.ports
        .filter((port) => port.kind === kind)
        .map((port) => ({
          endpoint: { node: node.id, port: port.id },
          label: `${node.label}: ${port.label ?? port.id}`,
        })),
    );
    return h.label(
      [],
      [
        label,
        h.select(
          [
            h.AriaLabel(label),
            h.Disabled(model.editor.readOnly),
            h.OnChange((value) =>
              Message.ObservedFlowInput({
                message: {
                  type: 'EdgeReconnected',
                  id: edge.id,
                  end,
                  endpoint: ports[Number(value)]?.endpoint ?? edge[end],
                },
              }),
            ),
          ],
          ports.map(({ endpoint, label }, index) =>
            h.option(
              [
                h.Value(String(index)),
                h.Disabled(
                  model.editor.graph.edges.some(
                    (other) =>
                      other.id !== edge.id &&
                      other[end].node === endpoint.node &&
                      other[end].port === endpoint.port &&
                      (end === 'source'
                        ? other.target.node === edge.target.node &&
                          other.target.port === edge.target.port
                        : other.source.node === edge.source.node &&
                          other.source.port === edge.source.port),
                  ),
                ),
                h.Selected(edge[end].node === endpoint.node && edge[end].port === endpoint.port),
              ],
              [label],
            ),
          ),
        ),
      ],
    );
  };
  return {
    title: 'Workflow patterns | FoldKit Flow',
    body: h.div(
      [],
      [
        h.p(
          [],
          [
            'Open an example to replace the current diagram. Shift-drag the canvas background or Shift-click node titles to select several. Save keeps a copy in this browser.',
          ],
        ),
        h.div(
          [
            h.Role('group'),
            h.AriaLabel('Examples'),
            h.Style({ display: 'flex', gap: '8px', 'flex-wrap': 'wrap' }),
          ],
          [
            button('Open release workflow', Message.SelectedExample({ example: 'release' })),
            button('Open Onion Architecture', Message.SelectedExample({ example: 'onion' })),
            button(
              'Open grouped Onion Architecture',
              Message.SelectedExample({ example: 'grouped-onion' }),
            ),
          ],
        ),
        h.p([], ['In Onion Architecture, arrows show source dependencies toward the domain.']),
        h.div(
          [
            h.Role('group'),
            h.AriaLabel('Graph actions'),
            h.Style({ display: 'flex', gap: '8px', 'flex-wrap': 'wrap', 'margin-bottom': '12px' }),
          ],
          [
            button('Add node', Message.ClickedAdd()),
            button('Arrange with ELK', Message.ClickedArrange()),
            button(
              'Group selection',
              Message.ObservedFlowInput({ message: { type: 'SelectionGrouped' } }),
            ),
            button(
              'Ungroup',
              Message.ObservedFlowInput({ message: { type: 'SelectionUngrouped' } }),
            ),
            button('Undo', Message.ObservedFlowInput({ message: { type: 'UndoPressed' } })),
            button('Redo', Message.ObservedFlowInput({ message: { type: 'RedoPressed' } })),
            button(
              'Delete selected',
              Message.ObservedFlowInput({ message: { type: 'DeletePressed' } }),
            ),
            button('Save', Message.ClickedSave()),
            button('Load saved', Message.ClickedLoad()),
          ],
        ),
        ...(selectedEdge
          ? [
              h.div(
                [h.Role('group'), h.AriaLabel('Selected connection')],
                [
                  endpointSelect(selectedEdge, 'source'),
                  endpointSelect(selectedEdge, 'target'),
                  button(
                    'Solid edge',
                    Message.ObservedFlowInput({
                      message: { type: 'EdgeDataChanged', id: selectedEdge.id, data: 'solid' },
                    }),
                  ),
                  button(
                    'Dashed edge',
                    Message.ObservedFlowInput({
                      message: { type: 'EdgeDataChanged', id: selectedEdge.id, data: 'dashed' },
                    }),
                  ),
                ],
              ),
            ]
          : []),
        flowView(h, model.editor, {
          id: 'flow-demo',
          themeClassName: 'release-flow-theme',
          resizeHandles: true,
          minimap: true,
          viewportControls: true,
          label: 'Workflow editor',
          onEvent: (message) => Message.ObservedFlowInput({ message }),
          edgeAppearance: (edge) =>
            edge.data === 'dashed' ? { dashArray: '9 5', strokeWidth: 4 } : {},
          renderNode: (node, builder) =>
            builder.div(
              [],
              [
                builder.input([
                  builder.AriaLabel(`Label for ${node.id}`),
                  builder.Value(node.label),
                  builder.OnInput((label) =>
                    Message.ObservedFlowInput({
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
                builder.label(
                  [],
                  [
                    'Width',
                    builder.input([
                      builder.Type('range'),
                      builder.AriaLabel(`Width for ${node.label}`),
                      builder.Min('140'),
                      builder.Max('320'),
                      builder.Step('10'),
                      builder.Value(String(node.size.width)),
                      builder.Style({ width: '100%', 'touch-action': 'pan-x' }),
                      builder.OnChange((value) =>
                        Message.ObservedFlowInput({
                          message: { type: 'NodeWidthChanged', id: node.id, width: Number(value) },
                        }),
                      ),
                    ]),
                  ],
                ),
              ],
            ),
        }),
        h.p([h.Role('status'), h.AriaLive('polite')], [model.notice]),
      ],
    ),
  };
}
