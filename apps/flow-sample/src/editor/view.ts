import {
  defaultFitViewPadding,
  defaultZoomLimits,
  type EdgeEnd,
  type EdgePathStyle,
  type FlowEdge,
} from '@opsydyn/foldkit-flow';
import { supportsForceLayout } from '@opsydyn/foldkit-flow-force/eligibility';
import {
  flowView,
  flowViewportControl,
  flowMinimap,
  flowMinimapViewport,
  resolveFlowDiagnostics,
  type FlowBackground,
} from '@opsydyn/foldkit-flow/foldkit';
import { Schema } from 'effect';
import type { Document, HtmlBuilder } from 'foldkit/html';

import { workbenchPolicy } from './editor-policy';
import { Message } from './message';
import {
  ThemePreference,
  NavigationDesign,
  WheelNavigation,
  BackgroundStyle,
  PortAnchorPreset,
  ConnectionDesign,
  EdgeDesign,
  ReconnectLock,
  EdgeLabelDesign,
  NodeToolbarDesign,
  EdgeToolbarDesign,
  ContextMenuDesign,
  ConnectionListDesign,
  ResizeReadoutDesign,
  AlignmentGuideDesign,
  SelectionMarqueeDesign,
  CanvasCopyDesign,
  NodeDesign,
  type Model,
} from './model';
import { currentPreset } from './port-presets';
import {
  orbitNode,
  orbitGroup,
  raisedEdge,
  raisedConnection,
  edgeBadge,
  edgeBadgeEditor,
  releaseGateAnnotation,
  compactNodeToolbar,
  compactEdgeToolbar,
  customContextMenu,
  connectionRows,
  labeledResizeReadout,
  endpointAlignmentGuide,
  hatchedSelectionMarquee,
  canvasHelpCard,
  canvasStatusCard,
} from './presentation';
import { workbenchThemes } from './theme';

const edgePathOptions: ReadonlyArray<{ label: string; style: EdgePathStyle | null }> = [
  { label: 'Automatic', style: null },
  { label: 'Straight', style: 'straight' },
  { label: 'Stepped', style: 'stepped' },
  { label: 'Smooth', style: 'smooth' },
];

