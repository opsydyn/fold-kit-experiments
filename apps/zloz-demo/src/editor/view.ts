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
  resolveConnectionList,
} from '@opsydyn/foldkit-zloz/effect-ui';
import { zlozThemeStyle, resolveZlozDiagnostics } from '@opsydyn/foldkit-zloz/foldkit';
import { zlozPlacementHost } from '@opsydyn/foldkit-zloz/foldkit';
import { type Document, type HtmlBuilder } from 'foldkit/html';

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

export function view(model: Model, h: HtmlBuilder<Message>): Document {
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
  const title = 'Architecture workbench | ZLOZ';
  const { themePreference } = model;
  const colorScheme = themePreference === 'system' ? model.systemColorScheme : themePreference;
  if (themePreference === null || colorScheme === null) return { title, body: h.div([], []) };
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
    history:
      model.sidebarSection === 'history'
        ? [nativeHistory(h, workingModel, 'architecture-effect-ui', 'history')]
        : [],
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
