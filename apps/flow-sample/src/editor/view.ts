import type { EdgePathStyle, FlowEdge } from '@opsydyn/foldkit-flow';
import { supportsForceLayout } from '@opsydyn/foldkit-flow-force/eligibility';
import {
  flowView,
  resolveFlowDiagnostics,
  type FlowBackground,
} from '@opsydyn/foldkit-flow/foldkit';
import { Schema } from 'effect';
import type { Document, HtmlBuilder } from 'foldkit/html';

import { Message } from './message';
import { BackgroundStyle, ConnectionDesign, EdgeDesign, NodeDesign, type Model } from './model';
import { orbitNode, orbitGroup, raisedEdge, raisedConnection } from './presentation';

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
  const diagnostics = resolveFlowDiagnostics({
    minimalMode: model.minimalMode,
    diagnostics: model.diagnosticsEnabled ? model.diagnostics : false,
  });
  const hidden = {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: '0',
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    'white-space': 'nowrap',
    border: '0',
  } as const;
  const diagnosticOptions = [
    ['measurements', 'Measurements'],
    ['alignmentGuides', 'Alignment guides'],
    ['zoomLevel', 'Zoom percentage'],
    ['status', 'Visible status'],
    ['instructions', 'Instructions'],
    ['overview', 'Overview'],
    ['connectionList', 'Connection list'],
  ] as const;
  const background: FlowBackground<Message> =
    model.background === 'custom'
      ? {
          type: 'custom',
          render: ({ viewport, spacing }, builder) => {
            const pitch = spacing * viewport.zoom;
            const position = `${viewport.x}px ${viewport.y}px`;
            return builder.div(
              [
                builder.DataAttribute('custom-flow-grid', 'graph-paper'),
                builder.Style({
                  position: 'absolute',
                  inset: '0',
                  'background-image':
                    'linear-gradient(to right, #94a3b833 1px, transparent 1px), linear-gradient(to bottom, #94a3b833 1px, transparent 1px)',
                  'background-size': `${pitch}px ${pitch}px`,
                  'background-position': position,
                }),
              ],
              [
                builder.div(
                  [
                    builder.Style({
                      position: 'absolute',
                      inset: '0',
                      'background-image':
                        'linear-gradient(to right, #64748b66 1px, transparent 1px), linear-gradient(to bottom, #64748b66 1px, transparent 1px)',
                      'background-size': `${pitch * 5}px ${pitch * 5}px`,
                      'background-position': position,
                    }),
                  ],
                  [],
                ),
              ],
            );
          },
        }
      : { type: model.background };
  const selectedNode =
    model.editor.selectedNodes.length === 1
      ? model.editor.graph.nodes.find((node) => node.id === model.editor.selectedNodes[0])
      : undefined;
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
        h.div(
          [
            h.Role('group'),
            h.AriaLabel('Presentation'),
            h.Style({ display: 'flex', gap: '8px', 'flex-wrap': 'wrap', 'margin-bottom': '12px' }),
          ],
          [
            h.button(
              [
                h.Type('button'),
                h.AriaPressed(String(model.minimalMode)),
                h.Disabled(model.editor.gesture.type !== 'idle'),
                h.OnClick(Message.ClickedMinimalMode()),
              ],
              ['Minimal mode'],
            ),
            h.button(
              [
                h.Type('button'),
                h.AriaExpanded(model.diagnosticsPanelOpen),
                h.OnClick(Message.ClickedDiagnosticsPanel()),
              ],
              ['Diagnostics'],
            ),
          ],
        ),
        ...(model.diagnosticsPanelOpen
          ? [
              h.div(
                [
                  h.Role('group'),
                  h.AriaLabel('Diagnostic options'),
                  h.Style({
                    display: 'flex',
                    gap: '12px',
                    'flex-wrap': 'wrap',
                    'margin-bottom': '12px',
                  }),
                ],
                [
                  h.label(
                    [],
                    [
                      h.input([
                        h.Type('checkbox'),
                        h.Checked(model.diagnosticsEnabled),
                        h.Disabled(model.minimalMode || model.editor.gesture.type !== 'idle'),
                        h.OnClick(Message.ClickedDiagnosticsEnabled()),
                      ]),
                      'Show diagnostics',
                    ],
                  ),
                  ...diagnosticOptions.map(([diagnostic, label]) =>
                    h.label(
                      [],
                      [
                        h.input([
                          h.Type('checkbox'),
                          h.Checked(model.diagnostics[diagnostic]),
                          h.Disabled(
                            model.minimalMode ||
                              !model.diagnosticsEnabled ||
                              model.editor.gesture.type !== 'idle',
                          ),
                          h.OnClick(Message.ClickedDiagnostic({ diagnostic })),
                        ]),
                        label,
                      ],
                    ),
                  ),
                  h.p(
                    [],
                    [
                      'Minimal mode and the global switch override individual flags; stored choices return when re-enabled.',
                    ],
                  ),
                ],
              ),
            ]
          : []),
        h.p(diagnostics.instructions ? [] : [h.Style(hidden)], [
          'Open an example to replace the current diagram. Shift-drag the canvas background or Shift-click node titles to select several. Save keeps a copy in this browser.',
        ]),
        ...(model.minimalMode
          ? []
          : [
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
            ]),
        h.p(diagnostics.instructions ? [] : [h.Style(hidden)], [
          'In Onion Architecture, arrows show source dependencies toward the domain.',
        ]),
        ...(model.minimalMode
          ? [
              h.div(
                [h.Role('group'), h.AriaLabel('Graph actions')],
                [
                  button('Undo', Message.ObservedFlowInput({ message: { type: 'UndoPressed' } })),
                  button('Redo', Message.ObservedFlowInput({ message: { type: 'RedoPressed' } })),
                ],
              ),
            ]
          : [
              h.div(
                [
                  h.Role('group'),
                  h.AriaLabel('Graph actions'),
                  h.Style({
                    display: 'flex',
                    gap: '8px',
                    'flex-wrap': 'wrap',
                    'margin-bottom': '12px',
                  }),
                ],
                [
                  button('Add node', Message.ClickedAdd()),
                  h.button(
                    [
                      h.Type('button'),
                      h.AriaPressed(String(model.editor.snapToGrid)),
                      h.Disabled(model.editor.readOnly || model.editor.gesture.type !== 'idle'),
                      h.OnClick(
                        Message.ObservedFlowInput({ message: { type: 'GridSnapToggled' } }),
                      ),
                    ],
                    ['Snap to grid'],
                  ),
                  h.button(
                    [
                      h.Type('button'),
                      h.AriaPressed(String(model.editor.snapToAlignment)),
                      h.Disabled(model.editor.readOnly || model.editor.gesture.type !== 'idle'),
                      h.OnClick(
                        Message.ObservedFlowInput({ message: { type: 'AlignmentSnapToggled' } }),
                      ),
                    ],
                    ['Snap to nodes'],
                  ),
                  h.label(
                    [],
                    [
                      'Background ',
                      h.select(
                        [
                          h.AriaLabel('Background style'),
                          h.Value(model.background),
                          h.OnChange((value) =>
                            Message.SelectedBackground({
                              background: Schema.decodeUnknownSync(BackgroundStyle)(value),
                            }),
                          ),
                        ],
                        (
                          [
                            ['dots', 'Dots'],
                            ['squares', 'Squares'],
                            ['custom', 'Custom graph paper'],
                            ['none', 'None'],
                          ] as const
                        ).map(([value, label]) =>
                          h.option(
                            [h.Value(value), h.Selected(model.background === value)],
                            [label],
                          ),
                        ),
                      ),
                    ],
                  ),
                  ...(diagnostics.measurements
                    ? [
                        h.label(
                          [
                            h.Style({
                              display: 'inline-flex',
                              'align-items': 'center',
                              gap: '6px',
                            }),
                          ],
                          [
                            'Grid spacing ',
                            h.input([
                              h.Type('number'),
                              h.AriaLabel('Grid spacing'),
                              h.Min('0'),
                              h.Step('any'),
                              h.Value(String(model.editor.gridSpacing)),
                              h.Disabled(
                                model.editor.readOnly || model.editor.gesture.type !== 'idle',
                              ),
                              h.Style({ width: '72px', 'min-height': '32px' }),
                              h.OnChange((value) =>
                                Message.ObservedFlowInput({
                                  message: { type: 'GridSpacingChanged', spacing: Number(value) },
                                }),
                              ),
                            ]),
                          ],
                        ),
                      ]
                    : []),
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
                  ...(selectedNode?.kind === 'group'
                    ? [
                        button(
                          'Fit group to contents',
                          Message.ObservedFlowInput({
                            message: { type: 'GroupFitClicked', id: selectedNode.id },
                          }),
                          model.editor.readOnly || model.editor.gesture.type !== 'idle',
                        ),
                        h.button(
                          [
                            h.Type('button'),
                            h.AriaPressed(String(selectedNode.keepAspectRatio ?? false)),
                            h.Disabled(
                              model.editor.readOnly || model.editor.gesture.type !== 'idle',
                            ),
                            h.OnClick(
                              Message.ObservedFlowInput({
                                message: { type: 'GroupAspectRatioToggled', id: selectedNode.id },
                              }),
                            ),
                          ],
                          ['Lock proportions'],
                        ),
                      ]
                    : []),
                  ...(selectedNode?.parentId
                    ? [
                        h.button(
                          [
                            h.Type('button'),
                            h.AriaPressed(String(selectedNode.extent === 'parent')),
                            h.Disabled(
                              model.editor.readOnly || model.editor.gesture.type !== 'idle',
                            ),
                            h.OnClick(
                              Message.ObservedFlowInput({
                                message: { type: 'NodeContainmentToggled', id: selectedNode.id },
                              }),
                            ),
                          ],
                          ['Keep inside parent'],
                        ),
                        h.button(
                          [
                            h.Type('button'),
                            h.AriaPressed(String(selectedNode.expandParent ?? false)),
                            h.Disabled(
                              model.editor.readOnly || model.editor.gesture.type !== 'idle',
                            ),
                            h.OnClick(
                              Message.ObservedFlowInput({
                                message: { type: 'NodeExpansionToggled', id: selectedNode.id },
                              }),
                            ),
                          ],
                          ['Grow parent'],
                        ),
                      ]
                    : []),
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
            ]),
        h.p(
          [h.Id('flow-import-help'), ...(diagnostics.instructions ? [] : [h.Style(hidden)])],
          ['Importing JSON replaces the current diagram.'],
        ),
        ...(!model.minimalMode && selectedEdge
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
        h.label(
          [h.Style({ display: 'flex', gap: '8px', 'align-items': 'center', margin: '12px 0' })],
          [
            'Node design',
            h.select(
              [
                h.AriaLabel('Node design'),
                h.Value(model.nodeDesign),
                h.OnChange((value) =>
                  Message.SelectedNodeDesign({
                    nodeDesign: Schema.decodeUnknownSync(NodeDesign)(value),
                  }),
                ),
                h.Style({ padding: '8px' }),
              ],
              [
                h.option([h.Value('cards'), h.Selected(model.nodeDesign === 'cards')], ['Cards']),
                h.option(
                  [h.Value('orbits'), h.Selected(model.nodeDesign === 'orbits')],
                  ['Orbits · custom SVG shells'],
                ),
              ],
            ),
          ],
        ),
        h.label(
          [h.Style({ display: 'flex', gap: '8px', 'align-items': 'center', margin: '12px 0' })],
          [
            'Edge design',
            h.select(
              [
                h.AriaLabel('Edge design'),
                h.Value(model.edgeDesign),
                h.OnChange((value) =>
                  Message.SelectedEdgeDesign({
                    edgeDesign: Schema.decodeUnknownSync(EdgeDesign)(value),
                  }),
                ),
                h.Style({ padding: '8px' }),
              ],
              [
                h.option(
                  [h.Value('default'), h.Selected(model.edgeDesign === 'default')],
                  ['Default'],
                ),
                h.option(
                  [h.Value('raised'), h.Selected(model.edgeDesign === 'raised')],
                  ['Raised arcs'],
                ),
              ],
            ),
          ],
        ),
        h.label(
          [h.Style({ display: 'flex', gap: '8px', 'align-items': 'center', margin: '12px 0' })],
          [
            'Connection preview',
            h.select(
              [
                h.AriaLabel('Connection preview'),
                h.Value(model.connectionDesign),
                h.OnChange((value) =>
                  Message.SelectedConnectionDesign({
                    connectionDesign: Schema.decodeUnknownSync(ConnectionDesign)(value),
                  }),
                ),
                h.Style({ padding: '8px' }),
              ],
              [
                h.option(
                  [h.Value('dashed'), h.Selected(model.connectionDesign === 'dashed')],
                  ['Dashed'],
                ),
                h.option(
                  [h.Value('ribbon'), h.Selected(model.connectionDesign === 'ribbon')],
                  ['Ribbon'],
                ),
                h.option(
                  [h.Value('hidden'), h.Selected(model.connectionDesign === 'hidden')],
                  ['Hidden'],
                ),
              ],
            ),
          ],
        ),
        flowView(h, model.editor, {
          id: 'flow-demo',
          connectionGeometry: (context) => {
            if (model.edgeDesign === 'raised') return raisedConnection(context);
            return undefined;
          },
          renderConnection: (context, builder) => {
            if (model.connectionDesign === 'hidden') return builder.g([], []);
            if (model.connectionDesign !== 'ribbon') return undefined;
            const pointer = context.movingEnd === 'source' ? context.source : context.target;
            return builder.g(
              [builder.DataAttribute('preview-design', 'ribbon')],
              [
                builder.path(
                  [
                    builder.D(context.path),
                    builder.Fill('none'),
                    builder.Stroke(context.stroke),
                    builder.StrokeWidth('10'),
                    builder.Opacity('.25'),
                  ],
                  [],
                ),
                builder.path(
                  [
                    builder.D(context.path),
                    builder.Fill('none'),
                    builder.Stroke(context.stroke),
                    builder.StrokeWidth('3'),
                    builder.StrokeLinecap('round'),
                  ],
                  [],
                ),
                builder.circle(
                  [
                    builder.Cx(String(pointer.x)),
                    builder.Cy(String(pointer.y)),
                    builder.R('6'),
                    builder.Fill(context.stroke),
                  ],
                  [],
                ),
              ],
            );
          },
          edgeGeometry: (context) => {
            if (model.edgeDesign === 'raised') return raisedEdge(context);
            return undefined;
          },
          renderNodeShell: (context, builder) => {
            if (model.nodeDesign === 'orbits') return orbitNode(context, builder);
            return undefined;
          },
          renderGroupShell: (context, builder) => {
            if (model.nodeDesign === 'orbits') return orbitGroup(context, builder);
            return undefined;
          },
          minimalMode: model.minimalMode,
          diagnostics: model.diagnosticsEnabled ? model.diagnostics : false,
          background,
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
              [builder.Style({ visibility: model.minimalMode ? 'hidden' : 'visible' })],
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
                  [
                    builder.Style({
                      visibility:
                        !model.minimalMode && diagnostics.measurements ? 'visible' : 'hidden',
                    }),
                  ],
                  [
                    'Width',
                    builder.input([
                      builder.Type('range'),
                      builder.AriaLabel(`Width for ${node.label}`),
                      builder.Min(
                        String(
                          node.resizeLimits?.minWidth ??
                            Math.min(140, node.size.width, node.resizeLimits?.maxWidth ?? Infinity),
                        ),
                      ),
                      builder.Max(
                        String(
                          node.resizeLimits?.maxWidth ??
                            Math.max(320, node.size.width, node.resizeLimits?.minWidth ?? 0),
                        ),
                      ),
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
        h.p(
          [
            h.Role('status'),
            h.AriaLive('polite'),
            ...(diagnostics.status ? [] : [h.Style(hidden)]),
          ],
          [model.notice],
        ),
      ],
    ),
  };
}
