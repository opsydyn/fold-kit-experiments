import {
  applyLayout,
  createEditor,
  fitViewport,
  layoutRequest,
  parseSnapshot,
  serializeGraph,
  serializeSnapshot,
  updateEditor,
  portEditReason,
  type EditorEvent,
  type EditorState,
  type FlowGraph,
  type FlowSnapshot,
  type LayoutResult,
} from '@opsydyn/foldkit-flow';
import { supportsForceLayout } from '@opsydyn/foldkit-flow-force/eligibility';
import {
  portInspectorContext,
  portPositionDraft,
  updatePortPositionDraft,
  portPositionFromDraft,
  type FlowPortPositionDraftChange,
} from '@opsydyn/foldkit-flow/foldkit';
import { Option } from 'effect';
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
import {
  groupedOnionGraph,
  initialGraph,
  onionGraph,
  portSnappingGraph,
  type Model,
} from './model';
import { nextPort } from './port-editing';
import { presetPosition } from './port-presets';
import { searchDiagram } from './search';

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
  const changedPosition = (change: FlowPortPositionDraftChange): Return<Model, Message> => ({
    model: model.portPositionDraft
      ? {
          ...model,
          portPositionDraft: {
            ...model.portPositionDraft,
            draft: updatePortPositionDraft(model.portPositionDraft.draft, change),
          },
        }
      : model,
  });
  const {
    snapToGrid,
    gridSpacing,
    snapToAlignment,
    selectionMode,
    boxSelectionMatch,
    fitViewDuration,
    fitViewPadding,
    zoomLimits,
    connectionSnapHysteresis = 0,
    portAnchorSnapDistance = 0,
    portAnchorSnapHysteresis = 0,
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
        connectionSnapHysteresis,
        portAnchorSnapDistance,
        portAnchorSnapHysteresis,
      }),
      surface: model.editor.surface,
      clipboard: model.editor.clipboard,
    };
  };
  const result: Return<Model, Message> = Message.match(message, {
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
    ChangedDiagramSearch: ({ query }) => ({ model: { ...model, searchQuery: query } }),
    SelectedSearchScope: ({ scope }) => ({ model: { ...model, searchScope: scope } }),
    SubmittedDiagramSearch: () => {
      const result = searchDiagram(model.editor, model.searchQuery, model.searchScope)[0];
      if (!result) return { model };
      return { model: { ...model, editor: updateEditor(model.editor, result.event) } };
    },
    SelectedExample: ({ example }) => {
      const graph =
        example === 'large-workflow'
          ? createLargeWorkflowGraph()
          : {
              release: initialGraph,
              onion: onionGraph,
              'grouped-onion': groupedOnionGraph,
              'port-snapping': portSnappingGraph,
            }[example];
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
        connectionSnapHysteresis,
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
        editor: updateEditor(
          model.editor,
          {
            type: 'PortPositionsChanged',
            positions: model.editor.graph.nodes.flatMap((node) =>
              node.ports.map((port) => ({
                endpoint: { node: node.id, port: port.id },
                position: presetPosition(port, preset),
              })),
            ),
          },
          workbenchPolicy(model),
        ),
      },
    }),
    SelectedWheelNavigation: ({ wheelNavigation }) => ({ model: { ...model, wheelNavigation } }),
    ClickedDoubleClickZoom: () => ({
      model: { ...model, doubleClickZoom: !model.doubleClickZoom },
    }),
    ClickedSpaceToPan: () => ({ model: { ...model, spaceToPan: !model.spaceToPan } }),
    ClickedMiddleButtonPan: () => ({
      model: { ...model, middleButtonPan: !model.middleButtonPan },
    }),
    SelectedNavigationDesign: ({ navigationDesign }) => ({ model: { ...model, navigationDesign } }),
    SelectedConnectionDesign: ({ connectionDesign }) => ({ model: { ...model, connectionDesign } }),
    ClickedConnectionSnap: () => ({ model: { ...model, snapConnections: !model.snapConnections } }),
    ClickedPortLabels: () => ({ model: { ...model, portLabels: !model.portLabels } }),
    ClickedPortAnchorSnapHysteresis: () => ({
      model: {
        ...model,
        editor: updateEditor(model.editor, {
          type: 'PortAnchorSnapHysteresisChanged',
          distance: (model.editor.portAnchorSnapHysteresis ?? 0) > 0 ? 0 : 4,
        }),
      },
    }),
    ClickedPortAnchorSnap: () => ({
      model: {
        ...model,
        editor: updateEditor(model.editor, {
          type: 'PortAnchorSnapDistanceChanged',
          distance: (model.editor.portAnchorSnapDistance ?? 0) > 0 ? 0 : 12,
        }),
      },
    }),
    ClickedPortAnchorHandles: () => ({
      model:
        model.editor.gesture.type === 'idle'
          ? { ...model, portAnchorHandles: !model.portAnchorHandles }
          : model,
    }),
    ClickedCustomPorts: () => ({ model: { ...model, customPorts: !model.customPorts } }),
    ClickedEditPortLabel: ({ nodeId, portId }) => {
      if (model.editor.readOnly || model.editor.gesture.type !== 'idle') return { model };
      const node = model.editor.graph.nodes.find(({ id }) => id === nodeId);
      const port = node?.ports.find(({ id }) => id === portId);
      if (!node || !port || !model.editor.selectedNodes.includes(nodeId)) return { model };
      const reason = portEditReason(
        { operation: 'label', node, port },
        model.editor.graph,
        workbenchPolicy(model).canEditPort,
      );
      if (reason !== null)
        return { model: { ...model, editor: { ...model.editor, notice: reason } } };
      return {
        model: {
          ...model,
          portPositionDraft: null,
          portLabelDraft: { nodeId, portId, text: port.label ?? '' },
        },
      };
    },
    ClickedEditPortPosition: ({ nodeId, portId }) => {
      const context = Option.getOrUndefined(
        portInspectorContext(model.editor, nodeId, workbenchPolicy(model)),
      );
      const entry = context?.entries.find(({ port }) => port.id === portId);
      if (!entry || !model.editor.selectedNodes.includes(nodeId)) return { model };
      if (entry.positionControl.reason !== null)
        return {
          model: { ...model, editor: { ...model.editor, notice: entry.positionControl.reason } },
        };
      return {
        model: {
          ...model,
          portLabelDraft: null,
          portPositionDraft: { nodeId, portId, draft: portPositionDraft(entry.port) },
        },
      };
    },
    SelectedPortPositionMode: ({ mode }) => changedPosition({ type: 'mode', mode }),
    SelectedPortPositionSide: ({ side }) => changedPosition({ type: 'side', side }),
    ChangedPortPositionNumber: ({ field, text }) =>
      changedPosition({ type: 'number', field, text }),
    ClickedCancelPortPosition: () => ({ model: { ...model, portPositionDraft: null } }),
    SubmittedPortPosition: () => {
      const draft = model.portPositionDraft;
      if (!draft) return { model };
      const policy = workbenchPolicy(model);
      const context = Option.getOrUndefined(
        portInspectorContext(model.editor, draft.nodeId, policy),
      );
      const entry = context?.entries.find(({ port }) => port.id === draft.portId);
      if (!entry) return { model: { ...model, portPositionDraft: null } };
      const position = Option.getOrUndefined(portPositionFromDraft(draft.draft));
      const reason =
        entry.positionControl.reason ??
        (position === undefined ? 'Enter a number from 0 to 1 for each position field.' : null);
      if (reason !== null || position === undefined)
        return { model: { ...model, editor: { ...model.editor, notice: reason } } };
      return {
        model: {
          ...model,
          portPositionDraft: null,
          editor: updateEditor(
            model.editor,
            { type: 'PortPositionsChanged', positions: [{ endpoint: entry.endpoint, position }] },
            policy,
          ),
        },
      };
    },
    ChangedPortLabelDraft: ({ text }) => ({
      model: model.portLabelDraft
        ? { ...model, portLabelDraft: { ...model.portLabelDraft, text } }
        : model,
    }),
    ClickedCancelPortLabel: () => ({ model: { ...model, portLabelDraft: null } }),
    SubmittedPortLabel: () => {
      const draft = model.portLabelDraft;
      if (!draft) return { model };
      const node = model.editor.graph.nodes.find(({ id }) => id === draft.nodeId);
      const port = node?.ports.find(({ id }) => id === draft.portId);
      const policy = workbenchPolicy(model);
      const reason =
        node && port
          ? portEditReason(
              { operation: 'label', node, port },
              model.editor.graph,
              policy.canEditPort,
            )
          : null;
      return {
        model: {
          ...model,
          portLabelDraft: reason === null ? null : draft,
          editor: updateEditor(
            model.editor,
            {
              type: 'PortLabelChanged',
              endpoint: { node: draft.nodeId, port: draft.portId },
              label: draft.text === '' ? undefined : draft.text,
            },
            policy,
          ),
        },
      };
    },
    ClickedAddPort: ({ nodeId, kind }) => {
      const node = model.editor.graph.nodes.find(({ id }) => id === nodeId);
      if (!node || node.kind === 'group') return { model };
      return {
        model: {
          ...model,
          editor: updateEditor(
            model.editor,
            {
              type: 'PortAdded',
              nodeId,
              port: nextPort(node, kind),
            },
            workbenchPolicy(model),
          ),
        },
      };
    },
    SelectedReconnectionSnap: ({ reconnectionSnap }) => ({
      model: { ...model, reconnectionSnap },
    }),
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
    ClickedPortEditProtection: () => ({
      model: { ...model, protectPortEdits: !model.protectPortEdits },
    }),
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
  const next = result.model;
  const changed = next.editor.graph !== model.editor.graph || next.editor.readOnly;
  const invalidLabel =
    next.portLabelDraft &&
    (changed || !next.editor.selectedNodes.includes(next.portLabelDraft.nodeId));
  const invalidPosition =
    next.portPositionDraft &&
    (changed || !next.editor.selectedNodes.includes(next.portPositionDraft.nodeId));
  return invalidLabel || invalidPosition
    ? {
        ...result,
        model: {
          ...next,
          portLabelDraft: invalidLabel ? null : next.portLabelDraft,
          portPositionDraft: invalidPosition ? null : next.portPositionDraft,
        },
      }
    : result;
}
