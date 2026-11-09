import {
  resolveEdgeReconnection,
  resolveEventStormingRelationship,
  eventStormingRelationshipRules,
  playbackEditionId,
  resolveEditionPlaybackControls,
  resolveEditionScrubber,
  resolveHistoryComparisonControls,
  type ZlozEditionSeekRequest,
  type ZlozPlaybackControlEvent,
  captureEdition,
  compareEditions,
  resolveEditionRestore,
  defaultFitViewPadding,
  architectureNodePresets,
  defaultZoomLimits,
  type EdgePathStyle,
  type ZlozNode,
  type EditorEvent,
} from '@opsydyn/foldkit-zloz';
import { supportsForceLayout } from '@opsydyn/foldkit-zloz-force/eligibility';
import {
  zlozView,
  zlozEventStormingRelationshipControls,
  zlozEventStormingRelationshipSelect,
  zlozEventStormingRelationshipInference,
  zlozEventStormingRelationshipStatus,
  zlozHistoryChangeNavigator,
  zlozHistoryChangeButton,
  zlozHistoryChangeFilter,
  zlozHistoryComparisonControls,
  zlozHistoryBaselineSelect,
  zlozHistoryGhostToggle,
  zlozEditionScrubber,
  zlozEditionScrubberInput,
  zlozEditionScrubberReadout,
  zlozEditionSeekButton,
  zlozPlaybackControls,
  zlozPlaybackControl,
  zlozPlaybackStatus,
  zlozPlaybackReason,
  zlozEventStormingNode,
  type ZlozEventStormingNodeOptions,
  zlozHistoryGhosts,
  zlozGroupFrame,
  zlozDragHandle,
  zlozC4Node,
  zlozC4Group,
  zlozDddNode,
  zlozDddGroup,
  type ZlozDddNodeOptions,
  type ZlozC4NodeOptions,
  createZlozNodeBodyCache,
  zlozEdgeEndpointSelect,
  zlozEdgeEndpointReasons,
  zlozPortLabel,
  zlozPortAnchorHandle,
  portInspectorContext,
  portAdditionContext,
  zlozPortAddButton,
  zlozPortRemoveButton,
  zlozPortLabelEditButton,
  zlozPortLabelForm,
  zlozPortLabelInput,
  zlozPortLabelSave,
  zlozPortLabelCancel,
  zlozPortProtectionReason,
  portPositionEditorContext,
  zlozPortPositionEditButton,
  zlozPortPositionModeSelect,
  zlozPortPositionSideSelect,
  zlozPortPositionInput,
  zlozPortPositionForm,
  zlozPortPositionSave,
  zlozPortPositionCancel,
  type ZlozPortPositionDraftChange,
  zlozViewportControl,
  zlozMinimap,
  zlozMinimapViewport,
  resolveZlozDiagnostics,
  type ZlozBackground,
  type ZlozNodeRenderContext,
} from '@opsydyn/foldkit-zloz/foldkit';
import { Match, Option, Schema } from 'effect';
import { createLazy, type Document, type HtmlBuilder } from 'foldkit/html';

import { workbenchPolicy } from './editor-policy';
import {
  delegatedRelationship,
  workbenchRelationshipOptions,
} from './event-storming-relationships';
import { historyAllowsMessage, editionRestorePolicy } from './history';
import { workbenchHistoryComparison, historyChangeNavigatorContext } from './history-navigation';
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
import { modelSessionBusy } from './model-sessions';
import { patternInsertionReason } from './pattern-insertion';
import { playbackReason, playbackInspectionReason } from './playback';
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
import { relationshipControlsContext } from './relationship-controls';
import { searchDiagram } from './search';
import { workbenchThemes } from './theme';
import { workbenchLayout, type WorkbenchControls } from './workbench-layout';

type WorkbenchEdgeHooks = {
  edgeGeometry?: typeof raisedEdge;
  renderEdge?: typeof storageDependencyEdge;
};

const workbenchNodeCache = createLazy();
const workbenchBodyCache = createZlozNodeBodyCache();
const orbitBodyCache = createZlozNodeBodyCache();
const stormOptions: ZlozEventStormingNodeOptions<Message> = {
  bodyCache: createZlozNodeBodyCache(),
};
const c4Options: ZlozC4NodeOptions<Message> = { bodyCache: createZlozNodeBodyCache() };
const retainedC4Node = (context: ZlozNodeRenderContext, h: HtmlBuilder<Message>) =>
  zlozEventStormingNode(context, h, stormOptions) ??
  zlozC4Node(context, h, c4Options) ??
  zlozDddNode(context, h, dddOptions);
const retainedC4Group = (context: ZlozNodeRenderContext, h: HtmlBuilder<Message>) =>
  zlozC4Group(context, h, c4Options) ?? zlozDddGroup(context, h, dddOptions);
const dddOptionsWithoutCache: ZlozDddNodeOptions<Message> = {
  renderBadge: ({ architecture }, h) =>
    architecture.role === 'aggregate-root'
      ? h.span([h.Style({ 'font-size': '10px', 'font-weight': '600' })], ['Consistency owner'])
      : null,
};
const dddOptions: ZlozDddNodeOptions<Message> = {
  ...dddOptionsWithoutCache,
  bodyCache: createZlozNodeBodyCache(),
};
const unretainedDddNode = (context: ZlozNodeRenderContext, h: HtmlBuilder<Message>) =>
  zlozEventStormingNode(context, h) ??
  zlozDddNode(context, h, dddOptionsWithoutCache) ??
  zlozC4Node(context, h);
const retainedDddNode = (context: ZlozNodeRenderContext, h: HtmlBuilder<Message>) =>
  zlozEventStormingNode(context, h, stormOptions) ??
  zlozDddNode(context, h, dddOptions) ??
  zlozC4Node(context, h, c4Options);
const retainedDddGroup = (context: ZlozNodeRenderContext, h: HtmlBuilder<Message>) =>
  zlozDddGroup(context, h, dddOptions) ?? zlozC4Group(context, h, c4Options);
const retainedOrbitNode = (context: ZlozNodeRenderContext, h: HtmlBuilder<Message>) =>
  orbitNode(context, h, orbitBodyCache);
const retainedOrbitGroup = (context: ZlozNodeRenderContext, h: HtmlBuilder<Message>) =>
  orbitGroup(context, h, orbitBodyCache);

