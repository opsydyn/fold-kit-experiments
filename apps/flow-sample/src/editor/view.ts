import {
  resolveEdgeReconnection,
  defaultFitViewPadding,
  defaultZoomLimits,
  type EdgePathStyle,
  type FlowNode,
  type EditorEvent,
} from '@opsydyn/foldkit-flow';
import { supportsForceLayout } from '@opsydyn/foldkit-flow-force/eligibility';
import {
  flowView,
  flowC4Node,
  flowC4Group,
  type FlowC4NodeOptions,
  createFlowNodeBodyCache,
  flowEdgeEndpointSelect,
  flowEdgeEndpointReasons,
  flowPortLabel,
  flowPortAnchorHandle,
  portInspectorContext,
  portAdditionContext,
  flowPortAddButton,
  flowPortRemoveButton,
  flowPortLabelEditButton,
  flowPortLabelForm,
  flowPortLabelInput,
  flowPortLabelSave,
  flowPortLabelCancel,
  flowPortProtectionReason,
  portPositionEditorContext,
  flowPortPositionEditButton,
  flowPortPositionModeSelect,
  flowPortPositionSideSelect,
  flowPortPositionInput,
  flowPortPositionForm,
  flowPortPositionSave,
  flowPortPositionCancel,
  type FlowPortPositionDraftChange,
  flowViewportControl,
  flowMinimap,
  flowMinimapViewport,
  resolveFlowDiagnostics,
  type FlowBackground,
  type FlowNodeRenderContext,
} from '@opsydyn/foldkit-flow/foldkit';
import { Match, Option, Schema } from 'effect';
import { createLazy, type Document, type HtmlBuilder } from 'foldkit/html';

import { workbenchPolicy } from './editor-policy';
import { mermaidExportPanel } from './mermaid-preview';
import { Message } from './message';
import {
  ThemePreference,
  SearchScope,
  NavigationDesign,
  WheelNavigation,
  BackgroundStyle,
  PortAnchorPreset,
  ConnectionDesign,
  EdgeDesign,
  ReconnectLock,
  ReconnectionSnap,
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
  PortSnapPriority,
} from './model';
import { nextPort } from './port-editing';
import { currentPreset } from './port-presets';
import {
  orbitNode,
  socketPort,
  reasonSocketPort,
  targetAnchorGuide,
  orbitGroup,
  raisedEdge,
  storageDependencyEdge,
  raisedConnection,
  edgeBadge,
  edgeBadgeEditor,
  releaseGateAnnotation,
  compactNodeToolbar,
  compactEdgeToolbar,
  connectionCreationPanel,
  portChooserSearch,
  customContextMenu,
  connectionRows,
  labeledResizeReadout,
  endpointAlignmentGuide,
  hatchedSelectionMarquee,
  canvasHelpCard,
  canvasStatusCard,
} from './presentation';
import { searchDiagram } from './search';
import { workbenchThemes } from './theme';

type WorkbenchEdgeHooks = {
  edgeGeometry?: typeof raisedEdge;
  renderEdge?: typeof storageDependencyEdge;
};

const workbenchNodeCache = createLazy();
const workbenchBodyCache = createFlowNodeBodyCache();
const orbitBodyCache = createFlowNodeBodyCache();
const c4Options: FlowC4NodeOptions<Message> = { bodyCache: createFlowNodeBodyCache() };
const retainedC4Node = (context: FlowNodeRenderContext, h: HtmlBuilder<Message>) =>
  flowC4Node(context, h, c4Options);
const retainedC4Group = (context: FlowNodeRenderContext, h: HtmlBuilder<Message>) =>
  flowC4Group(context, h, c4Options);
const retainedOrbitNode = (context: FlowNodeRenderContext, h: HtmlBuilder<Message>) =>
  orbitNode(context, h, orbitBodyCache);
const retainedOrbitGroup = (context: FlowNodeRenderContext, h: HtmlBuilder<Message>) =>
  orbitGroup(context, h, orbitBodyCache);
const flowInput = (message: EditorEvent) => Message.ObservedFlowInput({ message });

