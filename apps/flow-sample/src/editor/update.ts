import {
  applyLayout,
  createEditor,
  fitViewport,
  layoutRequest,
  parseSnapshot,
  serializeGraph,
  serializeSnapshot,
  updateEditor,
  type EditorEvent,
  type EditorState,
  type FlowGraph,
  type FlowSnapshot,
  type LayoutResult,
} from '@opsydyn/foldkit-flow';
import { supportsForceLayout } from '@opsydyn/foldkit-flow-force/eligibility';
import type { Return } from 'foldkit/update';

import {
  ArrangeFlow,
  ExportFlow,
  ImportFlow,
  LoadFlow,
  SaveThemePreference,
  SaveFlow,
} from './command';
import { workbenchPolicy } from './editor-policy';
import { createLargeWorkflowGraph } from './large-workflow';
import { Message } from './message';
import { groupedOnionGraph, initialGraph, onionGraph, type Model } from './model';
import { presetPosition } from './port-presets';
import { searchNodes } from './search';

function frameGraph(graph: FlowGraph, { surface, fitViewPadding, zoomLimits }: EditorState) {
  const size = surface ?? { width: 800, height: 440 };
  return fitViewport(
    graph,
    size,
    Math.min(fitViewPadding, size.width / 4, size.height / 4),
    zoomLimits,
  );
}