const reconnectionRadiusOptions = {
  match: {},
  exact: { reconnectionDropRadius: 0 },
  wide: { reconnectionDropRadius: 48 },
} as const;
function renderWorkbenchNode(
  node: ZlozNode,
  builder: HtmlBuilder<Message>,
  minimalMode: boolean,
  measurements: boolean,
  resizeDisabled: boolean,
  onEvent: (event: EditorEvent) => Message,
) {
  return builder.div(
    [builder.Style({ visibility: minimalMode ? 'hidden' : 'visible' })],
    [
      builder.input([
        builder.AriaLabel(`Label for ${node.id}`),
        builder.Value(node.label),
        builder.OnInput((label) => onEvent({ type: 'NodeLabelChanged', id: node.id, label })),
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
              onEvent({ type: 'NodeWidthChanged', id: node.id, width: Number(value) }),
            ),
          ]),
        ],
      ),
    ],
  );
}
const historyStormOptions: ZlozEventStormingNodeOptions<Message> = {
  ...stormOptions,
  renderControls: () => [],
};
const historyDddOptions: ZlozDddNodeOptions<Message> = { ...dddOptions, renderControls: () => [] };
const historyC4Options: ZlozC4NodeOptions<Message> = { ...c4Options, renderControls: () => [] };
const historyNode = (context: ZlozNodeRenderContext, h: HtmlBuilder<Message>) =>
  zlozEventStormingNode(context, h, historyStormOptions) ??
  zlozDddNode(context, h, historyDddOptions) ??
  zlozC4Node(context, h, historyC4Options);
const historyGroup = (context: ZlozNodeRenderContext, h: HtmlBuilder<Message>) =>
  zlozDddGroup(context, h, historyDddOptions) ??
  zlozC4Group(context, h, historyC4Options) ??
  zlozGroupFrame(
    h,
    context,
    [
      h.Style({
        border: '2px dashed var(--flow-node-border, #64748b)',
        background: 'var(--flow-group-background, transparent)',
      }),
    ],
    [
      zlozDragHandle(
        h,
        context,
        [h.Style({ position: 'absolute', top: '8px', left: '12px', padding: '6px' })],
        [context.node.label],
      ),
    ],
  );

const edgePathOptions: ReadonlyArray<{ label: string; style: EdgePathStyle | null }> = [
  { label: 'Automatic', style: null },
  { label: 'Straight', style: 'straight' },
  { label: 'Stepped', style: 'stepped' },
  { label: 'Smooth', style: 'smooth' },
];

const playbackIcons = { play: '▶', pause: 'Ⅱ', rewind: '↶', previous: '←', next: '→' };
const playbackMessages = {
  PlayClicked: Message.ClickedPlaybackPlay,
  PauseClicked: Message.ClickedPlaybackPause,
  RewindClicked: Message.ClickedPlaybackRewind,
  PreviousClicked: Message.ClickedPlaybackPrevious,
  NextClicked: Message.ClickedPlaybackNext,
} satisfies Record<ZlozPlaybackControlEvent['type'], () => Message>;
const playbackInput = (event: ZlozPlaybackControlEvent): Message => playbackMessages[event.type]();