const reconnectionRadiusOptions = {
  match: {},
  exact: { reconnectionDropRadius: 0 },
  wide: { reconnectionDropRadius: 48 },
} as const;
function renderWorkbenchNode(
  node: FlowNode,
  builder: HtmlBuilder<Message>,
  minimalMode: boolean,
  measurements: boolean,
  resizeDisabled: boolean,
) {
  return builder.div(
    [builder.Style({ visibility: minimalMode ? 'hidden' : 'visible' })],
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
            visibility: measurements ? 'visible' : 'hidden',
          }),
        ],
        [
          'Width',
          builder.input([
            builder.Type('range'),
            builder.AriaLabel(`Width for ${node.label}`),
            builder.Disabled(resizeDisabled),
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
  );
}
const renderDefaultNode = (node: FlowNode, builder: HtmlBuilder<Message>) =>
  renderWorkbenchNode(node, builder, false, true, false);

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
  const matches = searchDiagram(model.editor, model.searchQuery, model.searchScope);
  const searchItem = model.searchScope === 'nodes' ? 'node' : 'connection';
  const canReveal = model.editor.surface !== null && model.editor.gesture.type === 'idle';
  const policy = workbenchPolicy(model);
  const inspector = Option.getOrUndefined(
    !model.minimalMode && selectedNode
      ? portInspectorContext(model.editor, selectedNode.id, policy, {
          idPrefix: 'workbench-port-inspector',
        })
      : Option.none(),
  );
  const labelMessages = {
    saved: Message.SubmittedPortLabel(),
    cancelled: Message.ClickedCancelPortLabel(),
  };
  const positionMessages = {
    saved: Message.SubmittedPortPosition(),
    cancelled: Message.ClickedCancelPortPosition(),
  };
  const positionChanged = (change: FlowPortPositionDraftChange): Message =>
    Match.value(change).pipe(
      Match.when({ type: 'mode' }, ({ mode }) => Message.SelectedPortPositionMode({ mode })),
      Match.when({ type: 'side' }, ({ side }) => Message.SelectedPortPositionSide({ side })),
      Match.when({ type: 'number' }, ({ field, text }) =>
        Message.ChangedPortPositionNumber({ field, text }),
      ),
      Match.exhaustive,
    );
  const reasonStyle = {
    border: '1px solid currentColor',
    'border-radius': '999px',
    padding: '3px 9px',
    'font-size': '0.85rem',
  };
  const endpointFields = selectedEdge
    ? (['source', 'target'] as const).flatMap((end) => {
        const context = resolveEdgeReconnection(model.editor, selectedEdge.id, end, policy);
        if (!context) return [];
        const key = end === 'source' ? 'reconnectSource' : 'reconnectTarget';
        const options = {
          idPrefix: 'workbench-endpoint',
          query: model.portChooserQueries[key],
          groupByNode: true,
        };
        return [
          h.div(
            [
              h.Key(end),
              h.Class('workbench-endpoint-field'),
              h.Style({
                padding: '10px',
                margin: '6px 0',
                border: '1px solid var(--flow-node-border, #cbd5e1)',
                'border-radius': '10px',
                background: 'var(--flow-node-background, #fff)',
              }),
            ],
            [
              h.strong([], [end === 'source' ? '↗ Source port' : '↘ Target port']),
              portChooserSearch(context.entries, model.portChooserQueries[key], key, h),
              flowEdgeEndpointSelect(
                h,
                context,
                (message) => Message.ObservedFlowInput({ message }),
                [h.Style({ width: '100%', 'min-height': '36px', margin: '6px 0' })],
                options,
              ),
              flowEdgeEndpointReasons(h, context, [h.Style({ 'font-size': '0.85rem' })], options),
            ],
          ),
        ];
      })
    : [];
  const edgeHooks: WorkbenchEdgeHooks = {};
  if (model.edgeDesign === 'raised') edgeHooks.edgeGeometry = raisedEdge;
  if (model.editor.graph.edges.some((edge) => edge.id === 'storage-application'))
    edgeHooks.renderEdge = storageDependencyEdge;
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
                h.AriaPressed(String(model.viewportCulling)),
                h.Disabled(model.editor.gesture.type !== 'idle'),
                h.OnClick(Message.ClickedViewportCulling()),
              ],
              ['Viewport culling'],
            ),
            h.button(
              [
                h.Type('button'),
                h.AriaPressed(String(model.retainNodeViews)),
                h.Title('Retain built-in bodies; port protections and custom ports stay live.'),
                h.OnClick(Message.ClickedRetainNodeViews()),
              ],
              ['Retain node views'],
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
                h.AriaExpanded(model.mermaidPreviewOpen),
                h.AriaControls('flow-mermaid-preview'),
                h.OnClick(Message.ClickedMermaidPreview()),
              ],
              ['Mermaid export'],
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
        ...(model.mermaidPreviewOpen ? [mermaidExportPanel(model, h)] : []),
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
                  button(
                    'Open C4 system context',
                    Message.SelectedExample({ example: 'c4-context' }),
                  ),
                  button(
                    'Open C4 container view',
                    Message.SelectedExample({ example: 'c4-containers' }),
                  ),
                  button(
                    'Open nested C4 container view',
                    Message.SelectedExample({ example: 'c4-nested-containers' }),
                  ),
                  button('Open Onion Architecture', Message.SelectedExample({ example: 'onion' })),
                  button(
                    'Open grouped Onion Architecture',
                    Message.SelectedExample({ example: 'grouped-onion' }),
                  ),
                  button(
                    'Open large workflow (320 nodes)',
                    Message.SelectedExample({ example: 'large-workflow' }),
                  ),
                  button(
                    'Open protected Orbit workflow (320 nodes)',
                    Message.SelectedExample({ example: 'protected-orbits' }),
                  ),
                  button(
                    'Open port snapping demo',
                    Message.SelectedExample({ example: 'port-snapping' }),
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
                  h.button(
                    [
                      h.Type('button'),
                      h.AriaPressed(String(model.protectPortEdits)),
                      h.OnClick(Message.ClickedPortEditProtection()),
                    ],
                    ['Protect Review input'],
                  ),
                  button(
                    'Delete selected',
                    Message.ObservedFlowInput({ message: { type: 'DeletePressed' } }),
                  ),
                  h.label(
                    [],
                    [
                      h.input([
                        h.Type('checkbox'),
                        h.Checked(model.includeCamera),
                        h.OnClick(Message.ClickedIncludeCamera()),
                      ]),
                      'Include camera',
                    ],
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
                  ...endpointFields,
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
                  [h.Value('c4'), h.Selected(model.nodeDesign === 'c4')],
                  ['C4 · package presets'],
                ),
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
              h.Checked(model.doubleClickZoom),
              h.OnClick(Message.ClickedDoubleClickZoom()),
            ]),
            'Double-click zoom',
          ],
        ),
        h.label(
          [h.Style({ display: 'flex', gap: '8px', 'align-items': 'center', margin: '12px 0' })],
          [
            h.input([
              h.Type('checkbox'),
              h.Checked(model.spaceToPan),
              h.OnClick(Message.ClickedSpaceToPan()),
            ]),
            'Space-drag to pan',
          ],
        ),
        h.label(
          [h.Style({ display: 'flex', gap: '8px', 'align-items': 'center', margin: '12px 0' })],
          [
            h.input([
              h.Type('checkbox'),
              h.Checked(model.middleButtonPan),
              h.OnClick(Message.ClickedMiddleButtonPan()),
            ]),
            'Middle-drag to pan',
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
          ['Snap new connections'],
        ),
        h.label(
          [h.Style({ display: 'flex', gap: '8px', 'align-items': 'center', margin: '12px 0' })],
          [
            'Reconnection snap radius',
            h.select(
              [
                h.AriaLabel('Reconnection snap radius'),
                h.Value(model.reconnectionSnap),
                h.OnChange((value) =>
                  Message.SelectedReconnectionSnap({
                    reconnectionSnap: Schema.decodeUnknownSync(ReconnectionSnap)(value),
                  }),
                ),
              ],
              (
                [
                  ['match', 'Match new connections'],
                  ['exact', 'Exact ports only'],
                  ['wide', '48 px radius'],
                ] as const
              ).map(([value, label]) =>
                h.option([h.Value(value), h.Selected(model.reconnectionSnap === value)], [label]),
              ),
            ),
          ],
        ),
        h.label(
          [h.Style({ display: 'flex', gap: '8px', 'align-items': 'center', margin: '12px 0' })],
          [
            h.input([
              h.Type('checkbox'),
              h.Checked((model.editor.connectionSnapHysteresis ?? 0) > 0),
              h.Disabled(model.editor.gesture.type !== 'idle'),
              h.OnClick(
                Message.ObservedFlowInput({
                  message: {
                    type: 'ConnectionSnapHysteresisChanged',
                    distance: model.editor.connectionSnapHysteresis ? 0 : 12,
                  },
                }),
              ),
            ]),
            'Stable port snapping (12 px)',
          ],
        ),
        h.label(
          [h.Style({ display: 'flex', gap: '8px', 'align-items': 'center', margin: '12px 0' })],
          [
            h.input([
              h.Type('checkbox'),
              h.Checked(model.portLabels),
              h.OnClick(Message.ClickedPortLabels()),
            ]),
            'Port labels',
          ],
        ),
        h.label(
          [h.Style({ display: 'flex', gap: '8px', 'align-items': 'center', margin: '12px 0' })],
          [
            h.input([
              h.Type('checkbox'),
              h.Checked(model.portAnchorHandles),
              h.Disabled(model.editor.gesture.type !== 'idle'),
              h.OnClick(Message.ClickedPortAnchorHandles()),
            ]),
            'Drag port anchors',
          ],
        ),
        h.label(
          [h.Style({ display: 'flex', gap: '8px', 'align-items': 'center', margin: '12px 0' })],
          [
            h.input([
              h.Type('checkbox'),
              h.Checked((model.editor.portAnchorSnapDistance ?? 0) > 0),
              h.Disabled(model.editor.gesture.type !== 'idle'),
              h.OnClick(Message.ClickedPortAnchorSnap()),
            ]),
            'Snap port anchors to edges',
          ],
        ),
        h.label(
          [h.Style({ display: 'flex', gap: '8px', 'align-items': 'center', margin: '12px 0' })],
          [
            h.input([
              h.Type('checkbox'),
              h.Checked((model.editor.portAnchorCornerSnapDistance ?? 0) > 0),
              h.Disabled(model.editor.gesture.type !== 'idle'),
              h.OnClick(Message.ClickedPortAnchorCornerSnap()),
            ]),
            'Snap port anchors to corners',
          ],
        ),
        h.label(
          [h.Style({ display: 'flex', gap: '8px', 'align-items': 'center', margin: '12px 0' })],
          [
            h.input([
              h.Type('checkbox'),
              h.Checked((model.editor.portAnchorMidpointSnapDistance ?? 0) > 0),
              h.Disabled(model.editor.gesture.type !== 'idle'),
              h.OnClick(Message.ClickedPortAnchorMidpointSnap()),
            ]),
            'Snap port anchors to midpoints',
          ],
        ),
        h.label(
          [h.Style({ display: 'flex', gap: '8px', 'align-items': 'center', margin: '12px 0' })],
          [
            h.input([
              h.Type('checkbox'),
              h.Checked((model.editor.portAnchorSnapHysteresis ?? 0) > 0),
              h.Disabled(model.editor.gesture.type !== 'idle'),
              h.OnClick(Message.ClickedPortAnchorSnapHysteresis()),
            ]),
            'Stable port anchor snapping',
          ],
        ),
        h.label(
          [h.Style({ display: 'flex', gap: '8px', 'align-items': 'center', margin: '12px 0' })],
          [
            h.input([
              h.Type('checkbox'),
              h.Checked(model.portAnchorSnapBypass),
              h.Disabled(model.editor.gesture.type !== 'idle'),
              h.OnClick(Message.ClickedPortAnchorSnapBypass()),
            ]),
            'Alt bypasses port snapping',
          ],
        ),
        h.label(
          [h.Style({ display: 'flex', gap: '8px', 'align-items': 'center', margin: '12px 0' })],
          [
            h.input([
              h.Type('checkbox'),
              h.Checked(model.perPortSnapping),
              h.Disabled(model.editor.gesture.type !== 'idle'),
              h.OnClick(Message.ClickedPerPortSnapping()),
            ]),
            'Per-port snapping rules',
          ],
        ),
        ...(model.perPortSnapping
          ? [
              h.p(
                [],
                [
                  'Review input: midpoints. Review output: corners. Draft output: free placement. Other ports inherit editor settings.',
                ],
              ),
            ]
          : []),
        h.label(
          [h.Style({ display: 'flex', gap: '8px', 'align-items': 'center', margin: '12px 0' })],
          [
            h.input([
              h.Type('checkbox'),
              h.Checked(model.customPorts),
              h.OnClick(Message.ClickedCustomPorts()),
            ]),
            'Custom port sockets',
          ],
        ),
        h.label(
          [],
          [
            h.input([
              h.Type('checkbox'),
              h.Checked(model.socketReasonBadges),
              h.Disabled(!model.customPorts),
              h.OnClick(Message.ClickedSocketReasonBadges()),
            ]),
            'Visible socket reasons',
          ],
        ),
        h.label(
          [],
          [
            h.input([
              h.Type('checkbox'),
              h.Checked(model.mixedPortProtection),
              h.OnClick(Message.ClickedMixedPortProtection()),
            ]),
            'Apply fixture socket policies',
          ],
        ),

        h.label(
          [h.Style({ display: 'flex', gap: '8px', 'align-items': 'center', margin: '12px 0' })],
          [
            h.input([
              h.Type('checkbox'),
              h.Checked(model.restrictedSnapTargets),
              h.Disabled(model.editor.gesture.type !== 'idle'),
              h.OnClick(Message.ClickedRestrictedSnapTargets()),
            ]),
            'Restricted snap targets',
          ],
        ),
        ...(model.restrictedSnapTargets
          ? [
              h.p(
                [],
                [
                  'Review input: left/right midpoints only. Review output: top edge and upper corners. Other ports keep their current rules.',
                ],
              ),
            ]
          : []),
        h.label(
          [h.Style({ display: 'flex', gap: '8px', 'align-items': 'center', margin: '12px 0' })],
          [
            h.input([
              h.Type('checkbox'),
              h.Checked(model.portAnchorGuides),
              h.OnClick(Message.ClickedPortAnchorGuides()),
            ]),
            'Port snap guides',
          ],
        ),
        h.label(
          [h.Style({ display: 'flex', gap: '8px', 'align-items': 'center', margin: '12px 0' })],
          [
            h.input([
              h.Type('checkbox'),
              h.Checked(model.customPortAnchorGuides),
              h.OnClick(Message.ClickedCustomPortAnchorGuides()),
            ]),
            'Custom snap guides',
          ],
        ),
        h.label(
          [h.Style({ display: 'flex', gap: '8px', 'align-items': 'center', margin: '12px 0' })],
          [
            'Port snap priority',
            h.select(
              [
                h.AriaLabel('Port snap priority'),
                h.Value(model.editor.portAnchorSnapPriority ?? 'corners-first'),
                h.Disabled(model.editor.gesture.type !== 'idle'),
                h.OnChange((value) =>
                  Message.SelectedPortAnchorSnapPriority({
                    priority: Schema.decodeUnknownSync(PortSnapPriority)(value),
                  }),
                ),
              ],
              [
                h.option(
                  [
                    h.Value('corners-first'),
                    h.Selected(
                      (model.editor.portAnchorSnapPriority ?? 'corners-first') === 'corners-first',
                    ),
                  ],
                  ['Corners first'],
                ),
                h.option(
                  [
                    h.Value('midpoints-first'),
                    h.Selected(model.editor.portAnchorSnapPriority === 'midpoints-first'),
                  ],
                  ['Midpoints first'],
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
              h.Checked(model.overlappingPortSnaps),
              h.Disabled(model.editor.gesture.type !== 'idle'),
              h.OnClick(Message.ClickedOverlappingPortSnaps()),
            ]),
            'Overlapping port snap zones',
          ],
        ),
        ...(model.overlappingPortSnaps
          ? [
              h.p(
                [],
                [
                  'Overlap demo takes precedence for Review ports: input inherits the selected priority; output keeps corners first. Other ports keep their current rules.',
                ],
              ),
            ]
          : []),
        h.label(
          [h.Style({ display: 'flex', gap: '8px', 'align-items': 'center', margin: '12px 0' })],
          [
            h.input([
              h.Type('checkbox'),
              h.Checked(model.keyboardPortTargets),
              h.OnClick(Message.ClickedKeyboardPortTargets()),
            ]),
            'Keyboard snap targets',
          ],
        ),
        ...(model.keyboardPortTargets
          ? [
              h.p(
                [],
                [
                  'Focus a port position handle. Page Down/Up cycle targets; Home/End choose first/last. Arrow keys keep precise nudging. Each position change is undoable.',
                ],
              ),
            ]
          : []),
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
        h.fieldset(
          [h.Style({ margin: '12px 0', padding: '8px 12px', border: '1px solid currentColor' })],
          [
            h.legend([], ['Port connections']),
            ...(
              [
                ['draftOutput', 'Lock Draft output'],
                ['publishInput', 'Lock Publish input'],
              ] as const
            ).map(([port, label]) =>
              h.label(
                [
                  h.Style({
                    display: 'inline-flex',
                    'align-items': 'center',
                    gap: '6px',
                    'margin-right': '16px',
                  }),
                ],
                [
                  h.input([
                    h.Type('checkbox'),
                    h.Checked(model.portLocks[port]),
                    h.OnClick(Message.ClickedPortLock({ port })),
                  ]),
                  label,
                ],
              ),
            ),
          ],
        ),
        h.fieldset(
          [h.Style({ margin: '12px 0', padding: '8px 12px', border: '1px solid currentColor' })],
          [
            h.legend([], ['Item visibility']),
            ...(
              [
                ['hiddenNodeIds', 'review', 'Hide Review node'],
                ['hiddenEdgeIds', 'draft-review', 'Hide Draft → Review edge'],
              ] as const
            ).map(([field, id, label]) =>
              h.label(
                [
                  h.Style({
                    display: 'inline-flex',
                    'align-items': 'center',
                    gap: '6px',
                    'margin-right': '16px',
                  }),
                ],
                [
                  h.input([
                    h.Type('checkbox'),
                    h.Checked(model.editor.visibility?.[field]?.includes(id) ?? false),
                    h.OnClick(Message.ClickedVisibilityToggle({ field, id })),
                  ]),
                  label,
                ],
              ),
            ),
          ],
        ),
        h.form(
          [
            h.Role('search'),
            h.AriaLabel(`Diagram ${model.searchScope}`),
            h.Style({
              display: 'flex',
              'flex-wrap': 'wrap',
              gap: '8px',
              'align-items': 'center',
              margin: '12px 0',
            }),
            h.OnSubmit(Message.SubmittedDiagramSearch()),
          ],
          [
            h.label(
              [],
              [
                `Find a ${searchItem} `,
                h.input([
                  h.Type('search'),
                  h.Value(model.searchQuery),
                  h.Placeholder('Label or ID'),
                  h.OnInput((query) => Message.ChangedDiagramSearch({ query })),
                ]),
              ],
            ),
            h.select(
              [
                h.AriaLabel('Search scope'),
                h.Value(model.searchScope),
                h.OnChange((value) =>
                  Message.SelectedSearchScope({
                    scope: Schema.decodeUnknownSync(SearchScope)(value),
                  }),
                ),
              ],
              [
                h.option([h.Value('nodes'), h.Selected(model.searchScope === 'nodes')], ['Nodes']),
                h.option(
                  [h.Value('connections'), h.Selected(model.searchScope === 'connections')],
                  ['Connections'],
                ),
              ],
            ),
            h.button(
              [h.Type('submit'), h.Disabled(!canReveal || matches.length === 0)],
              ['Reveal first match'],
            ),
            ...(model.searchQuery.trim()
              ? [
                  h.p(
                    [h.Role('status'), h.Style({ margin: '0' })],
                    [
                      matches.length === 0
                        ? `No matching ${model.searchScope}`
                        : matches.length > 8
                          ? `Showing 8 of ${matches.length} matching ${model.searchScope}`
                          : matches.length === 1
                            ? `1 matching ${searchItem}`
                            : `${matches.length} matching ${model.searchScope}`,
                    ],
                  ),
                  ...matches
                    .slice(0, 8)
                    .map(({ label, event }) =>
                      h.button(
                        [
                          h.Key(event.id),
                          h.Type('button'),
                          h.Disabled(!canReveal),
                          h.OnClick(flowInput(event)),
                        ],
                        [label],
                      ),
                    ),
                ]
              : []),
          ],
        ),
        ...(model.nodeDesign === 'c4'
          ? [
              h.div(
                [h.Class('c4-diagram-caption')],
                [
                  h.h2(
                    [],
                    [
                      model.editor.graph.nodes.some((node) => node.id === 'platform-boundary')
                        ? 'Order platform · container view'
                        : 'Order platform · system context',
                    ],
                  ),
                  h.p(
                    [],
                    [
                      'C4 package presets. People and systems are named explicitly; dashed nodes are external. Arrows describe directed relationships. Use the theme picker to compare light and dark.',
                    ],
                  ),
                ],
              ),
            ]
          : []),
        flowView(h, model.editor, {
          renderPort: model.customPorts
            ? model.socketReasonBadges
              ? reasonSocketPort
              : socketPort
            : undefined,
          portLabels: model.portLabels,
          portAnchorHandles: model.portAnchorHandles,
          portAnchorSnapBypassModifier: model.portAnchorSnapBypass ? 'Alt' : undefined,
          portAnchorGuides: model.portAnchorGuides,
          portAnchorKeyboardTargets: model.keyboardPortTargets,
          renderPortAnchorGuide: model.customPortAnchorGuides ? targetAnchorGuide : undefined,
          renderPortAnchorHandle: (context, builder) =>
            context.snappedCorner || context.snappedMidpoint
              ? flowPortAnchorHandle(
                  builder,
                  context,
                  [
                    builder.Class(
                      context.snappedCorner
                        ? 'workbench-corner-handle'
                        : 'workbench-midpoint-handle',
                    ),
                    builder.Style({
                      background: 'var(--flow-node-background, #fff)',
                      color: 'var(--flow-node-color, #172033)',
                      border: '2px solid var(--flow-selection, #2563eb)',
                      'border-radius': '6px',
                      padding: '4px 8px',
                      'white-space': 'nowrap',
                      'font-size': '11px',
                    }),
                  ],
                  [
                    context.snappedCorner
                      ? `◆ Pinned ${context.snappedCorner}`
                      : `⊙ Centered ${context.snappedMidpoint}`,
                  ],
                )
              : undefined,
          canEditPort: policy.canEditPort,
          renderPortLabel: (context, builder) =>
            flowPortLabel(
              builder,
              { ...context, offset: 22 },
              [
                builder.Class('workbench-port-label'),
                builder.Style({
                  background: 'var(--flow-node-background, #fff)',
                  color: 'var(--flow-node-color, #172033)',
                  border: '1px solid var(--flow-canvas-border, #94a3b8)',
                  'border-radius': '6px',
                  padding: '3px 7px',
                  'font-size': '11px',
                  'font-weight': '600',
                  'z-index': '4',
                }),
              ],
              [context.label],
            ),
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
                control(context.actions.fitSelection, context.actions.fitSelection.label),
                control(context.actions.zoomArea, context.actions.zoomArea.label),
                control(context.actions.previousView, context.actions.previousView.label),
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
          doubleClickZoom: model.doubleClickZoom,
          spaceToPan: model.spaceToPan,
          middleButtonPan: model.middleButtonPan,
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
          ...edgeHooks,
          viewportCulling: model.viewportCulling,
          nodeViewCache:
            model.retainNodeViews && model.nodeDesign === 'cards' ? workbenchNodeCache : undefined,
          nodeBodyCache:
            model.retainNodeViews && model.nodeDesign === 'cards' ? workbenchBodyCache : undefined,
          renderWorldOverlay: (context, builder) =>
            model.showWorldAnnotation ? releaseGateAnnotation(context, builder) : null,
          renderNodeShell:
            model.nodeDesign === 'orbits'
              ? model.retainNodeViews
                ? retainedOrbitNode
                : orbitNode
              : model.nodeDesign === 'c4'
                ? model.retainNodeViews
                  ? retainedC4Node
                  : flowC4Node
                : undefined,
          renderGroupShell: (context, builder) => {
            if (model.nodeDesign === 'c4')
              return model.retainNodeViews
                ? retainedC4Group(context, builder)
                : flowC4Group(context, builder);
            if (model.nodeDesign !== 'orbits') return undefined;
            return model.retainNodeViews
              ? retainedOrbitGroup(context, builder)
              : orbitGroup(context, builder);
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
          edgeReconnection: true,
          connectionCreation: true,
          renderConnectionCreation: (context, builder) =>
            connectionCreationPanel(context, builder, model.portChooserQueries),
          canConnect: policy.canConnect,
          canDelete: policy.canDelete,
          canReconnect: policy.canReconnect,
          canConnectPort:
            model.portLocks.draftOutput || model.portLocks.publishInput || model.mixedPortProtection
              ? policy.canConnectPort
              : undefined,
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
          renderZoomAreaMarquee: ({ viewport }, builder) =>
            builder.div(
              [
                builder.Class('workbench-zoom-area'),
                builder.Style({
                  position: 'absolute',
                  inset: '0',
                  border: `${2 / viewport.zoom}px dashed var(--flow-selection, #2563eb)`,
                  'border-radius': `${8 / viewport.zoom}px`,
                  background: 'var(--flow-selection-background, rgb(37 99 235 / 0.12))',
                  'box-sizing': 'border-box',
                }),
              ],
              [],
            ),
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
          ...reconnectionRadiusOptions[model.reconnectionSnap],
          pinchZoom: true,
          resizeHandles: true,
          minimap: true,
          viewportControls: true,
          fitSelectionControl: true,
          zoomAreaControl: true,
          previousViewControl: true,
          selectionModeControl: true,
          label: 'Workflow editor',
          onEvent: flowInput,
          edgeAppearance: (edge) =>
            edge.data === 'dashed' ? { dashArray: '9 5', strokeWidth: 4 } : {},
          renderNode:
            model.minimalMode ||
            !diagnostics.measurements ||
            model.editor.readOnly ||
            policy.canResizeNode
              ? (node, builder) =>
                  renderWorkbenchNode(
                    node,
                    builder,
                    model.minimalMode,
                    !model.minimalMode && diagnostics.measurements,
                    model.editor.readOnly ||
                      (policy.canResizeNode?.(node, model.editor.graph) ?? null) !== null,
                  )
              : renderDefaultNode,
        }),
        ...(inspector
          ? [
              h.fieldset(
                [h.DataAttribute('flow-port-inspector-demo', 'composable')],
                [
                  h.legend([], ['Ports for ' + inspector.node.label]),
                  h.p(
                    [],
                    [
                      'Removing a port also removes its attached connections. Undo restores them together.',
                    ],
                  ),
                  ...(['input', 'output'] as const).map((kind) => {
                    const addition = Option.getOrUndefined(
                      portAdditionContext(
                        model.editor,
                        inspector.node.id,
                        nextPort(inspector.node, kind),
                        policy,
                        { idPrefix: 'workbench-port-inspector' },
                      ),
                    );
                    if (!addition) return h.span([], []);
                    return h.div(
                      [
                        h.Style({
                          display: 'inline-flex',
                          gap: '8px',
                          'align-items': 'center',
                          'flex-wrap': 'wrap',
                        }),
                      ],
                      [
                        flowPortAddButton(
                          h,
                          addition,
                          Message.ClickedAddPort({ nodeId: inspector.node.id, kind }),
                          [h.Style({ padding: '10px 16px', cursor: 'pointer' })],
                          ['Add ' + kind + ' port'],
                        ),
                        ...(addition.control.reason !== null
                          ? [flowPortProtectionReason(h, addition.control, [h.Style(reasonStyle)])]
                          : []),
                      ],
                    );
                  }),
                  ...inspector.entries.map((entry) => {
                    const { node, port } = entry;
                    const draft = model.portLabelDraft;
                    const editing = draft?.nodeId === node.id && draft.portId === port.id;
                    const positionDraft = model.portPositionDraft;
                    const positionEditor =
                      positionDraft?.nodeId === node.id && positionDraft.portId === port.id
                        ? portPositionEditorContext(entry, positionDraft.draft)
                        : null;
                    return h.div(
                      [
                        h.Style({
                          display: 'flex',
                          gap: '8px',
                          'align-items': 'center',
                          margin: '8px 0',
                          'flex-wrap': 'wrap',
                        }),
                      ],
                      [
                        h.span([], [port.label ?? port.id]),
                        ...(editing
                          ? [
                              flowPortLabelForm(
                                h,
                                labelMessages,
                                [h.Style({ display: 'flex', gap: '4px', 'flex-wrap': 'wrap' })],
                                [
                                  flowPortLabelInput(
                                    h,
                                    entry,
                                    draft.text,
                                    (text) => Message.ChangedPortLabelDraft({ text }),
                                    [h.Placeholder('Defaults to port ID')],
                                  ),
                                  flowPortLabelSave(h, entry, [], ['Save port label']),
                                  flowPortLabelCancel(
                                    h,
                                    labelMessages.cancelled,
                                    [h.Style({ padding: '10px 16px', cursor: 'pointer' })],
                                    ['Cancel port label'],
                                  ),
                                ],
                              ),
                            ]
                          : [
                              flowPortLabelEditButton(
                                h,
                                entry,
                                Message.ClickedEditPortLabel({ nodeId: node.id, portId: port.id }),
                                [],
                                ['Edit label'],
                              ),
                            ]),
                        ...(positionEditor
                          ? [
                              flowPortPositionForm(
                                h,
                                positionMessages,
                                [
                                  h.Style({
                                    display: 'flex',
                                    gap: '8px',
                                    'align-items': 'center',
                                    'flex-wrap': 'wrap',
                                  }),
                                ],
                                [
                                  h.label(
                                    [],
                                    [
                                      'Position ',
                                      flowPortPositionModeSelect(
                                        h,
                                        positionEditor,
                                        positionChanged,
                                        [],
                                      ),
                                    ],
                                  ),
                                  h.label(
                                    [],
                                    [
                                      'Side ',
                                      flowPortPositionSideSelect(
                                        h,
                                        positionEditor,
                                        positionChanged,
                                        [],
                                      ),
                                    ],
                                  ),
                                  ...positionEditor.inputs.map((input) =>
                                    h.label(
                                      [],
                                      [
                                        input.field === 'offset'
                                          ? 'Offset '
                                          : input.field.toUpperCase() + ' ',
                                        flowPortPositionInput(
                                          h,
                                          positionEditor,
                                          input,
                                          positionChanged,
                                          [h.Style({ width: '88px' })],
                                        ),
                                      ],
                                    ),
                                  ),
                                  flowPortPositionSave(h, positionEditor, [], ['Save position']),
                                  flowPortPositionCancel(
                                    h,
                                    positionMessages.cancelled,
                                    [],
                                    ['Cancel position'],
                                  ),
                                ],
                              ),
                            ]
                          : [
                              flowPortPositionEditButton(
                                h,
                                entry,
                                Message.ClickedEditPortPosition({
                                  nodeId: node.id,
                                  portId: port.id,
                                }),
                                [],
                                ['Edit position'],
                              ),
                            ]),
                        flowPortRemoveButton(h, entry, flowInput, [], ['Remove port']),
                        ...entry.reasons.map((reason) =>
                          flowPortProtectionReason(h, reason, [h.Style(reasonStyle)]),
                        ),
                      ],
                    );
                  }),
                ],
              ),
            ]
          : []),
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
