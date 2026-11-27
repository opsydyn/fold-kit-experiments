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
  type ZlozPlacementInput,
  type ZlozAuditComparisonRequest,
} from '@opsydyn/foldkit-zloz';
import { supportsForceLayout } from '@opsydyn/foldkit-zloz-force/eligibility';
import {
  canvasHelpContext,
  canvasStatusContext,
  presentVisibleGraph,
  resolveConnectionList,
} from '@opsydyn/foldkit-zloz/effect-ui';
import {
  zlozThemeStyle,
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
import { type Document, type HtmlBuilder } from 'foldkit/html';

import { alchemyReviewPanel } from './alchemy-review';
import { workbenchAuditContext } from './audit-comparison';
import { dddAuditPanel } from './ddd-audit-view';
import { workbenchPolicy } from './editor-policy';
import { exportReviewPanel } from './export-review';
import { historyAllowsMessage, editionRestorePolicy } from './history';
import { workbenchHistoryComparison, historyChangeNavigatorContext } from './history-navigation';
import { Message } from './message';
import { type Model } from './model';
import { modelSessionBusy } from './model-sessions';
import { nativeArchitectureCanvas } from './native-canvas';
import { nativeDddInspector } from './native-ddd-inspector';
import { nativeDiagramSearch, nativeExamplePicker } from './native-diagram-browse';
import { nativeCausalRelationships, nativeDiagramCaption } from './native-diagram-notation';
import { nativeConnectionCreation, nativeSelectedConnection } from './native-endpoints';
import { nativeGraphActions } from './native-graph-actions';
import { nativeC4MappingReview, nativeMappingReview } from './native-mapping-reviews';
import { nativeMermaidExport } from './native-mermaid-export';
import { nativePatternInsertion } from './native-pattern-insertion';
import { nativePolicies } from './native-policies';
import { nativePortInspector } from './native-port-inspector';
import { nativePortSettings } from './native-port-settings';
import { nativeReviewPacket } from './native-review-packet';
import { nativeAppearanceSettings, nativeDiagnosticSettings } from './native-settings';
import { nativeCanvasHelp, nativeCanvasStatus, nativeConnections } from './native-sidebar';
import { nativeWorkshopInspector } from './native-workshop-inspector';
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
  const showWorkshopInspector =
    model.sidebarSection === 'inspect' &&
    model.editor.graph.nodes.some((node) => node.architecture?.family === 'event-storming');
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
    alchemy:
      model.sidebarSection === 'alchemy'
        ? [alchemyReviewPanel(h, model, 'architecture-effect-ui', 'domain-review')]
        : [],
    review: model.sidebarSection === 'review' ? [packetReaderPanel(model, h)] : [],
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
            nativeReviewPacket(
              h,
              {
                controls: packetControls,
                modelId,
                epoch,
                showStatus: !model.minimalMode && model.diagnosticsEnabled,
              },
              'architecture-effect-ui',
              'review-packet-export',
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
            exportReviewPanel(h, {
              kind: 'png',
              controls: workbenchPngReview(model),
              custom: model.customPngReview,
              retained: model.retainedPngLayout,
              hasRoutes: model.editor.routes.length > 0,
              downloadProtected: model.protectPngDownloads,
              reviewing: model.historyReview !== null,
              diagnostics,
            }),
          ]
        : [],
    svg:
      model.sidebarSection === 'svg' && !model.sidebarCollapsed
        ? [
            exportReviewPanel(h, {
              kind: 'svg',
              controls: workbenchSvgReview(model),
              custom: model.customSvgReview,
              retained: model.retainedSvgLayout,
              hasRoutes: model.editor.routes.length > 0,
              downloadProtected: model.protectSvgDownloads,
              reviewing: model.historyReview !== null,
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
    c4mapping:
      model.sidebarSection === 'c4mapping'
        ? [nativeC4MappingReview(h, model, 'architecture-effect-ui', 'c4-mapping-review')]
        : [],
    mapping:
      model.sidebarSection === 'mapping'
        ? [nativeMappingReview(h, model, 'architecture-effect-ui', 'mapping-review')]
        : [],
    inspect: [
      ...(showWorkshopInspector
        ? [nativeWorkshopInspector(h, model, 'architecture-effect-ui', 'workshop-inspector')]
        : []),
      ...(hasDddNodes && model.sidebarSection === 'inspect'
        ? [nativeDddInspector(h, model, 'architecture-effect-ui', 'ddd-relationship-inspector')]
        : []),
      ...(!model.minimalMode && selectedEdge
        ? [
            nativeSelectedConnection(
              h,
              {
                ...endpointScope,
                fields: endpointFields,
                edge: selectedEdge,
                readOnly: model.editor.readOnly,
                reviewing: model.historyReview !== null,
              },
              'architecture-effect-ui',
              'connection-endpoints',
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
    export:
      model.sidebarSection === 'export' && model.mermaidPreviewOpen
        ? [nativeMermaidExport(h, model, 'architecture-effect-ui', 'mermaid-export')]
        : [],
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