export function view(model: Model, h: HtmlBuilder<Message>): Document {
  const modelId = model.modelIdentity.id;
  const epoch = model.modelEpoch;
  const observedInput = ({ message }: { message: EditorEvent }) =>
    Message.ObservedModelInput({ modelId, epoch, message });
  const zlozInput = (message: EditorEvent) => observedInput({ message });
  const renderDefaultNode = (node: ZlozNode, builder: HtmlBuilder<Message>) =>
    renderWorkbenchNode(node, builder, false, true, false, zlozInput);
  const workingEditor = model.editor;
  const playback = model.historyPlayback?.cursor;
  const playbackId = playback ? playbackEditionId(playback) : null;
  const playbackName =
    model.editions.find((edition) => edition.id === playbackId)?.name ?? 'No editions';
  const playbackContext = playback
    ? resolveEditionPlaybackControls(playback, {
        blockedReason: playbackInspectionReason(model),
        automaticReason: playbackReason(model),
        editionLabel: playbackName,
      })
    : null;
  const editionNames = new Map(model.editions.map((edition) => [edition.id, edition.name]));
  const scrubberContext = playback
    ? resolveEditionScrubber(playback, {
        blockedReason: playbackInspectionReason(model),
        labelEdition: (id) => editionNames.get(id) ?? id,
      })
    : null;
  const seekInput = (request: ZlozEditionSeekRequest) =>
    Message.SelectedPlaybackEdition({
      modelId,
      session: model.historyPlayback?.session ?? -1,
      editionId: request.editionId,
    });
  const restoreDecision = model.editionRestore
    ? resolveEditionRestore(workingEditor, model.editionRestore.edition, {
        expectedRevision: model.editionRestore.expectedRevision,
        policy: editionRestorePolicy(model),
      })
    : null;
  const restoreComparison = model.editionRestore
    ? compareEditions(
        captureEdition({
          id: 'working-preview',
          name: 'Working graph',
          snapshot: { graph: workingEditor.graph },
        }),
        model.editionRestore.edition,
      )
    : null;
  const selectedEdition = model.editions.find(
    (edition) => edition.id === model.historyReview?.editionId,
  );
  const comparisonControls = resolveHistoryComparisonControls(
    model.editions,
    model.historyReview?.editionId ?? null,
    {
      baselineId: model.historyBaselineId,
      ghosts: model.historyGhosts,
    },
    { minimalMode: model.minimalMode },
  );
  const comparison = workbenchHistoryComparison(model);
  const changeNavigator = historyChangeNavigatorContext(model, comparison);
  const busyModelSession = modelSessionBusy(model);
  if (model.historyReview) model = { ...model, editor: model.historyReview.editor };
  const title = 'Architecture workbench | Foldkit Zloz';
  const { themePreference } = model;
  const colorScheme = themePreference === 'system' ? model.systemColorScheme : themePreference;
  if (themePreference === null || colorScheme === null) return { title, body: h.div([], []) };
  const button = (label: string, message: Message, disabled = false) =>
    h.button(
      [
        h.Type('button'),
        h.Disabled(disabled || (model.historyReview !== null && !historyAllowsMessage(message))),
        h.OnClick(message),
        h.Style({ padding: '10px 16px', cursor: 'pointer' }),
      ],
      [label],
    );
  const diagnostics = resolveZlozDiagnostics({
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
    ['connectionList', 'Connection list'],
  ] as const;
  const background: ZlozBackground<Message> =
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
  const causalRules = workbenchRelationshipOptions(model).rules ?? eventStormingRelationshipRules;
  const relationshipEditingBlocked =
    busyModelSession ||
    model.editor.readOnly ||
    model.historyReview !== null ||
    model.editor.gesture.type !== 'idle';
  const relationshipControls = relationshipControlsContext(model);
  const incompatibleRelationship = selectedEdge
    ? causalRules.find(
        (rule) =>
          resolveEventStormingRelationship(
            model.editor.graph,
            { ...selectedEdge, architecture: rule.architecture },
            workbenchRelationshipOptions(model),
          ).type === 'blocked',
      )?.architecture
    : undefined;
  const insertionReason = patternInsertionReason(model);
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
  const positionChanged = (change: ZlozPortPositionDraftChange): Message =>
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
              zlozEdgeEndpointSelect(
                h,
                context,
                (message) => observedInput({ message }),
                [h.Style({ width: '100%', 'min-height': '36px', margin: '6px 0' })],
                options,
              ),
              zlozEdgeEndpointReasons(h, context, [h.Style({ 'font-size': '0.85rem' })], options),
            ],
          ),
        ];
      })
    : [];
  const edgeHooks: WorkbenchEdgeHooks = {};
  if (model.edgeDesign === 'raised') edgeHooks.edgeGeometry = raisedEdge;
  if (model.editor.graph.edges.some((edge) => edge.id === 'storage-application'))
    edgeHooks.renderEdge = storageDependencyEdge;
  const controls: WorkbenchControls = {
    history: [
      h.div(
        [h.Role('group'), h.AriaLabel('Edition playback')],
        [
          h.label(
            [h.Class('workbench-field')],
            [
              h.input([
                h.Type('checkbox'),
                h.Checked(model.historyPlayback !== null),
                h.OnClick(Message.ClickedPlaybackEnabled()),
              ]),
              'Enable edition playback',
            ],
          ),
          ...(playback && playbackContext
            ? [
                zlozPlaybackControls(h, playbackContext, playbackInput, {
                  attributes: [h.Class('workbench-playback-transport')],
                  renderControl: (action, builder, onEvent) =>
                    zlozPlaybackControl(
                      builder,
                      action,
                      onEvent,
                      [
                        builder.Style({
                          display: 'inline-flex',
                          gap: '6px',
                          'align-items': 'center',
                          padding: '8px 12px',
                          'border-radius': '999px',
                          border: '1px solid var(--rule)',
                          background: 'var(--panel)',
                          color: 'var(--ink)',
                        }),
                      ],
                      [
                        builder.span([builder.AriaHidden(true)], [playbackIcons[action.name]]),
                        action.label,
                      ],
                    ),
                  renderStatus: (context, builder) =>
                    zlozPlaybackStatus(
                      builder,
                      context,
                      [
                        builder.Style({
                          display: 'flex',
                          gap: '8px',
                          'align-items': 'center',
                          'flex-wrap': 'wrap',
                        }),
                      ],
                      [
                        builder.span(
                          [
                            builder.AriaHidden(true),
                            builder.Style({
                              background: 'var(--blue)',
                              color: 'white',
                              padding: '3px 7px',
                              'border-radius': '4px',
                              'font-size': '10px',
                              'letter-spacing': '0.06em',
                            }),
                          ],
                          ['TIMELINE'],
                        ),
                        context.statusText,
                      ],
                    ),
                  renderReason: (context, builder) =>
                    zlozPlaybackReason(builder, context, [
                      builder.Style({
                        'border-left': '2px solid var(--blue)',
                        'padding-left': '10px',
                        color: 'var(--muted)',
                      }),
                    ]),
                  renderLayout: (parts, _context, builder) => [
                    ...(parts.status ? [parts.status] : []),
                    builder.div(
                      [builder.Style({ display: 'flex', gap: '6px', 'flex-wrap': 'wrap' })],
                      parts.controls,
                    ),
                    ...(parts.reason ? [parts.reason] : []),
                  ],
                }),
                ...(scrubberContext
                  ? [
                      zlozEditionScrubber(h, scrubberContext, seekInput, {
                        attributes: [
                          h.Class('workbench-edition-scrubber'),
                          h.Style({ padding: '12px 0', display: 'grid', gap: '8px' }),
                        ],
                        renderInput: (context, builder, onSeek) =>
                          zlozEditionScrubberInput(builder, context, onSeek, [
                            builder.Style({ width: '100%', 'accent-color': 'var(--blue)' }),
                          ]),
                        renderReadout: (context, builder) =>
                          zlozEditionScrubberReadout(
                            builder,
                            context,
                            [
                              builder.Style({
                                display: 'block',
                                'font-weight': '600',
                                'font-size': '12px',
                              }),
                            ],
                            [builder.span([builder.AriaHidden(true)], ['◇ ']), context.valueText],
                          ),
                        renderOpen: (context, builder, onSeek) =>
                          zlozEditionSeekButton(builder, context, onSeek, [
                            builder.Style({
                              'justify-self': 'start',
                              padding: '7px 12px',
                              'border-radius': '999px',
                              border: '1px solid var(--rule)',
                              background: 'var(--panel)',
                              color: 'var(--ink)',
                            }),
                          ]),
                      }),
                    ]
                  : []),
                h.label(
                  [h.Class('workbench-field')],
                  [
                    'Edition interval',
                    h.select(
                      [
                        h.AriaLabel('Edition interval'),
                        h.Value(String(playback.intervalMs)),
                        h.OnChange((value) =>
                          Message.SelectedPlaybackInterval({ intervalMs: Number(value) }),
                        ),
                      ],
                      [
                        h.option([h.Value('1000')], ['1 second']),
                        h.option([h.Value('2000')], ['2 seconds']),
                        h.option([h.Value('4000')], ['4 seconds']),
                      ],
                    ),
                  ],
                ),
                h.p(
                  [],
                  [
                    'Automatic playback pauses for reduced motion, hidden pages and manual inspection. Previous, Next and Rewind remain available. Ghost controls below remain yours.',
                  ],
                ),
              ]
            : []),
        ],
      ),
      h.p([h.AriaLabel('Active model')], [`Model: ${model.modelIdentity.name}`]),
      ...(model.modelIdentity.origin
        ? [
            h.p(
              [h.AriaLabel('Model lineage')],
              [
                `Forked from ${model.modelIdentity.origin.modelName} · ${model.modelIdentity.origin.edition.name}`,
              ],
            ),
          ]
        : []),
      h.label(
        [h.Class('workbench-field')],
        [
          'Working model',
          h.select(
            [
              h.AriaLabel('Working model'),
              h.Value(model.modelIdentity.id),
              h.Disabled(busyModelSession),
              h.OnChange((id) => Message.SelectedWorkingModel({ id })),
            ],
            [
              h.option([h.Value(model.modelIdentity.id)], [model.modelIdentity.name]),
              ...model.savedModels.map((item) =>
                h.option([h.Value(item.identity.id)], [item.identity.name]),
              ),
            ],
          ),
        ],
      ),
      h.label(
        [h.Class('workbench-field')],
        [
          'New model name',
          h.input([
            h.AriaLabel('New model name'),
            h.Value(model.forkName),
            h.OnInput((name) => Message.ChangedForkName({ name })),
          ]),
        ],
      ),
      h.label(
        [h.Class('workbench-field')],
        [
          h.input([
            h.Type('checkbox'),
            h.Checked(model.protectEditionFork),
            h.OnClick(Message.ClickedEditionForkProtection()),
          ]),
          'Protect edition forking',
        ],
      ),
      ...(model.protectEditionFork
        ? [h.p([h.Role('status')], ['Edition forking is protected in this workspace.'])]
        : []),
      button(
        'Fork edition',
        Message.ClickedForkEdition(),
        !selectedEdition || !model.forkName.trim() || busyModelSession || model.protectEditionFork,
      ),
      h.p(
        [],
        [
          'Creates a separate editable model with its own Undo. The source stays available in Working model.',
        ],
      ),
      button('Export model with lineage', Message.ClickedExportModel()),
      h.label(
        [h.Class('workbench-field')],
        [
          h.input([
            h.Type('checkbox'),
            h.Checked(model.protectModelImport),
            h.OnClick(Message.ClickedModelImportProtection()),
          ]),
          'Protect model import',
        ],
      ),
      h.label(
        [h.Class('workbench-field')],
        [
          'Open model JSON (up to 5 MiB)',
          h.input([
            h.Key(`model-import-${model.modelImport?.id ?? 'ready'}`),
            h.Type('file'),
            h.Accept('application/json,.json'),
            h.AriaLabel('Open model JSON'),
            h.Disabled(busyModelSession || model.protectModelImport),
            h.OnFileChange((files) => Message.ChoseModelDocumentFiles({ files })),
          ]),
        ],
      ),
      ...(model.modelImport
        ? [
            h.p([h.Role('status')], ['Reading model document…']),
            button('Cancel model import', Message.ClickedCancelModelImport()),
          ]
        : []),

      h.p(
        [],
        [
          'Models are kept in this tab. Export and reopen model JSON to preserve identity, editions and origin. Diagram-only files omit this metadata.',
        ],
      ),
      h.p(
        [h.Role('status'), h.AriaLabel('History mode')],
        [
          model.historyReview
            ? `Read-only edition: ${selectedEdition?.name ?? ''}. Working model preserved.`
            : 'Present · editable working model',
        ],
      ),
      h.label(
        [h.Class('workbench-field')],
        [
          'Edition name',
          h.input([
            h.AriaLabel('Edition name'),
            h.Value(model.editionName),
            h.Disabled(model.historyReview !== null),
            h.OnInput((name) => Message.ChangedEditionName({ name })),
          ]),
        ],
      ),
      button(
        'Capture edition',
        Message.ClickedCaptureEdition(),
        !model.editionName.trim() ||
          workingEditor.gesture.type !== 'idle' ||
          model.active !== null ||
          model.importing !== null,
      ),
      button('Load Order history example', Message.ClickedOrderHistory()),
      button('Load scrubber history example', Message.ClickedScrubberHistory()),
      h.label(
        [h.Class('workbench-field')],
        [
          'Rewind to edition',
          h.select(
            [
              h.AriaLabel('Rewind to edition'),
              h.Disabled(
                model.active !== null ||
                  model.importing !== null ||
                  workingEditor.gesture.type !== 'idle',
              ),
              h.Value(model.historyReview?.editionId ?? ''),
              h.Disabled(workingEditor.gesture.type !== 'idle'),
              h.OnChange((id) =>
                id ? Message.SelectedHistoryEdition({ id }) : Message.ClickedHistoryPresent(),
              ),
            ],
            [
              h.option([h.Value('')], ['Present']),
              ...model.editions.map((edition) => h.option([h.Value(edition.id)], [edition.name])),
            ],
          ),
        ],
      ),
      button('Return to present', Message.ClickedHistoryPresent(), model.historyReview === null),
      zlozHistoryComparisonControls(
        h,
        comparisonControls,
        (request) =>
          request.type === 'BaselineSelected'
            ? Message.SelectedHistoryBaseline({ id: request.editionId ?? '' })
            : request.type === 'GhostVisibilityChanged'
              ? Message.ChangedHistoryGhostVisibility({ part: request.part, value: request.value })
              : Message.ClickedHistoryGhost({ part: request.part }),
        {
          attributes: [
            h.Style({
              display: 'grid',
              gap: '8px',
              padding: '12px',
              border: '1px solid var(--rule)',
              borderRadius: '8px',
            }),
          ],
          renderBaseline: (control, builder, onRequest) =>
            builder.label(
              [builder.Class('workbench-field')],
              ['Compare with', zlozHistoryBaselineSelect(builder, control, onRequest)],
            ),
          renderGhost: (control, builder, onRequest) =>
            builder.label(
              [
                builder.Key(control.part),
                builder.Style({ display: 'flex', gap: '8px', alignItems: 'center' }),
              ],
              [zlozHistoryGhostToggle(builder, control, onRequest), control.label],
            ),
        },
      ),
      h.p(
        [],
        [
          'Dashed marks show earlier geometry; dotted marks show removals. Labels identify Added, Removed and Previous states, and arrows show movement. Ghosts are read-only and never enter the model. Minimal mode hides this layer while retaining your choices.',
        ],
      ),
      zlozHistoryChangeNavigator(
        h,
        changeNavigator,
        {
          onFilter: (kind) => Message.ClickedHistoryChangeFilter({ kind }),
          onFocus: (request) =>
            Message.ClickedHistoryChange({
              ...request,
              modelId: model.modelIdentity.id,
              epoch: model.modelEpoch,
            }),
        },
        {
          attributes: [h.Style({ display: 'grid', gap: '8px' })],
          renderStatus: () => (model.minimalMode ? null : undefined),
          renderFilter: (control, builder, onFilter) =>
            builder.label(
              [builder.Key(control.kind), builder.Style({ display: 'flex', gap: '8px' })],
              [zlozHistoryChangeFilter(builder, control, onFilter), control.label],
            ),
          renderEntry: (entry, builder, onFocus) =>
            builder.li(
              [builder.Key(`${entry.entity}:${entry.id}`)],
              [
                zlozHistoryChangeButton(
                  builder,
                  entry,
                  onFocus,
                  [
                    builder.Style({
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px',
                      marginBottom: '4px',
                    }),
                  ],
                  [
                    builder.span([builder.Style({ fontWeight: '650' })], [entry.kind]),
                    ` ${entry.entity}: ${entry.label}`,
                    builder.small(
                      [builder.Style({ display: 'block' })],
                      [
                        entry.semanticChanged && entry.layoutChanged
                          ? 'Model + layout'
                          : entry.semanticChanged
                            ? 'Model'
                            : 'Layout',
                      ],
                    ),
                    ...(entry.reason ? [builder.span([], [` · ${entry.reason}`])] : []),
                  ],
                ),
              ],
            ),
        },
      ),
      h.label(
        [h.Class('workbench-field')],
        [
          'Import edition archive (up to 5 MiB)',
          h.input([
            h.Key(`edition-import-${model.editionImport?.id ?? 'ready'}`),
            h.Type('file'),
            h.Accept('.json,application/json'),
            h.AriaLabel('Import edition archive'),
            h.OnFileChange((files) => Message.ChoseEditionArchiveFiles({ files })),
          ]),
        ],
      ),
      ...(model.editionImport
        ? [
            h.p([h.Role('status')], ['Reading edition archive…']),
            button('Cancel archive import', Message.ClickedCancelEditionImport()),
          ]
        : []),
      h.label(
        [h.Class('workbench-field')],
        [
          h.input([
            h.Type('checkbox'),
            h.Checked(model.protectEditionRestore),
            h.OnClick(Message.ClickedEditionRestoreProtection()),
          ]),
          'Protect edition restore',
        ],
      ),
      button(
        'Preview edition restore',
        Message.ClickedPreviewEditionRestore(),
        !selectedEdition || model.editionImport !== null,
      ),
      ...(model.editionRestore && restoreDecision
        ? [
            h.section(
              [h.AriaLabel('Edition restore preview')],
              [
                h.h3([], [`Restore ${model.editionRestore.edition.name}`]),
                h.p(
                  [],
                  [
                    'The canvas shows this edition. Restoring replaces the working graph as one undoable change. Your camera stays unchanged.',
                  ],
                ),
                ...(restoreComparison
                  ? [
                      h.ul(
                        [h.AriaLabel('Restore changes')],
                        [
                          ...restoreComparison.nodes.map((change) =>
                            h.li([], [`${change.kind}: ${(change.after ?? change.before).label}`]),
                          ),
                          ...restoreComparison.edges.map((change) =>
                            h.li(
                              [],
                              [
                                `${change.kind} connection: ${(change.after ?? change.before).label ?? change.id}`,
                              ],
                            ),
                          ),
                        ],
                      ),
                    ]
                  : []),
                ...(restoreDecision.type === 'blocked'
                  ? [
                      h.p(
                        [h.Role('status'), h.AriaLabel('Restore protection reason')],
                        [restoreDecision.reason],
                      ),
                    ]
                  : []),
                button(
                  'Restore as new change',
                  Message.ClickedConfirmEditionRestore(),
                  restoreDecision.type !== 'ready' || model.editionImport !== null,
                ),
                button('Cancel restore', Message.ClickedCancelEditionRestore()),
              ],
            ),
          ]
        : []),
      button('Export editions', Message.ClickedExportEditions(), model.editions.length === 0),
      h.p(
        [],
        [
          'Import adds editions without replacing your working graph. Identical editions are skipped; conflicting identities reject the whole import. Editions remain session-owned until exported. Restore requires an explicit preview and confirmation; forks preserve the original model and playback is a later slice.',
        ],
      ),
    ],
    diagram: [
      h.div(
        [h.Role('group'), h.AriaLabel('Insert architecture patterns')],
        [
          h.p(
            [],
            [
              'Add a pattern beside your diagram. Existing content stays; each insertion is one Undo step.',
            ],
          ),
          h.label(
            [],
            [
              h.input([
                h.Type('checkbox'),
                h.Checked(model.protectPatternInsertion),
                h.OnClick(Message.ClickedPatternInsertionProtection()),
              ]),
              'Protect pattern insertion',
            ],
          ),
          button(
            'Insert C4 context pattern',
            Message.ClickedInsertPattern({ pattern: 'c4-context' }),
            insertionReason !== null,
          ),
          button(
            'Insert DDD aggregate pattern',
            Message.ClickedInsertPattern({ pattern: 'ddd-aggregate' }),
            insertionReason !== null,
          ),
          button(
            'Insert event-storming pattern',
            Message.ClickedInsertPattern({ pattern: 'event-storming' }),
            insertionReason !== null,
          ),
          ...(insertionReason === null
            ? []
            : [
                h.p(
                  [h.Role('status'), h.AriaLabel('Pattern insertion protection reason')],
                  [insertionReason!],
                ),
              ]),
        ],
      ),
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
                button(
                  'Open event-storming example',
                  Message.SelectedExample({ example: 'event-storming' }),
                ),
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
                button(
                  'Open DDD Order aggregate',
                  Message.SelectedExample({ example: 'ddd-orders' }),
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
                button(
                  'Undo',
                  observedInput({ message: { type: 'UndoPressed' } }),
                  model.editor.past.length === 0,
                ),
                button(
                  'Redo',
                  observedInput({ message: { type: 'RedoPressed' } }),
                  model.editor.future.length === 0,
                ),
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
                    h.OnClick(observedInput({ message: { type: 'GridSnapToggled' } })),
                  ],
                  ['Snap to grid'],
                ),
                h.button(
                  [
                    h.Type('button'),
                    h.AriaPressed(String(model.editor.snapToAlignment)),
                    h.Disabled(model.editor.readOnly || model.editor.gesture.type !== 'idle'),
                    h.OnClick(observedInput({ message: { type: 'AlignmentSnapToggled' } })),
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
                        h.option([h.Value(value), h.Selected(model.background === value)], [label]),
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
                              observedInput({
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
                button('Group selection', observedInput({ message: { type: 'SelectionGrouped' } })),
                button('Ungroup', observedInput({ message: { type: 'SelectionUngrouped' } })),
                ...(selectedNode?.kind === 'group'
                  ? [
                      button(
                        'Fit group to contents',
                        observedInput({
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
                          h.Disabled(model.editor.readOnly || model.editor.gesture.type !== 'idle'),
                          h.OnClick(
                            observedInput({
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
                          h.Disabled(model.editor.readOnly || model.editor.gesture.type !== 'idle'),
                          h.OnClick(
                            observedInput({
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
                          h.Disabled(model.editor.readOnly || model.editor.gesture.type !== 'idle'),
                          h.OnClick(
                            observedInput({
                              message: { type: 'NodeExpansionToggled', id: selectedNode.id },
                            }),
                          ),
                        ],
                        ['Grow parent'],
                      ),
                    ]
                  : []),
                button('Copy', observedInput({ message: { type: 'CopyPressed' } })),
                button('Paste', observedInput({ message: { type: 'PastePressed' } })),
                button('Duplicate', observedInput({ message: { type: 'DuplicatePressed' } })),
                button(
                  'Undo',
                  observedInput({ message: { type: 'UndoPressed' } }),
                  model.editor.past.length === 0,
                ),
                button(
                  'Redo',
                  observedInput({ message: { type: 'RedoPressed' } }),
                  model.editor.future.length === 0,
                ),
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
                button('Delete selected', observedInput({ message: { type: 'DeletePressed' } })),
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
                        h.OnClick(zlozInput(event)),
                      ],
                      [label],
                    ),
                  ),
              ]
            : []),
        ],
      ),
      ...(model.nodeDesign === 'event-storming'
        ? [
            h.div(
              [h.Role('group'), h.AriaLabel('Event-storming relationships')],
              [
                h.h2([], ['Causal relationships']),
                h.label(
                  [h.Class('workbench-field')],
                  [
                    'Inspect relationship',
                    h.select(
                      [
                        h.AriaLabel('Inspect relationship'),
                        h.Value(selectedEdge?.id ?? ''),
                        h.OnChange((id) =>
                          zlozInput(
                            id
                              ? { type: 'EdgeSelected', id, additive: false }
                              : { type: 'SelectionCleared' },
                          ),
                        ),
                      ],
                      [
                        h.option([h.Value('')], ['Choose a connection']),
                        ...model.editor.graph.edges.map((edge) =>
                          h.option([h.Value(edge.id)], [edge.label || edge.id]),
                        ),
                      ],
                    ),
                  ],
                ),
                h.p(
                  [h.Role('status'), h.AriaLabel('Relationship edit feedback')],
                  [model.editor.notice],
                ),
                h.p(
                  [h.AriaLabel('Event-storming role legend')],
                  [
                    'Actor · Command · Aggregate · Domain Event · Policy. These are editable modelling conventions, not executable business rules.',
                  ],
                ),
                h.label(
                  [h.Class('workbench-field')],
                  [
                    h.input([
                      h.Type('checkbox'),
                      h.Checked(model.semanticRelationships),
                      h.Disabled(model.historyReview !== null),
                      h.OnClick(Message.ClickedSemanticRelationships()),
                    ]),
                    'Validate causal relationships',
                  ],
                ),
                h.label(
                  [h.Class('workbench-field')],
                  [
                    h.input([
                      h.Type('checkbox'),
                      h.Checked(model.customStormingRelationships),
                      h.Disabled(model.historyReview !== null),
                      h.OnClick(Message.ClickedCustomStormingRelationships()),
                    ]),
                    'Enable custom Delegates convention',
                  ],
                ),
                h.p(
                  [],
                  [
                    'The custom convention permits command → command links. Changing conventions never rewrites existing models.',
                  ],
                ),
                button(
                  'Add delegated command connection',
                  Message.ClickedDelegatedRelationship({
                    modelId: model.modelIdentity.id,
                    epoch: model.modelEpoch,
                  }),
                  !delegatedRelationship(model),
                ),
                h.ul(
                  [h.AriaLabel('Causal relationship report')],
                  model.editor.graph.edges.map((edge) => {
                    const decision = resolveEventStormingRelationship(
                      model.editor.graph,
                      edge,
                      workbenchRelationshipOptions(model),
                    );
                    return h.li(
                      [h.Key(edge.id)],
                      [
                        h.strong([], [edge.label || edge.id]),
                        ' · ',
                        decision.type === 'allowed'
                          ? `${decision.rule.label} (${decision.inferred ? 'inferred' : 'typed'})`
                          : decision.type === 'blocked'
                            ? decision.reason
                            : 'Unrelated connection',
                      ],
                    );
                  }),
                ),
                zlozEventStormingRelationshipControls(
                  h,
                  relationshipControls,
                  (request) =>
                    request.type === 'RelationshipSelected'
                      ? Message.SelectedCausalRelationship({
                          edgeId: request.edgeId,
                          key: request.key,
                          modelId: model.modelIdentity.id,
                          epoch: model.modelEpoch,
                        })
                      : Message.ClickedRelationshipInference({
                          edgeId: request.edgeId,
                          modelId: model.modelIdentity.id,
                          epoch: model.modelEpoch,
                        }),
                  {
                    attributes: [
                      h.Style({
                        padding: '12px',
                        border: '1px solid var(--rule)',
                        borderRadius: '8px',
                        display: 'grid',
                        gap: '8px',
                      }),
                    ],
                    renderSelect: (context, builder, onRequest) =>
                      builder.label(
                        [builder.Class('workbench-field')],
                        [
                          context.label,
                          zlozEventStormingRelationshipSelect(builder, context, onRequest),
                        ],
                      ),
                    renderInference: (action, builder, onRequest) =>
                      zlozEventStormingRelationshipInference(
                        builder,
                        action,
                        onRequest,
                        [builder.Style({ padding: '8px' })],
                        [action.label],
                      ),
                    renderStatus: (context, builder) =>
                      zlozEventStormingRelationshipStatus(
                        builder,
                        context,
                        [],
                        [builder.strong([], ['Semantic contract · ']), context.statusText],
                      ),
                  },
                ),
                button(
                  'Open connection tools',
                  Message.SelectedWorkbenchSection({ section: 'ports' }),
                ),
                ...(selectedEdge && incompatibleRelationship
                  ? [
                      button(
                        'Try incompatible relationship',
                        zlozInput({
                          type: 'EdgeArchitectureChanged',
                          id: selectedEdge.id,
                          architecture: incompatibleRelationship,
                        }),
                        relationshipEditingBlocked,
                      ),
                    ]
                  : []),
              ],
            ),
          ]
        : []),
      ...(model.nodeDesign === 'ddd'
        ? [
            h.div(
              [h.Class('ddd-diagram-caption')],
              [
                h.h2([], ['Ordering · domain model']),
                h.p(
                  [],
                  [
                    'Package-owned DDD presets. The aggregate is a portless boundary; connections belong to its nodes. Labels describe this example, not enforced business rules.',
                  ],
                ),
                h.ul(
                  [h.AriaLabel('DDD role legend')],
                  architectureNodePresets
                    .filter((preset) => preset.architecture.family === 'ddd')
                    .map((preset) => h.li([], [preset.label])),
                ),
              ],
            ),
          ]
        : []),
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
    ],
    appearance: [
      h.label(
        [h.Class('workbench-field')],
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
                [h.Value('event-storming'), h.Selected(model.nodeDesign === 'event-storming')],
                ['Event-storming · package notes'],
              ),
              h.option(
                [h.Value('ddd'), h.Selected(model.nodeDesign === 'ddd')],
                ['DDD · package presets'],
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
        [h.Class('workbench-field')],
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
        [h.Class('workbench-field')],
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
        [h.Class('workbench-field')],
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
        [h.Class('workbench-field')],
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
        [h.Class('workbench-field')],
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
        [h.Class('workbench-field')],
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
        [h.Class('workbench-field')],
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
        [h.Class('workbench-field')],
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
        [h.Class('workbench-field')],
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
        [h.Class('workbench-field')],
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
        [h.Class('workbench-field')],
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
    ],
    navigation: [
      h.label(
        [h.Class('workbench-field')],
        [
          'Box selection match',
          h.select(
            [
              h.AriaLabel('Box selection match'),
              h.Value(model.editor.boxSelectionMatch),
              h.Disabled(model.editor.gesture.type !== 'idle'),
              h.OnChange((value) =>
                observedInput({
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
        [h.Class('workbench-field')],
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
        [h.Class('workbench-field')],
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
        [h.Class('workbench-field')],
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
        [h.Class('workbench-field')],
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
        [h.Class('workbench-field')],
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
        [h.Class('workbench-field')],
        [
          h.input([
            h.Type('checkbox'),
            h.Checked(model.editor.fitViewPadding === 96),
            h.Disabled(model.editor.gesture.type !== 'idle'),
            h.OnClick(
              observedInput({
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
        [h.Class('workbench-field')],
        [
          h.input([
            h.Type('checkbox'),
            h.Checked(model.editor.fitViewDuration > 0),
            h.OnClick(
              observedInput({
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
    ],
    ports: [
      h.label(
        [h.Class('workbench-field')],
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
        [h.Class('workbench-field')],
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
        [h.Class('workbench-field')],
        [
          h.input([
            h.Type('checkbox'),
            h.Checked((model.editor.connectionSnapHysteresis ?? 0) > 0),
            h.Disabled(model.editor.gesture.type !== 'idle'),
            h.OnClick(
              observedInput({
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
        [h.Class('workbench-field')],
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
        [h.Class('workbench-field')],
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
        [h.Class('workbench-field')],
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
        [h.Class('workbench-field')],
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
        [h.Class('workbench-field')],
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
        [h.Class('workbench-field')],
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
        [h.Class('workbench-field')],
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
        [h.Class('workbench-field')],
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
        [h.Class('workbench-field')],
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
        [h.Class('workbench-field')],
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
        [h.Class('workbench-field')],
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
        [h.Class('workbench-field')],
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
        [h.Class('workbench-field')],
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
        [h.Class('workbench-field')],
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
        [h.Class('workbench-field')],
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
        [h.Class('workbench-field')],
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
                [h.Value('cardinal'), h.Selected(currentPreset(model.editor.graph) === 'cardinal')],
                ['Cardinal'],
              ),
              h.option(
                [h.Value('diagonal'), h.Selected(currentPreset(model.editor.graph) === 'diagonal')],
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
    ],
    policies: [
      h.label(
        [h.Class('workbench-field')],
        [
          h.input([
            h.Type('checkbox'),
            h.Checked(model.semanticRelationships),
            h.Disabled(model.historyReview !== null),
            h.OnClick(Message.ClickedSemanticRelationships()),
          ]),
          'Validate causal relationships',
        ],
      ),
      h.label(
        [h.Class('workbench-field')],
        [
          h.input([
            h.Type('checkbox'),
            h.Checked(model.customStormingRelationships),
            h.Disabled(model.historyReview !== null),
            h.OnClick(Message.ClickedCustomStormingRelationships()),
          ]),
          'Enable custom Delegates convention',
        ],
      ),
      h.p(
        [],
        [
          'Causal conventions are opt-in and independent of node artwork. Disable validation here to keep unresolved workshop drafts.',
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
    ],
    inspect: [
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
                          observedInput({
                            message: {
                              type: 'EdgePathStyleChanged',
                              id: selectedEdge.id,
                              pathStyle:
                                edgePathOptions.find(({ style }) => style === value)?.style ?? null,
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
                  observedInput({
                    message: { type: 'EdgeDataChanged', id: selectedEdge.id, data: 'solid' },
                  }),
                ),
                button(
                  'Dashed edge',
                  observedInput({
                    message: { type: 'EdgeDataChanged', id: selectedEdge.id, data: 'dashed' },
                  }),
                ),
              ],
            ),
          ]
        : []),
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
                      zlozPortAddButton(
                        h,
                        addition,
                        Message.ClickedAddPort({ nodeId: inspector.node.id, kind }),
                        [h.Style({ padding: '10px 16px', cursor: 'pointer' })],
                        ['Add ' + kind + ' port'],
                      ),
                      ...(addition.control.reason !== null
                        ? [zlozPortProtectionReason(h, addition.control, [h.Style(reasonStyle)])]
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
                            zlozPortLabelForm(
                              h,
                              labelMessages,
                              [h.Style({ display: 'flex', gap: '4px', 'flex-wrap': 'wrap' })],
                              [
                                zlozPortLabelInput(
                                  h,
                                  entry,
                                  draft.text,
                                  (text) => Message.ChangedPortLabelDraft({ text }),
                                  [h.Placeholder('Defaults to port ID')],
                                ),
                                zlozPortLabelSave(h, entry, [], ['Save port label']),
                                zlozPortLabelCancel(
                                  h,
                                  labelMessages.cancelled,
                                  [h.Style({ padding: '10px 16px', cursor: 'pointer' })],
                                  ['Cancel port label'],
                                ),
                              ],
                            ),
                          ]
                        : [
                            zlozPortLabelEditButton(
                              h,
                              entry,
                              Message.ClickedEditPortLabel({ nodeId: node.id, portId: port.id }),
                              [],
                              ['Edit label'],
                            ),
                          ]),
                      ...(positionEditor
                        ? [
                            zlozPortPositionForm(
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
                                    zlozPortPositionModeSelect(
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
                                    zlozPortPositionSideSelect(
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
                                      zlozPortPositionInput(
                                        h,
                                        positionEditor,
                                        input,
                                        positionChanged,
                                        [h.Style({ width: '88px' })],
                                      ),
                                    ],
                                  ),
                                ),
                                zlozPortPositionSave(h, positionEditor, [], ['Save position']),
                                zlozPortPositionCancel(
                                  h,
                                  positionMessages.cancelled,
                                  [],
                                  ['Cancel position'],
                                ),
                              ],
                            ),
                          ]
                        : [
                            zlozPortPositionEditButton(
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
                      zlozPortRemoveButton(h, entry, zlozInput, [], ['Remove port']),
                      ...entry.reasons.map((reason) =>
                        zlozPortProtectionReason(h, reason, [h.Style(reasonStyle)]),
                      ),
                    ],
                  );
                }),
              ],
            ),
          ]
        : []),
    ],
    diagnostics: [
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
    ],
    export: [...(model.mermaidPreviewOpen ? [mermaidExportPanel(model, h)] : [])],
  };
  const themePicker = h.label(
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
  );
  const notice = h.p(
    [h.Role('status'), h.AriaLive('polite'), ...(diagnostics.status ? [] : [h.Style(hidden)])],
    [model.notice],
  );
  return {
    title,
    body: h.div(
      [h.Class('flow-workbench'), h.DataAttribute('flow-workbench-color-scheme', colorScheme)],
      [
        zlozView(h, model.editor, {
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
              ? zlozPortAnchorHandle(
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
            zlozPortLabel(
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
              zlozViewportControl(
                builder,
                action,
                (event) => observedInput({ message: event }),
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
            return zlozMinimap(
              builder,
              context,
              (event) => observedInput({ message: event }),
              [
                builder.Style({
                  position: 'relative',
                  width: '100%',
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
                zlozMinimapViewport(builder, context.geometry, [
                  builder.Fill('none'),
                  builder.Stroke('#ea580c'),
                  builder.Style({ 'vector-effect': 'non-scaling-stroke' }),
                ]),
              ],
            );
          },
          height: 'fill',
          renderLayout: (parts, builder) =>
            workbenchLayout(builder, model, parts, controls, themePicker, notice),
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
            builder.div(
              [],
              [
                ...(model.showWorldAnnotation && !model.historyReview
                  ? [releaseGateAnnotation(context, builder)]
                  : []),
                ...(comparison && model.historyReview && comparisonControls.effectiveGhosts.enabled
                  ? [zlozHistoryGhosts(builder, comparison, comparisonControls.effectiveGhosts)!]
                  : []),
              ],
            ),
          renderNodeShell: model.historyReview
            ? historyNode
            : model.nodeDesign === 'orbits'
              ? model.retainNodeViews
                ? retainedOrbitNode
                : orbitNode
              : model.nodeDesign === 'c4'
                ? model.retainNodeViews
                  ? retainedC4Node
                  : (context, builder) =>
                      zlozEventStormingNode(context, builder) ??
                      zlozC4Node(context, builder) ??
                      zlozDddNode(context, builder, dddOptionsWithoutCache)
                : model.nodeDesign === 'ddd' || model.nodeDesign === 'event-storming'
                  ? model.retainNodeViews
                    ? retainedDddNode
                    : unretainedDddNode
                  : undefined,
          renderGroupShell: (context, builder) => {
            if (model.historyReview) return historyGroup(context, builder);
            if (model.nodeDesign === 'c4')
              return model.retainNodeViews
                ? retainedC4Group(context, builder)
                : (zlozC4Group(context, builder) ??
                    zlozDddGroup(context, builder, dddOptionsWithoutCache));
            if (model.nodeDesign === 'ddd' || model.nodeDesign === 'event-storming')
              return model.retainNodeViews
                ? retainedDddGroup(context, builder)
                : (zlozDddGroup(context, builder, dddOptionsWithoutCache) ??
                    zlozC4Group(context, builder));
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
          edgeToolbar: !(
            model.nodeDesign === 'event-storming' &&
            model.sidebarSection === 'diagram' &&
            !model.sidebarCollapsed
          ),
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
          onEvent: zlozInput,
          edgeAppearance: (edge) =>
            edge.data === 'dashed' ? { dashArray: '9 5', strokeWidth: 4 } : {},
          renderNode: model.historyReview
            ? (_node, builder) => builder.span([], [])
            : model.minimalMode ||
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
                    zlozInput,
                  )
              : renderDefaultNode,
        }),
      ],
    ),
  };
}
