import {
  resolveConnectionCreation,
  resolveEdgeReconnection,
  playbackEditionId,
  resolveEditionPlaybackControls,
  resolveEditionScrubber,
  resolveHistoryComparisonControls,
  type ZlozEditionSeekRequest,
  type ZlozPlaybackControlEvent,
  captureEdition,
  compareEditions,
  resolveEditionRestore,
  type EdgePathStyle,
  type EditorEvent,
  type ZlozPlacementInput,
  type ZlozAuditComparisonRequest,
} from '@opsydyn/foldkit-zloz';
import { supportsForceLayout } from '@opsydyn/foldkit-zloz-force/eligibility';
import { zlozReviewPacketControls } from '@opsydyn/foldkit-zloz-mermaid/foldkit';
import {
  canvasHelpContext,
  canvasStatusContext,
  presentVisibleGraph,
  resolveConnectionList,
} from '@opsydyn/foldkit-zloz/effect-ui';
import {
  zlozThemeStyle,
  zlozDddRelationshipControls,
  zlozDddRelationshipPatternSelect,
  zlozDddUpstreamRole,
  zlozDddDownstreamRoleSelect,
  zlozDddRelationshipReasons,
  zlozHistoryChangeNavigator,
  zlozHistoryChangeButton,
  zlozHistoryChangeFilter,
  zlozAuditComparisonControls,
  zlozAuditEditionSelect,
  zlozAuditFindingButton,
  zlozAuditFindingFilter,
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
  resolveZlozDiagnostics,
} from '@opsydyn/foldkit-zloz/foldkit';
import { zlozPlacementHost } from '@opsydyn/foldkit-zloz/foldkit';
import { Schema } from 'effect';
import { type Document, type Html, type HtmlBuilder } from 'foldkit/html';

