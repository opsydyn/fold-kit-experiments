import type { Html } from '@effect/ui/html';
import {
  resolveConnectionCreation,
  resolveEdgeReconnection,
  resolveHistoryComparisonControls,
  type ZlozPlacementInput,
} from '@opsydyn/foldkit-zloz';
import { supportsForceLayout } from '@opsydyn/foldkit-zloz-force/eligibility';
import {
  canvasHelpContext,
  canvasStatusContext,
  presentVisibleGraph,
  placementHost,
  zlozThemeStyle,
  resolveZlozDiagnostics,
  resolveConnectionList,
} from '@opsydyn/foldkit-zloz/effect-ui';

import { alchemyReviewPanel } from './alchemy-review';
import { workbenchPolicy } from './editor-policy';
import { exportReviewPanel } from './export-review';
import { workbenchHistoryComparison } from './history-navigation';
import { Message } from './message';
import { type Model } from './model';
import { nativeArchitectureCanvas } from './native-canvas';
import { nativeDddInspector } from './native-ddd-inspector';
import { nativeDiagramSearch, nativeExamplePicker } from './native-diagram-browse';
import { nativeCausalRelationships, nativeDiagramCaption } from './native-diagram-notation';
import { nativeConnectionCreation, nativeSelectedConnection } from './native-endpoints';
import { nativeGraphActions } from './native-graph-actions';
import { nativeHistory } from './native-history';
import { nativeC4MappingReview, nativeMappingReview } from './native-mapping-reviews';
import { nativeMermaidExport } from './native-mermaid-export';
import { nativePatternInsertion } from './native-pattern-insertion';
import { nativePolicies } from './native-policies';
import { nativePortInspector } from './native-port-inspector';
import { nativePortSettings } from './native-port-settings';
import { nativeAppearanceSettings, nativeDiagnosticSettings } from './native-settings';
import { nativeCanvasHelp, nativeCanvasStatus, nativeConnections } from './native-sidebar';
import { nativeWorkshopInspector } from './native-workshop-inspector';
import { packetReaderPanel } from './packet-reader';
import { workbenchPlacement } from './palette';
import { patchWorkbenchPanel } from './patch-review';
import { patternInsertionReason } from './pattern-insertion';
import { workbenchPngReview } from './png-review';
import { workbenchSvgReview } from './svg-review';
import { workbenchThemes } from './theme';
import { workbenchLayout, type WorkbenchControls } from './workbench-layout';