export function update(model: Model, message: Message): Return<Model, Message> {
  const {
    snapToGrid,
    gridSpacing,
    snapToAlignment,
    selectionMode,
    boxSelectionMatch,
    fitViewDuration,
    fitViewPadding,
    zoomLimits,
  } = model.editor;
  const snapshotJson = () =>
    model.includeCamera ? serializeSnapshot(model.editor) : serializeGraph(model.editor.graph);
  const restoreDocument = ({ graph, viewport }: FlowSnapshot, fitGraphOnly: boolean) => {
    const boundedZoom = (zoom: number) =>
      Math.max(zoomLimits.minZoom, Math.min(zoom, zoomLimits.maxZoom));
    const camera = viewport
      ? { ...viewport, zoom: boundedZoom(viewport.zoom) }
      : fitGraphOnly
        ? frameGraph(graph, model.editor)
        : { x: 0, y: 0, zoom: boundedZoom(1) };
    return {
      ...createEditor(graph, {
        snapToGrid,
        gridSpacing,
        snapToAlignment,
        selectionMode,
        boxSelectionMatch,
        fitViewDuration,
        fitViewPadding,
        zoomLimits,
        viewport: camera,
      }),
      surface: model.editor.surface,
      clipboard: model.editor.clipboard,
    };
  };
  return Message.match(message, {
    ObservedFlowInput: ({ message: input }) => {
      // SAFETY: flowView and the toolbar emit the package's typed EditorEvent contract.
      const event = input as EditorEvent;
      return {
        model: {
          ...model,
          editor: updateEditor(model.editor, event, workbenchPolicy(model)),
        },
      };
    },
    ChangedNodeSearch: ({ query }) => ({ model: { ...model, nodeQuery: query } }),
    SubmittedNodeSearch: () => {
      const node = searchNodes(model.editor, model.nodeQuery)[0];
      if (!node) return { model };
      return {
        model: {
          ...model,
          editor: updateEditor(model.editor, { type: 'NodeRevealRequested', id: node.id }),
        },
      };
    },
    SelectedExample: ({ example }) => {
      const graph =
        example === 'large-workflow'
          ? createLargeWorkflowGraph()
          : { release: initialGraph, onion: onionGraph, 'grouped-onion': groupedOnionGraph }[
              example
            ];
      const surface = model.editor.surface;
      const editor = createEditor(graph, {
        snapToGrid,
        gridSpacing,
        snapToAlignment,
        selectionMode,
        boxSelectionMatch,
        fitViewDuration,
        fitViewPadding,
        zoomLimits,
        viewport: frameGraph(graph, model.editor),
      });
      return {
        model: {
          ...model,
          editor: { ...editor, surface, clipboard: model.editor.clipboard },
          active: null,
          importing: null,
          notice: '',
        },
      };
    },
    SelectedPortAnchors: ({ preset }) => ({
      model: {
        ...model,
        editor: updateEditor(model.editor, {
          type: 'PortPositionsChanged',
          positions: model.editor.graph.nodes.flatMap((node) =>
            node.ports.map((port) => ({
              endpoint: { node: node.id, port: port.id },
              position: presetPosition(port, preset),
            })),
          ),
        }),
      },
    }),
    SelectedWheelNavigation: ({ wheelNavigation }) => ({ model: { ...model, wheelNavigation } }),
    SelectedNavigationDesign: ({ navigationDesign }) => ({ model: { ...model, navigationDesign } }),
    SelectedConnectionDesign: ({ connectionDesign }) => ({ model: { ...model, connectionDesign } }),
    ClickedConnectionSnap: () => ({ model: { ...model, snapConnections: !model.snapConnections } }),
    ClickedPortLock: ({ port }) => ({
      model: {
        ...model,
        portLocks: { ...model.portLocks, [port]: !model.portLocks[port] },
        editor: model.editor.connection
          ? updateEditor(model.editor, { type: 'GestureCancelled' })
          : model.editor,
      },
    }),
    SelectedReconnectLock: ({ reconnectLock }) => ({ model: { ...model, reconnectLock } }),
    ClickedLockNodeSizes: () => ({ model: { ...model, lockNodeSizes: !model.lockNodeSizes } }),
    ClickedVisibilityToggle: ({ field, id }) => {
      const visibility = model.editor.visibility ?? {};
      const ids = visibility[field] ?? [];
      const hidden = ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
      return {
        model: {
          ...model,
          editor: updateEditor(model.editor, {
            type: 'VisibilityChanged',
            visibility: { ...visibility, [field]: hidden },
          }),
        },
      };
    },
    ClickedExcludeSelection: () => ({
      model: {
        ...model,
        excludeSelection: !model.excludeSelection,
        editor: updateEditor(model.editor, { type: 'SelectionCleared' }),
      },
    }),
    ClickedLockKeyNodes: () => ({ model: { ...model, lockKeyNodes: !model.lockKeyNodes } }),
    ClickedDeletionProtection: () => ({
      model: { ...model, protectDeletions: !model.protectDeletions },
    }),
    SelectedCanvasCopyDesign: ({ canvasCopyDesign }) => ({ model: { ...model, canvasCopyDesign } }),
    SelectedSelectionMarqueeDesign: ({ selectionMarqueeDesign }) => ({
      model: { ...model, selectionMarqueeDesign },
    }),
    SelectedAlignmentGuideDesign: ({ alignmentGuideDesign }) => ({
      model: { ...model, alignmentGuideDesign },
    }),
    SelectedResizeReadoutDesign: ({ resizeReadoutDesign }) => ({
      model: { ...model, resizeReadoutDesign },
    }),
    SelectedConnectionListDesign: ({ connectionListDesign }) => ({
      model: { ...model, connectionListDesign },
    }),
    SelectedContextMenuDesign: ({ contextMenuDesign }) => ({
      model: { ...model, contextMenuDesign },
    }),
    SelectedNodeToolbarDesign: ({ nodeToolbarDesign }) => ({
      model: { ...model, nodeToolbarDesign },
    }),
    SelectedEdgeToolbarDesign: ({ edgeToolbarDesign }) => ({
      model: { ...model, edgeToolbarDesign },
    }),
    SelectedEdgeLabelDesign: ({ edgeLabelDesign }) => ({ model: { ...model, edgeLabelDesign } }),
    SelectedEdgeDesign: ({ edgeDesign }) => ({ model: { ...model, edgeDesign } }),
    SelectedNodeDesign: ({ nodeDesign }) => ({ model: { ...model, nodeDesign } }),
    SelectedBackground: ({ background }) => ({ model: { ...model, background } }),
    ClickedWorldAnnotation: () => ({
      model: { ...model, showWorldAnnotation: !model.showWorldAnnotation },
    }),
    LoadedThemePreference: ({ themePreference }) => ({
      model: model.themePreference === null ? { ...model, themePreference } : model,
    }),
    ChangedSystemColorScheme: ({ colorScheme }) => ({
      model: { ...model, systemColorScheme: colorScheme },
    }),
    SelectedThemePreference: ({ themePreference }) => ({
      model: { ...model, themePreference },
      commands: [SaveThemePreference({ themePreference })],
    }),
    CompletedColorSchemeSave: () => ({ model }),
    FailedColorSchemeSave: () => ({
      model: { ...model, notice: 'Theme changed for this visit. Your browser could not save it.' },
    }),
    ClickedRetainNodeViews: () => ({
      model: { ...model, retainNodeViews: !model.retainNodeViews },
    }),
    ClickedViewportCulling: () => ({
      model: { ...model, viewportCulling: !model.viewportCulling },
    }),
    ClickedMinimalMode: () => ({ model: { ...model, minimalMode: !model.minimalMode } }),
    ClickedDiagnosticsPanel: () => ({
      model: { ...model, diagnosticsPanelOpen: !model.diagnosticsPanelOpen },
    }),
    ClickedDiagnosticsEnabled: () => ({
      model: { ...model, diagnosticsEnabled: !model.diagnosticsEnabled },
    }),
    ClickedDiagnostic: ({ diagnostic }) => ({
      model: {
        ...model,
        diagnostics: { ...model.diagnostics, [diagnostic]: !model.diagnostics[diagnostic] },
      },
    }),
    ClickedAdd: () => {
      let sequence = model.sequence + 1;
      while (model.editor.graph.nodes.some((node) => node.id === `step-${sequence}`)) sequence++;
      const editor = updateEditor(model.editor, {
        type: 'NodeAdded',
        node: {
          id: `step-${sequence}`,
          label: `Step ${sequence}`,
          position: { x: 70, y: 230 },
          size: { width: 180, height: 90 },
          ports: [
            { id: 'in', kind: 'input', side: 'left', offset: 0.5 },
            { id: 'out', kind: 'output', side: 'right', offset: 0.5 },
          ],
        },
      });
      return { model: { ...model, editor, sequence } };
    },
    ClickedArrange: ({ engine }) => {
      if (engine === 'force' && !supportsForceLayout(model.editor.graph)) return { model };
      const sequence = model.sequence + 1;
      const active = layoutRequest(model.editor, `layout-${sequence}`);
      return {
        model: { ...model, active, sequence, notice: 'Arranging…' },
        commands: [
          ArrangeFlow({
            engine,
            json: serializeGraph(active.graph),
            requestId: active.requestId,
            revision: active.revision,
            direction: (model.editor.surface?.width ?? 800) < 600 ? 'DOWN' : 'RIGHT',
          }),
        ],
      };
    },
    SucceededLayout: ({ result: raw }) => {
      // SAFETY: ArrangeFlow returns a layout result from the selected engine.
      const result = raw as LayoutResult;
      if (model.active?.requestId !== result.requestId) return { model };
      const editor = applyLayout(model.editor, model.active, result);
      return {
        model: {
          ...model,
          editor:
            editor === model.editor
              ? editor
              : updateEditor(editor, {
                  type: 'ViewportChanged',
                  viewport: frameGraph(editor.graph, editor),
                }),
          active: null,
          notice:
            editor === model.editor
              ? 'Graph changed; arrange again when ready.'
              : 'Layout applied.',
        },
      };
    },
    FailedLayout: ({ requestId }) =>
      model.active?.requestId === requestId
        ? { model: { ...model, active: null, notice: 'Layout failed. Your graph is preserved.' } }
        : { model },
    ClickedIncludeCamera: () => ({ model: { ...model, includeCamera: !model.includeCamera } }),
    ClickedExport: () => ({
      model,
      commands: [ExportFlow({ json: snapshotJson() })],
    }),
    CompletedExport: () => ({ model: { ...model, notice: 'JSON download started.' } }),
    FailedExport: () => ({ model: { ...model, notice: 'Could not start the JSON download.' } }),
    ChoseImportFiles: ({ files }) => {
      const file = files[0];
      if (!file) return { model };
      if (file.size > 5 * 1024 * 1024)
        return {
          model: { ...model, importing: null, notice: 'Choose a JSON file no larger than 5 MiB.' },
        };
      const id = model.sequence + 1;
      return {
        model: {
          ...model,
          sequence: id,
          importing: { id, revision: model.editor.revision },
          notice: 'Reading diagram…',
        },
        commands: [ImportFlow({ id, file })],
      };
    },
    FailedImport: ({ id }) =>
      model.importing?.id === id
        ? {
            model: {
              ...model,
              importing: null,
              notice: 'Could not import this JSON diagram. Your current diagram is preserved.',
            },
          }
        : { model },
    SucceededImport: ({ id, json }) => {
      if (model.importing?.id !== id) return { model };
      if (
        model.importing.revision !== model.editor.revision ||
        model.editor.gesture.type !== 'idle'
      )
        return {
          model: {
            ...model,
            importing: null,
            notice: 'The diagram changed during import. Choose the file again to replace it.',
          },
        };
      const editor = restoreDocument(parseSnapshot(json), true);
      return {
        model: {
          ...model,
          editor,
          active: null,
          importing: null,
          notice: 'JSON diagram imported.',
        },
      };
    },
    ClickedSave: () => ({
      model,
      commands: [SaveFlow({ json: snapshotJson() })],
    }),
    ClickedLoad: () => ({ model, commands: [LoadFlow()] }),
    SucceededSave: () => ({ model: { ...model, notice: 'Saved on this browser.' } }),
    FailedStorage: () => ({
      model: {
        ...model,
        notice: 'Saved graph unavailable or invalid. Your current graph is preserved.',
      },
    }),
    SucceededLoad: ({ json }) => ({
      model: {
        ...model,
        editor: restoreDocument(parseSnapshot(json), false),
        active: null,
        importing: null,
        notice: 'Saved graph loaded.',
      },
    }),
  });
}