import { alchemyReviewPanel } from './alchemy-review';
import { workbenchAuditContext } from './audit-comparison';
import { c4MappingReviewPanel } from './c4-mapping-review-view';
import { dddAuditPanel } from './ddd-audit-view';
import { workbenchDddControls } from './ddd-relationship-controls';
import { workbenchPolicy } from './editor-policy';
import { exportReviewPanel } from './export-review';
import { historyAllowsMessage, editionRestorePolicy } from './history';
import { workbenchHistoryComparison, historyChangeNavigatorContext } from './history-navigation';
import { mappingReviewPanel } from './mapping-review-view';
import { mermaidExportPanel } from './mermaid-preview';
import { Message } from './message';
import { type Model } from './model';
import { modelSessionBusy } from './model-sessions';
import { nativeArchitectureCanvas } from './native-canvas';
import { nativeDiagramSearch, nativeExamplePicker } from './native-diagram-browse';
import { nativeCausalRelationships, nativeDiagramCaption } from './native-diagram-notation';
import { nativeConnectionCreation, nativeSelectedEndpoints } from './native-endpoints';
import { nativeGraphActions } from './native-graph-actions';
import { nativePatternInsertion } from './native-pattern-insertion';
import { nativePolicies } from './native-policies';
import { nativePortInspector } from './native-port-inspector';
import { nativePortSettings } from './native-port-settings';
import { nativeAppearanceSettings, nativeDiagnosticSettings } from './native-settings';
import { nativeCanvasHelp, nativeCanvasStatus, nativeConnections } from './native-sidebar';
import { packetReaderPanel } from './packet-reader';
import { workbenchPlacement } from './palette';
import { patchWorkbenchPanel } from './patch-review';
import { patternInsertionReason } from './pattern-insertion';
import { playbackReason, playbackInspectionReason } from './playback';
import { workbenchPngReview } from './png-review';
import { workbenchPacketContext } from './review-packet';
import { workbenchSvgReview } from './svg-review';
import { workbenchThemes } from './theme';
import { workbenchLayout, type WorkbenchControls } from './workbench-layout';
import { workshopPanel } from './workshop-view';

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
  const packetControls = model.sidebarSection === 'history' ? workbenchPacketContext(model) : null;
  const dddPanel = model.sidebarSection === 'history' ? dddAuditPanel(model, h) : null;
  const auditControls = model.sidebarSection === 'history' ? workbenchAuditContext(model) : null;
  const auditRequest = (request: ZlozAuditComparisonRequest) =>
    Message.ObservedAuditComparisonInput({
      request,
      modelId,
      epoch,
    });
  const workshopInspector = model.sidebarSection === 'inspect' ? workshopPanel(model, h) : null;
  const mappingPanel = model.sidebarSection === 'mapping' ? mappingReviewPanel(model, h) : null;
  const busyModelSession = modelSessionBusy(model);
  if (model.historyReview) model = { ...model, editor: model.historyReview.editor };
  const title = 'Architecture workbench | ZLOZ';
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
  const selectedNode =
    model.editor.selectedNodes.length === 1
      ? model.editor.graph.nodes.find((node) => node.id === model.editor.selectedNodes[0])
      : undefined;
  const selectedEdge = model.editor.graph.edges.find((edge) =>
    model.editor.selectedEdges.includes(edge.id),
  );
  const policy = workbenchPolicy(model);
  const dddControls = workbenchDddControls(model);
  const hasDddNodes = model.editor.graph.nodes.some((node) => node.architecture?.family === 'ddd');
  const dddInspectorVisible =
    hasDddNodes && model.sidebarSection === 'inspect' && !model.sidebarCollapsed;
  const placementControls = workbenchPlacement(model);
  const showEdgeToolbar =
    !dddInspectorVisible &&
    !(
      model.nodeDesign === 'event-storming' &&
      model.sidebarSection === 'diagram' &&
      !model.sidebarCollapsed
    );
  const nativeCanvas = nativeArchitectureCanvas(
    h,
    {
      model,
      policy,
      placement: placementControls,
      scheme: colorScheme,
      measurements: diagnostics.measurements,
      alignmentGuides: diagnostics.alignmentGuides,
      edgeToolbar: showEdgeToolbar,
      history: { comparison, ghosts: comparisonControls.effectiveGhosts },
    },
    'architecture-effect-ui',
    'working-canvas',
  );
  const placementInput = (input: ZlozPlacementInput) => Message.ObservedPlacementInput({ input });
  const endpointScope = { modelId, epoch, queries: model.portChooserQueries };
  const endpointFields =
    selectedEdge &&
    !model.minimalMode &&
    model.sidebarSection === 'inspect' &&
    !model.sidebarCollapsed
      ? (['source', 'target'] as const).flatMap((end) => {
          const field = resolveEdgeReconnection(model.editor, selectedEdge.id, end, policy);
          return field ? [field] : [];
        })
      : [];
  const controls: WorkbenchControls = {
    alchemy: [alchemyReviewPanel(model, h)],
    review: packetReaderPanel(model, h),
    patch: patchWorkbenchPanel(model, h),
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
      button('Load causal audit example', Message.ClickedAuditExample()),
      h.h3([], ['Portable review']),
      ...(packetControls
        ? [
            zlozReviewPacketControls(
              h,
              packetControls,
              (request) => Message.ObservedReviewPacketInput({ request, modelId, epoch }),
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
                showCounts: !model.minimalMode && model.diagnosticsEnabled,
                renderStatus: () =>
                  model.minimalMode || !model.diagnosticsEnabled ? null : undefined,
                renderScope: (context, builder) =>
                  builder.div(
                    [],
                    [
                      builder.strong([], ['Selected snapshots only']),
                      builder.p([builder.AriaLabel('Review packet scope')], [context.scopeText]),
                    ],
                  ),
                renderLayout: (parts, _context, builder) => [
                  ...[parts.scope, parts.status].filter((item): item is Html => item !== null),
                  ...(parts.diagnostics.length
                    ? [
                        builder.details(
                          [],
                          [
                            builder.summary([], ['Inspect projection losses']),
                            builder.ul(
                              [
                                builder.AriaLabel('Review packet diagnostics'),
                                builder.Style({
                                  maxHeight: '220px',
                                  overflow: 'auto',
                                  padding: '0',
                                  margin: '8px 0',
                                }),
                              ],
                              parts.diagnostics,
                            ),
                          ],
                        ),
                      ]
                    : []),
                  ...[parts.consent, parts.reason, parts.download].filter(
                    (item): item is Html => item !== null,
                  ),
                ],
                renderDiagnostic: (item, builder) =>
                  builder.li(
                    [
                      builder.Style({
                        listStyle: 'none',
                        padding: '8px',
                        marginBottom: '4px',
                        borderLeft: '3px solid var(--rule)',
                        background: 'var(--panel)',
                      }),
                    ],
                    [
                      builder.strong(
                        [],
                        [
                          item.side === 'baseline'
                            ? 'Baseline'
                            : item.side === 'selected'
                              ? 'Target'
                              : 'Packet',
                        ],
                      ),
                      ` · ${item.severity}${item.subject ? ` · ${item.subject}` : ''}`,
                      builder.p([], [item.message]),
                    ],
                  ),
              },
            ),
          ]
        : []),
      ...(dddPanel ? [dddPanel] : []),
      h.h3([], ['Causal findings']),
      h.p(
        [],
        [
          'Compare semantic findings independently of the visible edition. Resolved findings open the baseline; introduced and persisting findings open the target.',
        ],
      ),
      ...(auditControls
        ? [
            zlozAuditComparisonControls(h, auditControls, auditRequest, {
              attributes: [
                h.Style({
                  display: 'grid',
                  gap: '8px',
                  padding: '12px',
                  border: '1px solid var(--rule)',
                  borderRadius: '8px',
                }),
              ],
              showCounts: !model.minimalMode && model.diagnosticsEnabled,
              renderStatus: () =>
                model.minimalMode || !model.diagnosticsEnabled ? null : undefined,
              renderBaseline: (control, builder, onRequest) =>
                builder.label(
                  [builder.Class('workbench-field')],
                  [control.label, zlozAuditEditionSelect(builder, control, onRequest)],
                ),
              renderTarget: (control, builder, onRequest) =>
                builder.label(
                  [builder.Class('workbench-field')],
                  [control.label, zlozAuditEditionSelect(builder, control, onRequest)],
                ),
              renderFilter: (control, builder, onRequest) =>
                builder.label(
                  [
                    builder.Key(control.kind),
                    builder.Style({ display: 'flex', gap: '8px', alignItems: 'center' }),
                  ],
                  [
                    zlozAuditFindingFilter(builder, control, onRequest),
                    control.label,
                    ...(!model.minimalMode && model.diagnosticsEnabled
                      ? [` · ${control.count}`]
                      : []),
                  ],
                ),
              renderEntry: (entry, builder, onRequest) =>
                builder.li(
                  [
                    builder.Key(`${entry.kind}:${entry.finding.edgeId}:${entry.finding.code}`),
                    builder.Style({ listStyle: 'none', marginBottom: '8px' }),
                  ],
                  [
                    zlozAuditFindingButton(
                      builder,
                      entry,
                      onRequest,
                      [
                        builder.Style({
                          width: '100%',
                          textAlign: 'left',
                          padding: '10px',
                          border: '1px solid var(--rule)',
                          borderRadius: '6px',
                          background: 'var(--panel)',
                        }),
                      ],
                      [
                        builder.strong(
                          [builder.Style({ display: 'block', textTransform: 'capitalize' })],
                          [entry.kind],
                        ),
                        builder.span([], [entry.label]),
                        builder.small(
                          [builder.Style({ display: 'block' })],
                          [entry.source.kind === 'current' ? 'Current graph' : entry.source.name],
                        ),
                      ],
                    ),
                    builder.small(
                      [builder.Style({ display: 'block', padding: '4px 0' })],
                      [entry.finding.message],
                    ),
                    ...(entry.reason ? [builder.p([], [entry.reason])] : []),
                  ],
                ),
            }),
          ]
        : []),
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
          'Import adds editions without replacing your working graph. Identical editions are skipped; conflicting identities reject the whole import. Editions remain session-owned until exported. Restore requires an explicit preview and confirmation; forks preserve the original model. Playback uses read-only editions.',
        ],
      ),
    ],
    png:
      model.sidebarSection === 'png' && !model.sidebarCollapsed
        ? [
            h.label(
              [],
              [
                h.input([
                  h.Type('checkbox'),
                  h.Checked(model.retainedPngLayout),
                  h.OnClick(Message.ClickedRetainedPngLayout()),
                ]),
                'Use retained layout in PNG',
              ],
            ),
            h.p(
              [],
              [
                model.retainedPngLayout
                  ? model.editor.routes.length > 0
                    ? 'Retained routes are included. PNG still flattens vector and label artwork.'
                    : 'Arrange with ELK before reviewing retained routes.'
                  : 'Canonical PNG geometry is selected. SVG has its own setting.',
              ],
            ),
            h.label(
              [],
              [
                h.input([
                  h.Type('checkbox'),
                  h.Checked(model.protectPngDownloads),
                  h.OnClick(Message.ClickedPngProtection()),
                ]),
                'Protect PNG exports',
              ],
            ),
            button(
              model.customPngReview ? 'Use native PNG controls' : 'Use custom PNG controls',
              Message.ClickedCustomPngReview(),
            ),
            exportReviewPanel(h, {
              kind: 'png',
              controls: workbenchPngReview(model),
              custom: model.customPngReview,
              diagnostics,
            }),
          ]
        : [],
    svg:
      model.sidebarSection === 'svg' && !model.sidebarCollapsed
        ? [
            h.p([], ['Canonical model artwork, with visible portability and fidelity findings.']),
            h.label(
              [],
              [
                h.input([
                  h.Type('checkbox'),
                  h.Checked(model.retainedSvgLayout),
                  h.OnClick(Message.ClickedRetainedSvgLayout()),
                ]),
                'Use retained layout in SVG',
              ],
            ),
            h.p(
              [],
              [
                model.retainedSvgLayout
                  ? model.editor.routes.length > 0
                    ? 'Retained routes are included. Label artwork remains subject to fidelity findings.'
                    : 'Arrange with ELK before reviewing retained routes.'
                  : 'Canonical SVG geometry is selected.',
              ],
            ),
            h.label(
              [],
              [
                h.input([
                  h.Type('checkbox'),
                  h.Checked(model.protectSvgDownloads),
                  h.OnClick(Message.ClickedSvgDownloadProtection()),
                ]),
                'Protect SVG downloads',
              ],
            ),
            button(
              model.customSvgReview ? 'Use native SVG controls' : 'Use custom SVG controls',
              Message.ClickedCustomSvgReview(),
            ),
            exportReviewPanel(h, {
              kind: 'svg',
              controls: workbenchSvgReview(model),
              custom: model.customSvgReview,
              diagnostics,
            }),
          ]
        : [],
    diagram: [
      nativePatternInsertion(
        h,
        {
          controls: placementControls,
          diagnostics,
          protected: model.protectPatternInsertion,
          history: model.historyReview !== null,
          customPalette: model.customPalette,
          reason: patternInsertionReason(model),
        },
        'architecture-effect-ui',
        'pattern-insertion',
      ),
      ...(model.sidebarSection === 'diagram' && !model.sidebarCollapsed
        ? [
            nativeExamplePicker(
              h,
              { model, showInstructions: diagnostics.instructions },
              'architecture-effect-ui',
              'examples',
            ),
          ]
        : []),
      ...(model.sidebarSection === 'diagram' && !model.sidebarCollapsed
        ? [
            nativeGraphActions(
              h,
              {
                model,
                selectedNode,
                showMeasurements: diagnostics.measurements,
                showInstructions: diagnostics.instructions,
                fitGroupDisabled:
                  selectedNode !== undefined &&
                  (policy.canResizeNode?.(selectedNode, model.editor.graph) ?? null) !== null,
                forceDisabled: !model.minimalMode && !supportsForceLayout(model.editor.graph),
              },
              'architecture-effect-ui',
              'graph-actions',
            ),
          ]
        : []),
      ...(model.sidebarSection === 'diagram' && !model.sidebarCollapsed
        ? [nativeDiagramSearch(h, model, 'architecture-effect-ui', 'diagram-search')]
        : []),
      ...(model.nodeDesign === 'event-storming'
        ? [nativeCausalRelationships(h, model, 'architecture-effect-ui', 'causal-relationships')]
        : []),
      ...(model.nodeDesign === 'ddd' || model.nodeDesign === 'c4'
        ? [
            nativeDiagramCaption(
              h,
              {
                design: model.nodeDesign,
                graph: model.editor.graph,
                contextMapPresentation: model.contextMapPresentation,
              },
              'architecture-effect-ui',
              'diagram-caption',
            ),
          ]
        : []),
    ],
    appearance:
      model.sidebarSection === 'appearance' && !model.sidebarCollapsed
        ? [nativeAppearanceSettings(h, model, 'architecture-effect-ui', 'appearance-settings')]
        : [],
    ports: [nativePortSettings(h, model, 'architecture-effect-ui', 'port-settings')],
    policies: [nativePolicies(h, model, 'architecture-effect-ui', 'policies')],
    c4mapping: model.sidebarSection === 'c4mapping' ? [c4MappingReviewPanel(model, h)] : [],
    mapping: mappingPanel ? [mappingPanel] : [],
    inspect: [
      ...(workshopInspector ? [workshopInspector] : []),
      ...(hasDddNodes
        ? [
            h.h2([], ['DDD relationship']),
            h.label(
              [h.Class('workbench-field')],
              [
                'Inspect DDD relationship',
                h.select(
                  [
                    h.AriaLabel('Inspect DDD relationship'),
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
                      h.option(
                        [h.Value(edge.id), h.Selected(edge.id === selectedEdge?.id)],
                        [edge.label || edge.id],
                      ),
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
                  h.Checked(model.protectDddRelationships),
                  h.Disabled(model.historyReview !== null || busyModelSession),
                  h.OnClick(Message.ClickedDddRelationshipProtection()),
                ]),
                'Protect Orders–Billing meaning edits',
              ],
            ),
            zlozDddRelationshipControls(
              h,
              dddControls,
              (request) => Message.ObservedDddRelationshipInput({ request, modelId, epoch }),
              {
                attributes: [
                  h.Style({
                    display: 'grid',
                    gap: '10px',
                    padding: '12px',
                    border: '1px solid var(--rule)',
                    borderRadius: '8px',
                  }),
                ],
                renderPattern: (context, builder, onRequest) =>
                  builder.label(
                    [builder.Class('workbench-field')],
                    [
                      builder.strong([], ['Pattern contract']),
                      zlozDddRelationshipPatternSelect(builder, context, onRequest),
                    ],
                  ),
                renderUpstream: (control, context, builder, onRequest) =>
                  builder.label(
                    [
                      builder.Key(control.role),
                      builder.Style({ display: 'flex', gap: '8px', alignItems: 'center' }),
                    ],
                    [
                      zlozDddUpstreamRole(builder, context, control, onRequest),
                      builder.span([], [control.label]),
                    ],
                  ),
                renderDownstream: (context, builder, onRequest) => {
                  const select = zlozDddDownstreamRoleSelect(builder, context, onRequest);
                  return select
                    ? builder.label(
                        [builder.Class('workbench-field')],
                        ['Downstream contract', select],
                      )
                    : null;
                },
                renderStatus: () =>
                  model.minimalMode || !model.diagnosticsEnabled ? null : undefined,
                renderReasons: (context, builder) => {
                  const reason =
                    context.reason ??
                    context.pattern.reason ??
                    context.downstream?.reason ??
                    context.upstream.find((control) => control.reason !== null)?.reason;
                  const details = zlozDddRelationshipReasons(builder, context);
                  return builder.div(
                    [],
                    [
                      ...(reason
                        ? [builder.p([builder.AriaLabel('DDD protection reason')], [reason])]
                        : []),
                      builder.p([], ['Each change can be undone.']),
                      ...(details
                        ? [
                            builder.details(
                              [],
                              [builder.summary([], ['Pattern compatibility details']), details],
                            ),
                          ]
                        : []),
                    ],
                  );
                },
              },
            ),
          ]
        : []),
      ...(!model.minimalMode && selectedEdge
        ? [
            h.div(
              [h.Role('group'), h.AriaLabel('Selected connection')],
              [
                ...(endpointFields.length
                  ? [
                      nativeSelectedEndpoints(
                        h,
                        { ...endpointScope, fields: endpointFields },
                        'architecture-effect-ui',
                        'connection-endpoints',
                      ),
                    ]
                  : []),
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
      nativePortInspector(h, model, 'architecture-effect-ui', 'port-inspector'),
    ],
    diagnostics:
      model.sidebarSection === 'diagnostics' && !model.sidebarCollapsed
        ? [
            nativeDiagnosticSettings(
              h,
              { ...model, busy: model.editor.gesture.type !== 'idle' },
              'architecture-effect-ui',
              'diagnostic-settings',
            ),
          ]
        : [],
    export: [...(model.mermaidPreviewOpen ? [mermaidExportPanel(model, h)] : [])],
  };
  const notice = h.p(
    [h.Role('status'), h.AriaLive('polite'), ...(diagnostics.status ? [] : [h.Style(hidden)])],
    [
      model.alchemyReview.review || model.alchemyReview.pending
        ? model.alchemyReview.notice
        : model.notice,
    ],
  );
  const editor = model.editor;
  const toolbarEdgeId =
    showEdgeToolbar &&
    !editor.readOnly &&
    editor.gesture.type === 'idle' &&
    !editor.connection &&
    !editor.context &&
    !editor.edgeLabelDraft &&
    editor.selectedEdges.length === 1
      ? editor.selectedEdges[0]
      : undefined;
  const { nodes, edges } = presentVisibleGraph(editor);
  const card = model.canvasCopyDesign === 'card';
  const sidebar = {
    canvasId: 'flow-demo-surface',
    help: nativeCanvasHelp(
      h,
      {
        id: 'flow-demo-help',
        context: canvasHelpContext(
          editor,
          model,
          showEdgeToolbar && !editor.readOnly,
          diagnostics.instructions,
        ),
        card,
      },
      'architecture-effect-ui',
      'canvas-help',
    ),
    status: nativeCanvasStatus(
      h,
      {
        context: canvasStatusContext(editor.notice, nodes.length, edges.length, diagnostics.status),
        card,
      },
      'architecture-effect-ui',
      'canvas-status',
    ),
    connections: nativeConnections(
      h,
      {
        id: 'flow-demo-connections',
        context: resolveConnectionList(editor, edges, {
          ...policy,
          id: 'flow-demo',
          compact: !diagnostics.connectionList,
          contextActions: true,
          toolbarEdgeId,
        }),
        rows: model.connectionListDesign === 'rows',
        expanded: editor.connectionsExpanded,
        modelId,
        epoch,
      },
      'architecture-effect-ui',
      'connection-list',
    ),
    creation:
      model.sidebarSection === 'ports' && !model.sidebarCollapsed
        ? nativeConnectionCreation(
            h,
            { ...endpointScope, context: resolveConnectionCreation(editor, policy) },
            'architecture-effect-ui',
            'connection-creation',
          )
        : null,
  };
  return {
    title,
    body: zlozPlacementHost(
      h,
      placementControls,
      placementInput,
      [h.Class('flow-workbench'), h.DataAttribute('flow-workbench-color-scheme', colorScheme)],
      [
        h.div(
          [
            h.Id('flow-demo'),
            h.Class('foldkit-zloz foldkit-flow'),
            h.DataAttribute('flow-minimal', String(model.minimalMode)),
            h.Style({
              ...zlozThemeStyle(workbenchThemes[colorScheme]),
              height: '100%',
              'min-height': '0',
              display: 'flex',
              'flex-direction': 'column',
            }),
          ],
          [
            workbenchLayout(
              h,
              model,
              { ...sidebar, canvas: nativeCanvas },
              controls,
              themePreference,
              notice,
            ),
          ],
        ),
      ],
    ),
  };
}