export function view<M>(model: Model, h: Html.H<M>, send: (message: Message) => M) {
  const modelId = model.modelIdentity.id;
  const epoch = model.modelEpoch;
  const workingModel = model;
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
  if (model.historyReview) model = { ...model, editor: model.historyReview.editor };
  const { themePreference } = model;
  const colorScheme = themePreference === 'system' ? model.systemColorScheme : themePreference;
  if (themePreference === null || colorScheme === null) return h.div.children();
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
    whiteSpace: 'nowrap',
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
    send,
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
  const controls: WorkbenchControls<M> = {
    alchemy:
      model.sidebarSection === 'alchemy'
        ? [alchemyReviewPanel(h, model, 'architecture-effect-ui', 'domain-review', send)]
        : [],
    review: model.sidebarSection === 'review' ? [packetReaderPanel(model, h, send)] : [],
    patch: patchWorkbenchPanel(model, h, send),
    history:
      model.sidebarSection === 'history'
        ? [nativeHistory(h, workingModel, 'architecture-effect-ui', 'history', send)]
        : [],
    png:
      model.sidebarSection === 'png' && !model.sidebarCollapsed
        ? [
            exportReviewPanel(
              h,
              {
                kind: 'png',
                controls: workbenchPngReview(model),
                custom: model.customPngReview,
                retained: model.retainedPngLayout,
                hasRoutes: model.editor.routes.length > 0,
                downloadProtected: model.protectPngDownloads,
                reviewing: model.historyReview !== null,
                diagnostics,
              },
              send,
            ),
          ]
        : [],
    svg:
      model.sidebarSection === 'svg' && !model.sidebarCollapsed
        ? [
            exportReviewPanel(
              h,
              {
                kind: 'svg',
                controls: workbenchSvgReview(model),
                custom: model.customSvgReview,
                retained: model.retainedSvgLayout,
                hasRoutes: model.editor.routes.length > 0,
                downloadProtected: model.protectSvgDownloads,
                reviewing: model.historyReview !== null,
                diagnostics,
              },
              send,
            ),
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
        send,
      ),
      ...(model.sidebarSection === 'diagram' && !model.sidebarCollapsed
        ? [
            nativeExamplePicker(
              h,
              { model, showInstructions: diagnostics.instructions },
              'architecture-effect-ui',
              'examples',
              send,
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
              send,
            ),
          ]
        : []),
      ...(model.sidebarSection === 'diagram' && !model.sidebarCollapsed
        ? [nativeDiagramSearch(h, model, 'architecture-effect-ui', 'diagram-search', send)]
        : []),
      ...(model.nodeDesign === 'event-storming'
        ? [
            nativeCausalRelationships(
              h,
              model,
              'architecture-effect-ui',
              'causal-relationships',
              send,
            ),
          ]
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
              send,
            ),
          ]
        : []),
    ],
    appearance:
      model.sidebarSection === 'appearance' && !model.sidebarCollapsed
        ? [
            nativeAppearanceSettings(
              h,
              model,
              'architecture-effect-ui',
              'appearance-settings',
              send,
            ),
          ]
        : [],
    ports: [nativePortSettings(h, model, 'architecture-effect-ui', 'port-settings', send)],
    policies: [nativePolicies(h, model, 'architecture-effect-ui', 'policies', send)],
    c4mapping:
      model.sidebarSection === 'c4mapping'
        ? [nativeC4MappingReview(h, model, 'architecture-effect-ui', 'c4-mapping-review', send)]
        : [],
    mapping:
      model.sidebarSection === 'mapping'
        ? [nativeMappingReview(h, model, 'architecture-effect-ui', 'mapping-review', send)]
        : [],
    inspect: [
      ...(showWorkshopInspector
        ? [nativeWorkshopInspector(h, model, 'architecture-effect-ui', 'workshop-inspector', send)]
        : []),
      ...(hasDddNodes && model.sidebarSection === 'inspect'
        ? [
            nativeDddInspector(
              h,
              model,
              'architecture-effect-ui',
              'ddd-relationship-inspector',
              send,
            ),
          ]
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
              send,
            ),
          ]
        : []),
      nativePortInspector(h, model, 'architecture-effect-ui', 'port-inspector', send),
    ],
    diagnostics:
      model.sidebarSection === 'diagnostics' && !model.sidebarCollapsed
        ? [
            nativeDiagnosticSettings(
              h,
              { ...model, busy: model.editor.gesture.type !== 'idle' },
              'architecture-effect-ui',
              'diagnostic-settings',
              send,
            ),
          ]
        : [],
    export:
      model.sidebarSection === 'export' && model.mermaidPreviewOpen
        ? [nativeMermaidExport(h, model, 'architecture-effect-ui', 'mermaid-export', send)]
        : [],
  };
  const notice = h.p
    .attr('role', 'status')
    .attr('aria-live', 'polite')
    .style(diagnostics.status ? {} : hidden)
    .children(
      model.alchemyReview.review || model.alchemyReview.pending
        ? model.alchemyReview.notice
        : model.notice,
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
      send,
    ),
    status: nativeCanvasStatus(
      h,
      {
        context: canvasStatusContext(editor.notice, nodes.length, edges.length, diagnostics.status),
        card,
      },
      'architecture-effect-ui',
      'canvas-status',
      send,
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
      send,
    ),
    creation:
      model.sidebarSection === 'ports' && !model.sidebarCollapsed
        ? nativeConnectionCreation(
            h,
            { ...endpointScope, context: resolveConnectionCreation(editor, policy) },
            'architecture-effect-ui',
            'connection-creation',
            send,
          )
        : null,
  };
  return placementHost(h, placementControls, (input) => send(placementInput(input)))
    .class('flow-workbench')
    .attr('data-effect-ui-workbench', 'architecture')
    .attr('data-flow-workbench-color-scheme', colorScheme)
    .children(
      h.div
        .id('flow-demo')
        .class('foldkit-zloz foldkit-flow')
        .attr('data-flow-minimal', String(model.minimalMode))
        .style({
          ...zlozThemeStyle(workbenchThemes[colorScheme]),
          height: '100%',
          minHeight: '0',
          display: 'flex',
          flexDirection: 'column',
        })
        .children(
          workbenchLayout(
            h,
            model,
            { ...sidebar, canvas: nativeCanvas },
            controls,
            themePreference,
            notice,
            send,
          ),
        ),
    );
}