export function view(model: Model, h: HtmlBuilder<Message>): Document {
  const title = 'Workflow patterns | FoldKit Flow';
  const { themePreference } = model;
  const colorScheme = themePreference === 'system' ? model.systemColorScheme : themePreference;
  if (themePreference === null || colorScheme === null) return { title, body: h.div([], []) };
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
                    'linear-gradient(to right, var(--flow-grid-line, #94a3b833) 1px, transparent 1px), linear-gradient(to bottom, var(--flow-grid-line, #94a3b833) 1px, transparent 1px)',
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
                        'linear-gradient(to right, var(--flow-grid-dot, #64748b66) 1px, transparent 1px), linear-gradient(to bottom, var(--flow-grid-dot, #64748b66) 1px, transparent 1px)',
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
  const policy = workbenchPolicy(model);
  const endpointSelect = (edge: FlowEdge, end: EdgeEnd) => {
    const reason = policy.canReconnect(edge, end, model.editor.graph);
    const reasonId = `flow-reconnect-${end}-reason`;
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
            h.Disabled(model.editor.readOnly || reason !== null),
            ...(reason === null ? [] : [h.AriaDescribedBy(reasonId)]),
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
        ...(reason === null
          ? []
          : [h.small([h.Id(reasonId), h.Style({ margin: '0 6px' })], [reason])]),
      ],
    );
  };
  return {
    title,
    body: h.div(
      [h.DataAttribute('flow-workbench-color-scheme', colorScheme)],
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
                h.AriaPressed(String(model.showWorldAnnotation)),
                h.OnClick(Message.ClickedWorldAnnotation()),
              ],
              ['World annotation'],
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
                          model.editor.readOnly ||
                            model.editor.gesture.type !== 'idle' ||
                            (policy.canResizeNode?.(selectedNode, model.editor.graph) ?? null) !==
                              null,
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
                  h.button(
                    [
                      h.Type('button'),
                      h.AriaPressed(String(model.protectDeletions)),
                      h.OnClick(Message.ClickedDeletionProtection()),
                    ],
                    ['Protect required items'],
                  ),
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
            'Edge labels',
            h.select(
              [
                h.AriaLabel('Edge labels'),
                h.Value(model.edgeLabelDesign),
                h.OnChange((value) =>
                  Message.SelectedEdgeLabelDesign({
                    edgeLabelDesign: Schema.decodeUnknownSync(EdgeLabelDesign)(value),
                  }),
                ),
                h.Style({ padding: '8px' }),
              ],
              [
                h.option(
                  [h.Value('standard'), h.Selected(model.edgeLabelDesign === 'standard')],
                  ['Standard'],
                ),
                h.option(
                  [h.Value('badge'), h.Selected(model.edgeLabelDesign === 'badge')],
                  ['Badge and inline editor'],
                ),
              ],
            ),
          ],
        ),
        h.label(
          [h.Style({ display: 'flex', gap: '8px', 'align-items': 'center', margin: '12px 0' })],
          [
            'Node toolbar',
            h.select(
              [
                h.AriaLabel('Node toolbar'),
                h.Value(model.nodeToolbarDesign),
                h.OnChange((value) =>
                  Message.SelectedNodeToolbarDesign({
                    nodeToolbarDesign: Schema.decodeUnknownSync(NodeToolbarDesign)(value),
                  }),
                ),
                h.Style({ padding: '8px' }),
              ],
              [
                h.option([h.Value('off'), h.Selected(model.nodeToolbarDesign === 'off')], ['Off']),
                h.option(
                  [h.Value('standard'), h.Selected(model.nodeToolbarDesign === 'standard')],
                  ['Standard'],
                ),
                h.option(
                  [h.Value('compact'), h.Selected(model.nodeToolbarDesign === 'compact')],
                  ['Compact · below node'],
                ),
              ],
            ),
          ],
        ),
        h.label(
          [h.Style({ display: 'flex', gap: '8px', 'align-items': 'center', margin: '12px 0' })],
          [
            'Edge actions',
            h.select(
              [
                h.AriaLabel('Edge actions'),
                h.Value(model.edgeToolbarDesign),
                h.OnChange((value) =>
                  Message.SelectedEdgeToolbarDesign({
                    edgeToolbarDesign: Schema.decodeUnknownSync(EdgeToolbarDesign)(value),
                  }),
                ),
                h.Style({ padding: '8px' }),
              ],
              [
                h.option(
                  [h.Value('standard'), h.Selected(model.edgeToolbarDesign === 'standard')],
                  ['Standard'],
                ),
                h.option(
                  [h.Value('compact'), h.Selected(model.edgeToolbarDesign === 'compact')],
                  ['Compact · path and delete'],
                ),
              ],
            ),
          ],
        ),
        h.label(
          [h.Style({ display: 'flex', gap: '8px', 'align-items': 'center', margin: '12px 0' })],
          [
            'Context menus',
            h.select(
              [
                h.AriaLabel('Context menus'),
                h.Value(model.contextMenuDesign),
                h.OnChange((value) =>
                  Message.SelectedContextMenuDesign({
                    contextMenuDesign: Schema.decodeUnknownSync(ContextMenuDesign)(value),
                  }),
                ),
                h.Style({ padding: '8px' }),
              ],
              [
                h.option(
                  [h.Value('standard'), h.Selected(model.contextMenuDesign === 'standard')],
                  ['Standard'],
                ),
                h.option(
                  [h.Value('panel'), h.Selected(model.contextMenuDesign === 'panel')],
                  ['Custom action panel'],
                ),
              ],
            ),
          ],
        ),
        h.label(
          [h.Style({ display: 'flex', gap: '8px', 'align-items': 'center', margin: '12px 0' })],
          [
            'Connection list layout',
            h.select(
              [
                h.AriaLabel('Connection list layout'),
                h.Value(model.connectionListDesign),
                h.OnChange((value) =>
                  Message.SelectedConnectionListDesign({
                    connectionListDesign: Schema.decodeUnknownSync(ConnectionListDesign)(value),
                  }),
                ),
                h.Style({ padding: '8px' }),
              ],
              [
                h.option(
                  [h.Value('standard'), h.Selected(model.connectionListDesign === 'standard')],
                  ['Standard'],
                ),
                h.option(
                  [h.Value('rows'), h.Selected(model.connectionListDesign === 'rows')],
                  ['Connection rows'],
                ),
              ],
            ),
          ],
        ),
        h.label(
          [h.Style({ display: 'flex', gap: '8px', 'align-items': 'center', margin: '12px 0' })],
          [
            'Resize readout',
            h.select(
              [
                h.AriaLabel('Resize readout'),
                h.Value(model.resizeReadoutDesign),
                h.OnChange((value) =>
                  Message.SelectedResizeReadoutDesign({
                    resizeReadoutDesign: Schema.decodeUnknownSync(ResizeReadoutDesign)(value),
                  }),
                ),
                h.Style({ padding: '8px' }),
              ],
              [
                h.option(
                  [h.Value('standard'), h.Selected(model.resizeReadoutDesign === 'standard')],
                  ['Standard'],
                ),
                h.option(
                  [h.Value('labeled'), h.Selected(model.resizeReadoutDesign === 'labeled')],
                  ['Labeled dimensions'],
                ),
              ],
            ),
          ],
        ),
        h.label(
          [h.Style({ display: 'flex', gap: '8px', 'align-items': 'center', margin: '12px 0' })],
          [
            'Alignment guide design',
            h.select(
              [
                h.AriaLabel('Alignment guide design'),
                h.Value(model.alignmentGuideDesign),
                h.OnChange((value) =>
                  Message.SelectedAlignmentGuideDesign({
                    alignmentGuideDesign: Schema.decodeUnknownSync(AlignmentGuideDesign)(value),
                  }),
                ),
                h.Style({ padding: '8px' }),
              ],
              [
                h.option(
                  [h.Value('standard'), h.Selected(model.alignmentGuideDesign === 'standard')],
                  ['Standard'],
                ),
                h.option(
                  [h.Value('endpoints'), h.Selected(model.alignmentGuideDesign === 'endpoints')],
                  ['Solid with endpoints'],
                ),
              ],
            ),
          ],
        ),
        h.label(
          [h.Style({ display: 'flex', gap: '8px', 'align-items': 'center', margin: '12px 0' })],
          [
            'Box selection match',
            h.select(
              [
                h.AriaLabel('Box selection match'),
                h.Value(model.editor.boxSelectionMatch),
                h.Disabled(model.editor.gesture.type !== 'idle'),
                h.OnChange((value) =>
                  Message.ObservedFlowInput({
                    message: {
                      type: 'BoxSelectionMatchChanged',
                      match: Schema.decodeUnknownSync(Schema.Literals(['full', 'partial']))(value),
                    },
                  }),
                ),
                h.Style({ padding: '8px' }),
              ],
              [
                h.option(
                  [h.Value('full'), h.Selected(model.editor.boxSelectionMatch === 'full')],
                  ['Full containment'],
                ),
                h.option(
                  [h.Value('partial'), h.Selected(model.editor.boxSelectionMatch === 'partial')],
                  ['Partial overlap'],
                ),
              ],
            ),
          ],
        ),
        h.label(
          [h.Style({ display: 'flex', gap: '8px', 'align-items': 'center', margin: '12px 0' })],
          [
            'Selection marquee',
            h.select(
              [
                h.AriaLabel('Selection marquee'),
                h.Value(model.selectionMarqueeDesign),
                h.OnChange((value) =>
                  Message.SelectedSelectionMarqueeDesign({
                    selectionMarqueeDesign: Schema.decodeUnknownSync(SelectionMarqueeDesign)(value),
                  }),
                ),
                h.Style({ padding: '8px' }),
              ],
              [
                h.option(
                  [h.Value('standard'), h.Selected(model.selectionMarqueeDesign === 'standard')],
                  ['Standard'],
                ),
                h.option(
                  [h.Value('hatched'), h.Selected(model.selectionMarqueeDesign === 'hatched')],
                  ['Hatched outline'],
                ),
              ],
            ),
          ],
        ),
        h.label(
          [h.Style({ display: 'flex', gap: '8px', 'align-items': 'center', margin: '12px 0' })],
          [
            'Canvas help and status',
            h.select(
              [
                h.AriaLabel('Canvas help and status'),
                h.Value(model.canvasCopyDesign),
                h.OnChange((value) =>
                  Message.SelectedCanvasCopyDesign({
                    canvasCopyDesign: Schema.decodeUnknownSync(CanvasCopyDesign)(value),
                  }),
                ),
                h.Style({ padding: '8px' }),
              ],
              [
                h.option(
                  [h.Value('standard'), h.Selected(model.canvasCopyDesign === 'standard')],
                  ['Standard'],
                ),
                h.option(
                  [h.Value('card'), h.Selected(model.canvasCopyDesign === 'card')],
                  ['Help card and status badge'],
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
        h.label(
          [h.Style({ display: 'flex', gap: '8px', 'align-items': 'center', margin: '12px 0' })],
          [
            'Port anchors',
            h.select(
              [
                h.AriaLabel('Port anchors'),
                h.Value(currentPreset(model.editor.graph)),
                h.Disabled(
                  model.editor.readOnly ||
                    model.editor.gesture.type !== 'idle' ||
                    model.editor.graph.nodes.every((node) => node.ports.length === 0),
                ),
                h.OnChange((value) =>
                  Message.SelectedPortAnchors({
                    preset: Schema.decodeUnknownSync(PortAnchorPreset)(value),
                  }),
                ),
                h.Style({ padding: '8px' }),
              ],
              [
                h.option(
                  [
                    h.Value('cardinal'),
                    h.Selected(currentPreset(model.editor.graph) === 'cardinal'),
                  ],
                  ['Cardinal'],
                ),
                h.option(
                  [
                    h.Value('diagonal'),
                    h.Selected(currentPreset(model.editor.graph) === 'diagonal'),
                  ],
                  ['Diagonal · circle perimeter'],
                ),
                h.option(
                  [
                    h.Value('custom'),
                    h.Selected(currentPreset(model.editor.graph) === 'custom'),
                    h.Disabled(true),
                  ],
                  ['Custom document positions'],
                ),
              ],
            ),
          ],
        ),
        h.label(
          [h.Style({ display: 'flex', gap: '8px', 'align-items': 'center', margin: '12px 0' })],
          [
            'Navigation design',
            h.select(
              [
                h.AriaLabel('Navigation design'),
                h.Value(model.navigationDesign),
                h.OnChange((value) =>
                  Message.SelectedNavigationDesign({
                    navigationDesign: Schema.decodeUnknownSync(NavigationDesign)(value),
                  }),
                ),
                h.Style({ padding: '8px' }),
              ],
              [
                h.option(
                  [h.Value('standard'), h.Selected(model.navigationDesign === 'standard')],
                  ['Standard'],
                ),
                h.option(
                  [h.Value('compact'), h.Selected(model.navigationDesign === 'compact')],
                  ['Compact · framed overview'],
                ),
              ],
            ),
          ],
        ),
        h.label(
          [h.Style({ display: 'flex', gap: '8px', 'align-items': 'center', margin: '12px 0' })],
          [
            'Wheel navigation',
            h.select(
              [
                h.AriaLabel('Wheel navigation'),
                h.Value(model.wheelNavigation),
                h.OnChange((value) =>
                  Message.SelectedWheelNavigation({
                    wheelNavigation: Schema.decodeUnknownSync(WheelNavigation)(value),
                  }),
                ),
                h.Style({ padding: '8px' }),
              ],
              [
                h.option(
                  [h.Value('zoom'), h.Selected(model.wheelNavigation === 'zoom')],
                  ['Scroll to zoom'],
                ),
                h.option(
                  [h.Value('pan'), h.Selected(model.wheelNavigation === 'pan')],
                  ['Scroll to pan · Ctrl/Command to zoom'],
                ),
                h.option(
                  [h.Value('off'), h.Selected(model.wheelNavigation === 'off')],
                  ['Page scrolling'],
                ),
              ],
            ),
          ],
        ),
        h.label(
          [h.Style({ display: 'flex', gap: '8px', 'align-items': 'center', margin: '12px 0' })],
          [
            h.input([
              h.Type('checkbox'),
              h.Checked(model.editor.fitViewPadding === 96),
              h.Disabled(model.editor.gesture.type !== 'idle'),
              h.OnClick(
                Message.ObservedFlowInput({
                  message: {
                    type: 'ViewportConstraintsChanged',
                    zoomLimits:
                      model.editor.fitViewPadding === 96
                        ? defaultZoomLimits
                        : { minZoom: 0.75, maxZoom: 1.3 },
                    fitViewPadding: model.editor.fitViewPadding === 96 ? defaultFitViewPadding : 96,
                  },
                }),
              ),
            ]),
            'Constrain camera (75–130% zoom, 96 px fit padding)',
          ],
        ),
        h.label(
          [h.Style({ display: 'flex', gap: '8px', 'align-items': 'center', margin: '12px 0' })],
          [
            h.input([
              h.Type('checkbox'),
              h.Checked(model.editor.fitViewDuration > 0),
              h.OnClick(
                Message.ObservedFlowInput({
                  message: {
                    type: 'FitViewDurationChanged',
                    duration: model.editor.fitViewDuration === 0 ? 400 : 0,
                  },
                }),
              ),
            ]),
            'Animate Fit view',
          ],
        ),
        h.label(
          [h.Style({ display: 'flex', gap: '8px', 'align-items': 'center', margin: '12px 0' })],
          [
            'Draft → Review reconnection',
            h.select(
              [
                h.AriaLabel('Draft to Review reconnection'),
                h.Value(model.reconnectLock),
                h.OnChange((value) =>
                  Message.SelectedReconnectLock({
                    reconnectLock: Schema.decodeUnknownSync(ReconnectLock)(value),
                  }),
                ),
                h.Style({ padding: '8px' }),
              ],
              (
                [
                  ['none', 'Both ends enabled'],
                  ['source', 'Source locked'],
                  ['target', 'Target locked'],
                  ['both', 'Both ends locked'],
                ] as const
              ).map(([value, label]) =>
                h.option([h.Value(value), h.Selected(model.reconnectLock === value)], [label]),
              ),
            ),
          ],
        ),
        h.button(
          [
            h.Type('button'),
            h.AriaPressed(String(model.snapConnections)),
            h.OnClick(Message.ClickedConnectionSnap()),
          ],
          ['Snap drops to nearby ports'],
        ),
        h.label(
          [h.Class('workbench-theme-picker')],
          [
            'Theme',
            h.select(
              [
                h.Value(themePreference),
                h.OnChange((value) =>
                  Message.SelectedThemePreference({
                    themePreference: Schema.decodeUnknownSync(ThemePreference)(value),
                  }),
                ),
              ],
              [
                h.option([h.Value('system'), h.Selected(themePreference === 'system')], ['System']),
                h.option([h.Value('light'), h.Selected(themePreference === 'light')], ['Light']),
                h.option([h.Value('dark'), h.Selected(themePreference === 'dark')], ['Dark']),
              ],
            ),
          ],
        ),
        h.label(
          [
            h.Style({
              display: 'inline-flex',
              'align-items': 'center',
              gap: '6px',
              margin: '0 8px',
            }),
          ],
          [
            h.input([
              h.Type('checkbox'),
              h.Checked(model.lockKeyNodes),
              h.OnClick(Message.ClickedLockKeyNodes()),
            ]),
            'Lock Review and Domain model',
          ],
        ),
        h.label(
          [
            h.Style({
              display: 'inline-flex',
              'align-items': 'center',
              gap: '6px',
              margin: '0 8px',
            }),
          ],
          [
            h.input([
              h.Type('checkbox'),
              h.Checked(model.lockNodeSizes),
              h.OnClick(Message.ClickedLockNodeSizes()),
            ]),
            'Lock Review and Application core dimensions',
          ],
        ),
        h.label(
          [
            h.Style({
              display: 'inline-flex',
              'align-items': 'center',
              gap: '6px',
              margin: '0 8px',
            }),
          ],
          [
            h.input([
              h.Type('checkbox'),
              h.Checked(model.excludeSelection),
              h.OnClick(Message.ClickedExcludeSelection()),
            ]),
            'Exclude Review and its incoming connection from selection',
          ],
        ),
        flowView(h, model.editor, {
          renderViewportControls: (context, builder) => {
            if (model.navigationDesign !== 'compact') return undefined;
            const control = (action: typeof context.actions.zoomIn, label: string) =>
              flowViewportControl(
                builder,
                action,
                (event) => Message.ObservedFlowInput({ message: event }),
                [
                  builder.Style({
                    'min-width': '44px',
                    'min-height': '44px',
                    border: '0',
                    'border-radius': '22px',
                    background: action.pressed ? '#0369a1' : 'light-dark(#e0f2fe, #20384a)',
                    color: action.pressed ? '#fff' : 'light-dark(#0c4a6e, #bde7ff)',
                    padding: '0 16px',
                    cursor: 'pointer',
                  }),
                ],
                [label],
              );
            return builder.nav(
              [
                builder.AriaLabel('Viewport controls'),
                builder.Class('compact-navigation'),
                builder.Style({
                  display: 'flex',
                  gap: '6px',
                  'align-items': 'center',
                  'flex-wrap': 'wrap',
                  'margin-bottom': '8px',
                }),
              ],
              [
                control(context.actions.zoomOut, '−'),
                control(context.actions.zoomIn, '+'),
                control(context.actions.fitView, 'Fit view'),
                ...(context.selectionModeControl
                  ? [control(context.actions.selectionMode, 'Box select')]
                  : []),
                ...(context.diagnostics.zoomLevel
                  ? [
                      builder.span(
                        [builder.DataAttribute('flow-zoom-level', '')],
                        [`${Math.round(context.state.viewport.zoom * 100)}%`],
                      ),
                    ]
                  : []),
              ],
            );
          },
          renderMinimap: (context, builder) => {
            if (model.navigationDesign !== 'compact') return undefined;
            return flowMinimap(
              builder,
              context,
              (event) => Message.ObservedFlowInput({ message: event }),
              [
                builder.Style({
                  position: 'absolute',
                  right: '14px',
                  bottom: '14px',
                  width: 'min(210px, 52%)',
                  height: '130px',
                  padding: '12px',
                  border: '3px solid #38bdf8',
                  'border-radius': '18px',
                  background: 'light-dark(#f0f9ff, #152b3c)',
                  cursor: 'crosshair',
                }),
              ],
              [
                ...context.nodes.map((node) =>
                  builder.rect(
                    [
                      builder.X(String(node.position.x)),
                      builder.Y(String(node.position.y)),
                      builder.Width(String(node.size.width)),
                      builder.Height(String(node.size.height)),
                      builder.Rx('20'),
                      builder.Fill(
                        node.kind === 'group' && !context.state.collapsedGroups.includes(node.id)
                          ? '#bae6fd'
                          : '#0369a1',
                      ),
                    ],
                    [],
                  ),
                ),
                flowMinimapViewport(builder, context.geometry, [
                  builder.Fill('none'),
                  builder.Stroke('#ea580c'),
                  builder.Style({ 'vector-effect': 'non-scaling-stroke' }),
                ]),
              ],
            );
          },
          id: 'flow-demo',
          wheelNavigation: model.wheelNavigation,
          renderEdgeLabel: (context, builder) =>
            model.edgeLabelDesign === 'badge' ? edgeBadge(context, builder) : undefined,
          renderEdgeLabelEditor: (context, builder) =>
            model.edgeLabelDesign === 'badge' ? edgeBadgeEditor(context, builder) : undefined,
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
          renderWorldOverlay: (context, builder) =>
            model.showWorldAnnotation ? releaseGateAnnotation(context, builder) : null,
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
          theme: workbenchThemes[colorScheme],
          nodeToolbar:
            model.nodeToolbarDesign === 'compact'
              ? { placement: 'bottom', offset: 12 }
              : model.nodeToolbarDesign === 'standard',
          renderNodeToolbar: (context, builder) =>
            model.nodeToolbarDesign === 'compact'
              ? compactNodeToolbar(context, builder)
              : undefined,
          edgeToolbar: true,
          canDelete: policy.canDelete,
          canReconnect: policy.canReconnect,
          canMoveNode: policy.canMoveNode,
          canResizeNode: policy.canResizeNode,
          canSelectNode: policy.canSelectNode,
          canSelectEdge: policy.canSelectEdge,
          renderEdgeToolbar: (context, builder) =>
            model.edgeToolbarDesign === 'compact'
              ? compactEdgeToolbar(context, builder)
              : undefined,
          renderCanvasHelp: (context, builder) =>
            model.canvasCopyDesign === 'card' ? canvasHelpCard(context, builder) : undefined,
          renderCanvasStatus: (context, builder) =>
            model.canvasCopyDesign === 'card' ? canvasStatusCard(context, builder) : undefined,
          renderSelectionMarquee: (context, builder) =>
            model.selectionMarqueeDesign === 'hatched'
              ? hatchedSelectionMarquee(context, builder)
              : undefined,
          renderAlignmentGuide: (context, builder) =>
            model.alignmentGuideDesign === 'endpoints'
              ? endpointAlignmentGuide(context, builder)
              : undefined,
          renderResizeReadout: (context, builder) =>
            model.resizeReadoutDesign === 'labeled'
              ? labeledResizeReadout(context, builder)
              : undefined,
          renderConnections: (context, builder) =>
            model.connectionListDesign === 'rows' ? connectionRows(context, builder) : undefined,
          contextActions: true,
          renderContextMenu: (context, builder) =>
            model.contextMenuDesign === 'panel' ? customContextMenu(context, builder) : undefined,
          autoPan: true,
          connectionDropRadius: model.snapConnections ? 32 : 0,
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
                      builder.Disabled(
                        model.editor.readOnly ||
                          (policy.canResizeNode?.(node, model.editor.graph) ?? null) !== null,
                      ),
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
