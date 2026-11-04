import type { EdgePathStyle, FlowEdge } from '@opsydyn/foldkit-flow';
import { flowView } from '@opsydyn/foldkit-flow/foldkit';
import type { Document, HtmlBuilder } from 'foldkit/html';

import { supportsForceLayout } from './layout-options';
import { Message } from './message';
import type { Model } from './model';

const edgePathOptions: ReadonlyArray<{ label: string; style: EdgePathStyle | null }> = [
  { label: 'Automatic', style: null },
  { label: 'Straight', style: 'straight' },
  { label: 'Stepped', style: 'stepped' },
  { label: 'Smooth', style: 'smooth' },
];

export function view(model: Model, h: HtmlBuilder<Message>): Document {
  const button = (label: string, message: Message, disabled = false) =>
    h.button(
      [
        h.Type('button'),
        h.Disabled(disabled),
        h.OnClick(message),
        h.Style({ padding: '10px 16px', cursor: 'pointer' }),
      ],
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
            h.button(
              [
                h.Type('button'),
                h.AriaPressed(String(model.editor.snapToGrid)),
                h.Disabled(model.editor.readOnly || model.editor.gesture.type !== 'idle'),
                h.OnClick(Message.ObservedFlowInput({ message: { type: 'GridSnapToggled' } })),
              ],
              ['Snap to grid'],
            ),
            h.button(
              [
                h.Type('button'),
                h.AriaPressed(String(model.editor.snapToAlignment)),
                h.Disabled(model.editor.readOnly || model.editor.gesture.type !== 'idle'),
                h.OnClick(Message.ObservedFlowInput({ message: { type: 'AlignmentSnapToggled' } })),
              ],
              ['Snap to nodes'],
            ),
            button('Arrange with ELK', Message.ClickedArrange({ engine: 'elk' })),
            button(
              'Force layout',
              Message.ClickedArrange({ engine: 'force' }),
              !supportsForceLayout(model.editor.graph),
            ),
            button(
              'Group selection',
              Message.ObservedFlowInput({ message: { type: 'SelectionGrouped' } }),
            ),
            button(
              'Ungroup',
              Message.ObservedFlowInput({ message: { type: 'SelectionUngrouped' } }),
            ),
            button('Copy', Message.ObservedFlowInput({ message: { type: 'CopyPressed' } })),
            button('Paste', Message.ObservedFlowInput({ message: { type: 'PastePressed' } })),
            button(
              'Duplicate',
              Message.ObservedFlowInput({ message: { type: 'DuplicatePressed' } }),
            ),
            button('Undo', Message.ObservedFlowInput({ message: { type: 'UndoPressed' } })),
            button('Redo', Message.ObservedFlowInput({ message: { type: 'RedoPressed' } })),
            button(
              'Delete selected',
              Message.ObservedFlowInput({ message: { type: 'DeletePressed' } }),
            ),
            button('Save', Message.ClickedSave()),
            button('Load saved', Message.ClickedLoad()),
            button('Export JSON', Message.ClickedExport()),
            h.label(
              [],
              [
                'Import JSON',
                h.input([
                  h.Key(`import-${model.importing?.id ?? 'ready'}`),
                  h.Type('file'),
                  h.Accept('.json,application/json'),
                  h.OnFileChange((files) => Message.ChoseImportFiles({ files })),
                  h.AriaDescribedBy('flow-import-help'),
                ]),
              ],
            ),
          ],
        ),
        h.p([h.Id('flow-import-help')], ['Importing JSON replaces the current diagram.']),
        ...(selectedEdge
          ? [
              h.div(
                [h.Role('group'), h.AriaLabel('Selected connection')],
                [
                  endpointSelect(selectedEdge, 'source'),
                  endpointSelect(selectedEdge, 'target'),
                  h.label(
                    [],
                    [
                      'Edge path',
                      h.select(
                        [
                          h.AriaLabel('Edge path'),
                          h.Disabled(model.editor.readOnly),
                          h.OnChange((value) =>
                            Message.ObservedFlowInput({
                              message: {
                                type: 'EdgePathStyleChanged',
                                id: selectedEdge.id,
                                pathStyle:
                                  edgePathOptions.find(({ style }) => style === value)?.style ??
                                  null,
                              },
                            }),
                          ),
                        ],
                        edgePathOptions.map(({ label, style }) =>
                          h.option(
                            [
                              h.Value(style ?? 'auto'),
                              h.Selected((selectedEdge.pathStyle ?? null) === style),
                            ],
                            [label],
                          ),
                        ),
                      ),
                    ],
                  ),
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
          edgeToolbar: true,
          contextActions: true,
          autoPan: true,
          pinchZoom: true,
          resizeHandles: true,
          minimap: true,
          viewportControls: true,
          selectionModeControl: true,
          label: 'Workflow editor',
          onEvent: (message) => Message.ObservedFlowInput({ message }),
          edgeAppearance: (edge) =>
            edge.data === 'dashed' ? { dashArray: '9 5', strokeWidth: 4 } : {},
          renderEdge: ({ edge, path, stroke, dashArray, markerEnd }, builder) =>
            edge.id === 'storage-application'
              ? builder.g(
                  [builder.DataAttribute('storage-dependency', '')],
                  [
                    builder.path(
                      [
                        builder.D(path),
                        builder.Fill('none'),
                        builder.Stroke(stroke),
                        builder.StrokeWidth('6'),
                        builder.StrokeDasharray(dashArray),
                        builder.MarkerEnd(markerEnd),
                      ],
                      [],
                    ),
                    builder.path(
                      [
                        builder.D(path),
                        builder.Fill('none'),
                        builder.Stroke('var(--flow-background, #eef2f6)'),
                        builder.StrokeWidth('1.5'),
                        builder.StrokeDasharray(dashArray),
                      ],
                      [],
                    ),
                  ],
                )
              : undefined,
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
