import {
  applyLayout,
  resolveHistoryComparisonRequest,
  updateEditionPlayback,
  createEventStormingPattern,
  appendEdition,
  mergeEditions,
  resolveEditionRestore,
  restoreEdition,
  type ZlozEdition,
  type ZlozModelDocument,
  captureEdition,
  createHistoryReview,
  updateHistoryReview,
  serializeEditions,
  serializeModelDocument,
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
  type ZlozGraph,
  type ZlozSnapshot,
  type ZlozAuditComparisonRequest,
  type LayoutResult,
} from '@opsydyn/foldkit-zloz';
import { supportsForceLayout } from '@opsydyn/foldkit-zloz-force/eligibility';
import {
  portInspectorContext,
  portPositionDraft,
  updatePortPositionDraft,
  portPositionFromDraft,
  type ZlozPortPositionDraftChange,
} from '@opsydyn/foldkit-zloz/foldkit';
import { Option } from 'effect';
import type { Return } from 'foldkit/update';

import { loadAuditExample, updateWorkbenchAudit } from './audit-comparison';
import {
  createC4ContextGraph,
  createC4ContainerGraph,
  createC4NestedContainerGraph,
} from './c4-examples';
import {
  ArrangeFlow,
  ExportZlozEditions,
  ImportZlozEditions,
  ImportZlozModel,
  ExportFlow,
  ExportZlozModel,
  ExportMermaidBundle,
  ImportZloz,
  LoadZloz,
  SaveThemePreference,
  SaveZloz,
} from './command';
import { createDddOrderGraph } from './ddd-examples';
import { workbenchPolicy } from './editor-policy';
import { delegatedRelationship } from './event-storming-relationships';
import {
  historyAllowsMessage,
  orderEditions,
  scrubberEditions,
  editionArchiveByteLimit,
  editionRestorePolicy,
} from './history';
import { focusWorkbenchHistoryChange } from './history-navigation';
import { createLargeWorkflowGraph, createProtectedWorkflowGraph } from './large-workflow';
import { mermaidPreview } from './mermaid-preview';
import { Message } from './message';
import {
  groupedOnionGraph,
  initialGraph,
  onionGraph,
  portSnappingGraph,
  type Model,
} from './model';
import {
  forkWorkingEdition,
  selectWorkingModel,
  workbenchDocument,
  openModelDocument,
  modelSessionBusy,
} from './model-sessions';
import { insertWorkbenchPattern } from './pattern-insertion';
import {
  toggleHistoryPlayback,
  controlHistoryPlayback,
  seekHistoryPlayback,
  tickHistoryPlayback,
  pauseHistoryPlayback,
  playbackInterruptedBy,
  reconcileHistoryPlayback,
} from './playback';
import { nextPort } from './port-editing';
import { presetPosition } from './port-presets';
import { editWorkbenchRelationship } from './relationship-controls';
import { searchDiagram } from './search';

function frameGraph(graph: ZlozGraph, { surface, fitViewPadding, zoomLimits }: EditorState) {
  const size = surface ?? { width: 800, height: 440 };
  return fitViewport(
    graph,
    size,
    Math.min(fitViewPadding, size.width / 4, size.height / 4),
    zoomLimits,
  );
}

export function update(model: Model, message: Message): Return<Model, Message> {
  if (
    message._tag === 'ObservedModelInput' &&
    (message.modelId !== model.modelIdentity.id || message.epoch !== model.modelEpoch)
  )
    return { model };
  if (playbackInterruptedBy(message)) {
    const paused = pauseHistoryPlayback(model);
    if (paused !== model) return update(paused, message);
  }
  const cancelModelImport = () =>
    model.modelImport
      ? [
          ImportZlozModel.Interrupt({ id: model.modelImport.id }, () =>
            Message.CompletedCancelModelImport(),
          ),
        ]
      : [];
  if (
    model.modelImport &&
    new Set<string>([
      'ClickedLoad',
      'ChoseImportFiles',
      'ChoseEditionArchiveFiles',
      'ClickedArrange',
    ]).has(message._tag)
  )
    return {
      model: {
        ...model,
        notice: 'Finish or cancel model import before starting another document operation.',
      },
    };
  const cancelEditionImport = () =>
    model.editionImport
      ? [
          ImportZlozEditions.Interrupt({ id: model.editionImport.id }, () =>
            Message.CompletedCancelEditionImport(),
          ),
        ]
      : [];
  if (model.historyReview) {
    if (message._tag === 'ObservedZlozInput') {
      // SAFETY: zlozView emits EditorEvent values through the Schema.Unknown input field.
      const event = message.message as EditorEvent;
      const historyReview = updateHistoryReview(
        model.historyReview,
        event,
        workbenchPolicy({ ...model, editor: model.historyReview.editor }),
      );
      return historyReview === model.historyReview
        ? { model }
        : { model: { ...model, historyReview } };
    }
    if (!historyAllowsMessage(message)) return { model };
  }
  const changedPosition = (change: ZlozPortPositionDraftChange): Return<Model, Message> => ({
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
    portAnchorCornerSnapDistance = 0,
    portAnchorMidpointSnapDistance = 0,
    portAnchorSnapPriority,
  } = model.editor;
  const snapshotJson = () =>
    model.includeCamera ? serializeSnapshot(model.editor) : serializeGraph(model.editor.graph);
  const restoreDocument = ({ graph, viewport }: ZlozSnapshot, fitGraphOnly: boolean) => {
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
        portAnchorCornerSnapDistance,
        portAnchorMidpointSnapDistance,
        portAnchorSnapPriority,
      }),
      surface: model.editor.surface,
      clipboard: model.editor.clipboard,
    };
  };
  const outcome: Return<Model, Message> = Message.match(message, {
    ClickedScrubberHistory: () => {
      const decision = mergeEditions(model.editions, scrubberEditions());
      return {
        model:
          decision.type === 'blocked'
            ? { ...model, notice: decision.reason }
            : {
                ...model,
                editions: decision.editions,
                notice: 'Named sample history is available. Your working model is preserved.',
              },
      };
    },
    SelectedPlaybackEdition: (input) => ({ model: seekHistoryPlayback(model, input) }),
    AdvancedEditionPlayback: (message) => ({ model: tickHistoryPlayback(model, message) }),
    ClickedPlaybackEnabled: () => ({ model: toggleHistoryPlayback(model) }),
    ClickedPlaybackPlay: () => ({ model: controlHistoryPlayback(model, { type: 'PlayClicked' }) }),
    ClickedPlaybackPause: () => ({
      model: controlHistoryPlayback(model, { type: 'PauseClicked' }),
    }),
    ClickedPlaybackRewind: () => ({
      model: controlHistoryPlayback(model, { type: 'RewindClicked' }),
    }),
    ClickedPlaybackPrevious: () => ({
      model: controlHistoryPlayback(model, { type: 'PreviousClicked' }),
    }),
    ClickedPlaybackNext: () => ({ model: controlHistoryPlayback(model, { type: 'NextClicked' }) }),
    SelectedPlaybackInterval: ({ intervalMs }) => ({
      model: controlHistoryPlayback(model, { type: 'IntervalChanged', intervalMs }),
    }),
    ChangedPlaybackReducedMotion: ({ reducedMotion }) => ({
      model: controlHistoryPlayback(
        { ...model, playbackReducedMotion: reducedMotion },
        { type: 'ReducedMotionChanged', reducedMotion },
      ),
    }),
    ChangedPlaybackVisibility: ({ visible }) => ({
      model: visible
        ? { ...model, playbackVisible: true }
        : pauseHistoryPlayback({ ...model, playbackVisible: false }),
    }),
    ClickedPatternInsertionProtection: () => ({
      model: { ...model, protectPatternInsertion: !model.protectPatternInsertion },
    }),
    ClickedInsertPattern: ({ pattern }) => ({ model: insertWorkbenchPattern(model, pattern) }),
    ClickedModelImportProtection: () => ({
      model: { ...model, protectModelImport: !model.protectModelImport },
    }),
    ChoseModelDocumentFiles: ({ files }) => {
      if (!files.length)
        return { model: { ...model, modelImport: null }, commands: cancelModelImport() };
      if (files.length !== 1 || files[0]!.size > editionArchiveByteLimit)
        return {
          model: {
            ...model,
            modelImport: null,
            notice: 'Choose one model JSON file up to 5 MiB. Existing models are preserved.',
          },
          commands: cancelModelImport(),
        };
      if (modelSessionBusy({ ...model, modelImport: null }) || model.protectModelImport)
        return {
          model: {
            ...model,
            notice: 'Finish active operations and allow model import before opening a model.',
          },
        };
      const id = model.sequence + 1;
      return {
        model: {
          ...model,
          sequence: id,
          modelImport: {
            id,
            epoch: model.modelEpoch,
            revision: model.editor.revision,
            graph: model.editor.graph,
          },
          notice: 'Reading model document…',
        },
        commands: [...cancelModelImport(), ImportZlozModel({ id, file: files[0]! })],
      };
    },
    ClickedCancelModelImport: () => ({
      model: {
        ...model,
        modelImport: null,
        notice: 'Model import cancelled. Existing models are preserved.',
      },
      commands: cancelModelImport(),
    }),
    CompletedCancelModelImport: () => ({ model }),
    FailedModelDocumentImport: ({ id }) =>
      model.modelImport?.id === id
        ? {
            model: {
              ...model,
              modelImport: null,
              notice:
                'Invalid, unsupported or unreadable model JSON. Existing models are preserved.',
            },
          }
        : { model },
    SucceededModelDocumentImport: ({ id, document: raw }) => {
      const request = model.modelImport;
      if (!request || request.id !== id) return { model };
      const ready = { ...model, modelImport: null };
      if (
        request.epoch !== model.modelEpoch ||
        request.revision !== model.editor.revision ||
        request.graph !== model.editor.graph
      )
        return {
          model: {
            ...ready,
            notice: 'The source session changed while reading. Choose the model file again.',
          },
        };
      // SAFETY: ImportZlozModel validates this document through the canonical model codec before dispatch.
      return { model: openModelDocument(ready, raw as ZlozModelDocument) };
    },
    ObservedModelInput: ({ message }) => update(model, Message.ObservedZlozInput({ message })),
    ChangedForkName: ({ name }) => ({ model: { ...model, forkName: name } }),
    ClickedEditionForkProtection: () => ({
      model: { ...model, protectEditionFork: !model.protectEditionFork },
    }),
    ClickedForkEdition: () => ({ model: forkWorkingEdition(model) }),
    SelectedWorkingModel: ({ id }) => ({ model: selectWorkingModel(model, id) }),
    ClickedExportModel: () => ({
      model,
      commands: [ExportZlozModel({ json: serializeModelDocument(workbenchDocument(model)) })],
    }),
    ChoseEditionArchiveFiles: ({ files }) => {
      if (files.length === 0)
        return {
          model: { ...model, editionImport: null, notice: 'Edition import cancelled.' },
          commands: cancelEditionImport(),
        };
      const file = files[0]!;
      if (files.length !== 1 || file.size > editionArchiveByteLimit)
        return {
          model: {
            ...model,
            editionImport: null,
            notice:
              'Choose one edition archive up to 5 MiB. Your editions and working model are preserved.',
          },
          commands: cancelEditionImport(),
        };
      const id = model.sequence + 1;
      return {
        model: {
          ...model,
          sequence: id,
          editionImport: { id, editions: model.editions },
          editionRestore: null,
          notice: 'Reading edition archive…',
        },
        commands: [...cancelEditionImport(), ImportZlozEditions({ id, file })],
      };
    },
    SucceededEditionArchiveImport: ({ id, editions: raw }) => {
      if (model.editionImport?.id !== id) return { model };
      if (model.editionImport.editions !== model.editions)
        return {
          model: {
            ...model,
            editionImport: null,
            notice: 'Editions changed during import. Choose the archive again.',
          },
        };
      // SAFETY: ImportZlozEditions decodes these edition records with the canonical parser before emitting this message.
      const incoming = raw as readonly ZlozEdition[];
      const decision = mergeEditions(model.editions, incoming);
      return decision.type === 'blocked'
        ? { model: { ...model, editionImport: null, notice: decision.reason } }
        : {
            model: {
              ...model,
              editionImport: null,
              editionRestore: null,
              editions: decision.editions,
              notice:
                decision.type === 'unchanged'
                  ? 'These editions are already available. Your working model is preserved.'
                  : 'Edition archive imported. Your working model is preserved.',
            },
          };
    },
    FailedEditionArchiveImport: ({ id }) =>
      model.editionImport?.id === id
        ? {
            model: {
              ...model,
              editionImport: null,
              notice:
                'Invalid or unreadable edition archive. Your editions and working model are preserved.',
            },
          }
        : { model },
    CompletedCancelEditionImport: () => ({ model }),
    ClickedCancelEditionImport: () => ({
      model: { ...model, editionImport: null, notice: 'Edition import cancelled.' },
      commands: cancelEditionImport(),
    }),
    ClickedPreviewEditionRestore: () => {
      const edition = model.editions.find((item) => item.id === model.historyReview?.editionId);
      if (!edition || model.editionImport) return { model };
      const decision = resolveEditionRestore(model.editor, edition, {
        expectedRevision: model.editor.revision,
        policy: editionRestorePolicy(model),
      });
      return decision.type === 'ready'
        ? {
            model: {
              ...model,
              editionRestore: {
                edition: decision.edition,
                expectedRevision: decision.expectedRevision,
              },
              notice:
                'Review the graph replacement before restoring. The camera will stay unchanged.',
            },
          }
        : {
            model: {
              ...model,
              editionRestore: null,
              notice:
                decision.type === 'blocked'
                  ? decision.reason
                  : 'This edition already matches the working graph.',
            },
          };
    },
    ClickedConfirmEditionRestore: () => {
      const preview = model.editionRestore;
      if (!preview || model.editionImport) return { model };
      const result = restoreEdition(model.editor, preview.edition, {
        expectedRevision: preview.expectedRevision,
        policy: editionRestorePolicy(model),
      });
      if (result.type === 'blocked') return { model: { ...model, notice: result.reason } };
      const surface = model.historyReview?.editor.surface ?? result.editor.surface;
      const editor =
        surface?.width === result.editor.surface?.width &&
        surface?.height === result.editor.surface?.height
          ? result.editor
          : { ...result.editor, surface };
      return {
        model: {
          ...model,
          editor,
          modelEpoch: model.modelEpoch + 1,
          editionRestore: null,
          historyReview: null,
          historyBaselineId: null,
          active: null,
          importing: null,
          notice:
            result.type === 'restored'
              ? 'Edition restored as one new change. Undo returns to your previous working graph; the camera is unchanged.'
              : 'The working graph already matches this edition.',
        },
      };
    },
    ClickedCancelEditionRestore: () => ({
      model: {
        ...model,
        editionRestore: null,
        notice: 'Restore cancelled. Your working model is preserved.',
      },
    }),
    ClickedEditionRestoreProtection: () => ({
      model: { ...model, protectEditionRestore: !model.protectEditionRestore },
    }),
    ChangedEditionName: ({ name }) => ({ model: { ...model, editionName: name } }),
    ClickedCaptureEdition: () => {
      if (
        !model.editionName.trim() ||
        model.editor.gesture.type !== 'idle' ||
        model.active ||
        model.importing
      )
        return { model };
      let sequence = model.sequence + 1;
      const existing = new Set(model.editions.map((item) => item.id));
      while (existing.has(`edition-${sequence}`)) sequence++;
      const edition = captureEdition({
        id: `edition-${sequence}`,
        name: model.editionName.trim(),
        snapshot: { graph: model.editor.graph, viewport: model.editor.viewport },
      });
      return {
        model: {
          ...model,
          sequence,
          editions: appendEdition(model.editions, edition),
          editionName: '',
          notice: 'Edition captured. Export editions to retain them outside this session.',
        },
      };
    },
    ClickedOrderHistory: () => ({
      model: {
        ...model,
        editions: orderEditions().reduce(
          (editions, edition) =>
            editions.some((item) => item.id === edition.id)
              ? editions
              : appendEdition(editions, edition),
          model.editions,
        ),
        sidebarSection: 'history' as const,
        notice: 'Two example editions loaded. Your working model is preserved.',
      },
    }),
    ClickedAuditExample: () => ({ model: loadAuditExample(model) }),
    ObservedAuditComparisonInput: ({ modelId, epoch, request: raw }) => {
      // SAFETY: the public comparison view emits typed requests through this Schema.Unknown field; the resolver rechecks current identity and policy.
      const request = raw as ZlozAuditComparisonRequest;
      return { model: updateWorkbenchAudit(model, request, modelId, epoch) };
    },
    SelectedHistoryEdition: ({ id }) => {
      const index = model.editions.findIndex((edition) => edition.id === id);
      const edition = model.editions[index];
      if (!edition || model.editor.gesture.type !== 'idle' || model.active || model.importing)
        return { model };
      const source = model.historyReview
        ? { ...model.editor, surface: model.historyReview.editor.surface }
        : model.editor;
      const review = createHistoryReview(edition, source);
      return {
        model: {
          ...model,
          modelEpoch: model.modelEpoch + 1,
          historyReview: edition.snapshot.viewport
            ? review
            : updateHistoryReview(review, { type: 'FitViewClicked' }),
          historyPlayback: model.historyPlayback
            ? {
                ...model.historyPlayback,
                cursor: updateEditionPlayback(model.historyPlayback.cursor, {
                  type: 'EditionSelected',
                  id,
                }),
              }
            : null,
          historyBaselineId: model.editions[index - 1]?.id ?? null,
          editionRestore: null,
          active: null,
          importing: null,
          portPositionDraft: null,
          portLabelDraft: null,
          notice: 'Historical edition: read-only. Your working model is preserved.',
        },
      };
    },
    ClickedHistoryPresent: () => {
      const surface = model.historyReview?.editor.surface ?? model.editor.surface;
      const sameSurface =
        surface?.width === model.editor.surface?.width &&
        surface?.height === model.editor.surface?.height;
      return {
        model: {
          ...model,
          modelEpoch: model.modelEpoch + 1,
          editor: sameSurface ? model.editor : { ...model.editor, surface },
          historyReview: null,
          editionRestore: null,
          historyBaselineId: null,
          notice: 'Returned to the unchanged working model.',
        },
      };
    },
    ClickedHistoryChangeFilter: ({ kind }) => ({
      model: {
        ...model,
        historyChangeFilters: {
          ...model.historyChangeFilters,
          [kind]: !model.historyChangeFilters[kind],
        },
      },
    }),
    ClickedHistoryChange: (input) => ({ model: focusWorkbenchHistoryChange(model, input) }),
    SelectedHistoryBaseline: ({ id }) => {
      const decision = resolveHistoryComparisonRequest(
        model.editions,
        model.historyReview?.editionId ?? null,
        { baselineId: model.historyBaselineId, ghosts: model.historyGhosts },
        { type: 'BaselineSelected', editionId: id || null },
      );
      return {
        model:
          decision.type === 'ready'
            ? { ...model, historyBaselineId: decision.state.baselineId }
            : model,
      };
    },
    ClickedHistoryGhost: ({ part }) => {
      const decision = resolveHistoryComparisonRequest(
        model.editions,
        model.historyReview?.editionId ?? null,
        { baselineId: model.historyBaselineId, ghosts: model.historyGhosts },
        { type: 'GhostVisibilityToggled', part },
      );
      return {
        model:
          decision.type === 'ready' ? { ...model, historyGhosts: decision.state.ghosts } : model,
      };
    },
    ChangedHistoryGhostVisibility: ({ part, value }) => {
      const decision = resolveHistoryComparisonRequest(
        model.editions,
        model.historyReview?.editionId ?? null,
        { baselineId: model.historyBaselineId, ghosts: model.historyGhosts },
        { type: 'GhostVisibilityChanged', part, value },
      );
      return {
        model:
          decision.type === 'ready' ? { ...model, historyGhosts: decision.state.ghosts } : model,
      };
    },
    ClickedExportEditions: () => ({
      model,
      commands: [ExportZlozEditions({ json: serializeEditions(model.editions) })],
    }),
    CompletedExportEditions: () => ({
      model: { ...model, notice: 'Edition archive download started.' },
    }),
    FailedExportEditions: () => ({
      model: {
        ...model,
        notice: 'Could not download editions. They remain available in this session.',
      },
    }),
    ObservedZlozInput: ({ message: input }) => {
      // SAFETY: zlozView and the toolbar emit the package's typed EditorEvent contract.
      const event = input as EditorEvent;
      return {
        model: {
          ...model,
          editor: updateEditor(model.editor, event, workbenchPolicy(model)),
        },
      };
    },
    ChangedPortChooserSearch: ({ field, query }) => ({
      model: { ...model, portChooserQueries: { ...model.portChooserQueries, [field]: query } },
    }),
    ChangedDiagramSearch: ({ query }) => ({ model: { ...model, searchQuery: query } }),
    SelectedSearchScope: ({ scope }) => ({ model: { ...model, searchScope: scope } }),
    SubmittedDiagramSearch: () => {
      const result = searchDiagram(model.editor, model.searchQuery, model.searchScope)[0];
      if (!result) return { model };
      return { model: { ...model, editor: updateEditor(model.editor, result.event) } };
    },
    SelectedExample: ({ example }) => {
      const graph =
        example === 'event-storming'
          ? createEventStormingPattern({ includeAggregate: true })
          : example === 'large-workflow'
            ? createLargeWorkflowGraph()
            : example === 'protected-orbits'
              ? createProtectedWorkflowGraph()
              : example === 'ddd-orders'
                ? createDddOrderGraph()
                : example === 'c4-context'
                  ? createC4ContextGraph()
                  : example === 'c4-nested-containers'
                    ? createC4NestedContainerGraph()
                    : example === 'c4-containers'
                      ? createC4ContainerGraph()
                      : {
                          release: initialGraph,
                          onion: onionGraph,
                          'grouped-onion': groupedOnionGraph,
                          'port-snapping': portSnappingGraph,
                        }[example];
      const editor = restoreDocument({ graph }, true);
      return {
        model: {
          ...model,
          editor,
          semanticRelationships: example === 'event-storming' ? true : model.semanticRelationships,
          nodeDesign:
            example === 'event-storming'
              ? 'event-storming'
              : example === 'protected-orbits'
                ? 'orbits'
                : example === 'ddd-orders'
                  ? 'ddd'
                  : example === 'c4-context' ||
                      example === 'c4-containers' ||
                      example === 'c4-nested-containers'
                    ? 'c4'
                    : model.nodeDesign,
          retainNodeViews: example === 'protected-orbits' || model.retainNodeViews,
          customPorts: example === 'protected-orbits' || model.customPorts,
          mixedPortProtection: example === 'protected-orbits' || model.mixedPortProtection,
          socketReasonBadges: example === 'protected-orbits' || model.socketReasonBadges,
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
    ClickedKeyboardPortTargets: () => ({
      model: { ...model, keyboardPortTargets: !model.keyboardPortTargets },
    }),
    ClickedOverlappingPortSnaps: () => ({
      model:
        model.editor.gesture.type === 'idle'
          ? { ...model, overlappingPortSnaps: !model.overlappingPortSnaps }
          : model,
    }),
    SelectedPortAnchorSnapPriority: ({ priority }) => ({
      model: {
        ...model,
        editor: updateEditor(model.editor, { type: 'PortAnchorSnapPriorityChanged', priority }),
      },
    }),
    ClickedPortAnchorGuides: () => ({
      model: { ...model, portAnchorGuides: !model.portAnchorGuides },
    }),
    ClickedCustomPortAnchorGuides: () => ({
      model: { ...model, customPortAnchorGuides: !model.customPortAnchorGuides },
    }),
    ClickedRestrictedSnapTargets: () => ({
      model:
        model.editor.gesture.type === 'idle'
          ? { ...model, restrictedSnapTargets: !model.restrictedSnapTargets }
          : model,
    }),
    ClickedPerPortSnapping: () => ({
      model:
        model.editor.gesture.type === 'idle'
          ? { ...model, perPortSnapping: !model.perPortSnapping }
          : model,
    }),
    ClickedPortAnchorSnapBypass: () => ({
      model:
        model.editor.gesture.type === 'idle'
          ? { ...model, portAnchorSnapBypass: !model.portAnchorSnapBypass }
          : model,
    }),
    ClickedPortAnchorSnapHysteresis: () => ({
      model: {
        ...model,
        editor: updateEditor(model.editor, {
          type: 'PortAnchorSnapHysteresisChanged',
          distance: (model.editor.portAnchorSnapHysteresis ?? 0) > 0 ? 0 : 4,
        }),
      },
    }),
    ClickedPortAnchorMidpointSnap: () => ({
      model: {
        ...model,
        editor: updateEditor(model.editor, {
          type: 'PortAnchorMidpointSnapDistanceChanged',
          distance: (model.editor.portAnchorMidpointSnapDistance ?? 0) > 0 ? 0 : 12,
        }),
      },
    }),
    ClickedPortAnchorCornerSnap: () => ({
      model: {
        ...model,
        editor: updateEditor(model.editor, {
          type: 'PortAnchorCornerSnapDistanceChanged',
          distance: (model.editor.portAnchorCornerSnapDistance ?? 0) > 0 ? 0 : 12,
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
    ClickedSocketReasonBadges: () => ({
      model: { ...model, socketReasonBadges: !model.socketReasonBadges },
    }),
    ClickedMixedPortProtection: () => ({
      model: {
        ...model,
        mixedPortProtection: !model.mixedPortProtection,
        editor: model.editor.connection
          ? updateEditor(model.editor, { type: 'GestureCancelled' })
          : model.editor,
      },
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
    SelectedCausalRelationship: (input) => ({
      model: editWorkbenchRelationship(model, { ...input, type: 'RelationshipSelected' }),
    }),
    ClickedRelationshipInference: (input) => ({
      model: editWorkbenchRelationship(model, { ...input, type: 'InferenceApplied' }),
    }),
    ClickedSemanticRelationships: () => ({
      model: { ...model, semanticRelationships: !model.semanticRelationships },
    }),
    ClickedCustomStormingRelationships: () => ({
      model: { ...model, customStormingRelationships: !model.customStormingRelationships },
    }),
    ClickedDelegatedRelationship: ({ modelId, epoch }) => {
      if (
        modelId !== model.modelIdentity.id ||
        epoch !== model.modelEpoch ||
        modelSessionBusy(model) ||
        model.editor.readOnly
      )
        return { model };
      const edge = delegatedRelationship(model);
      return {
        model: edge
          ? {
              ...model,
              editor: updateEditor(
                model.editor,
                { type: 'ConnectionCreated', edge },
                workbenchPolicy(model),
              ),
            }
          : model,
      };
    },
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
    SelectedWorkbenchSection: ({ section }) => ({
      model: {
        ...model,
        sidebarSection: section,
        diagnosticsPanelOpen: section === 'diagnostics' || model.diagnosticsPanelOpen,
        sidebarCollapsed: false,
        mermaidPreviewOpen: section === 'export' || model.mermaidPreviewOpen,
      },
    }),
    ClickedWorkbenchSidebar: () => ({
      model: { ...model, sidebarCollapsed: !model.sidebarCollapsed },
    }),
    ClickedMermaidPreview: (): Return<Model, Message> => {
      const opening = !model.mermaidPreviewOpen || model.sidebarSection !== 'export';
      return {
        model: {
          ...model,
          sidebarSection: opening ? 'export' : 'diagram',
          sidebarCollapsed: false,
          mermaidPreviewOpen: opening,
          mermaidLossConsentRevision:
            opening && model.mermaidPreviewOpen ? model.mermaidLossConsentRevision : null,
        },
      };
    },
    ClickedMermaidLossConsent: () => ({
      model: {
        ...model,
        mermaidLossConsentRevision:
          model.mermaidPreviewOpen && model.mermaidLossConsentRevision !== model.editor.revision
            ? model.editor.revision
            : null,
      },
    }),
    ClickedMermaidDownload: () => {
      if (!model.mermaidPreviewOpen) return { model };
      const result = mermaidPreview(model);
      if (result.status !== 'converted') return { model };
      return {
        model,
        commands: [ExportMermaidBundle({ json: JSON.stringify(result.value, null, 2) })],
      };
    },
    CompletedMermaidDownload: () => ({
      model: {
        ...model,
        notice: 'Mermaid bundle download started. Keep Zloz JSON as the authoritative document.',
      },
    }),
    FailedMermaidDownload: () => ({
      model: {
        ...model,
        notice: 'Could not start the Mermaid bundle download. Your graph is preserved.',
      },
    }),
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
        commands: [ImportZloz({ id, file })],
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
          modelEpoch: model.modelEpoch + 1,
          notice: 'JSON diagram imported.',
        },
      };
    },
    ClickedSave: () => ({
      model,
      commands: [SaveZloz({ json: snapshotJson() })],
    }),
    ClickedLoad: () => {
      const id = model.sequence + 1;
      return {
        model: {
          ...model,
          sequence: id,
          importing: { id, revision: model.editor.revision },
          notice: 'Reading saved diagram…',
        },
        commands: [LoadZloz({ id })],
      };
    },
    SucceededSave: () => ({ model: { ...model, notice: 'Saved on this browser.' } }),
    FailedStorage: () => ({
      model: {
        ...model,
        notice: 'Saved graph unavailable or invalid. Your current graph is preserved.',
      },
    }),
  });
  const result = { ...outcome, model: reconcileHistoryPlayback(model, outcome.model) };
  const next = result.model;
  const changed = next.editor.graph !== model.editor.graph || next.editor.readOnly;
  const invalidLabel =
    next.portLabelDraft &&
    (changed || !next.editor.selectedNodes.includes(next.portLabelDraft.nodeId));
  const invalidPosition =
    next.portPositionDraft &&
    (changed || !next.editor.selectedNodes.includes(next.portPositionDraft.nodeId));
  const invalidMermaidConsent =
    next.editor.graph !== model.editor.graph && next.mermaidLossConsentRevision !== null;
  return invalidLabel || invalidPosition || invalidMermaidConsent
    ? {
        ...result,
        model: {
          ...next,
          mermaidLossConsentRevision: invalidMermaidConsent
            ? null
            : next.mermaidLossConsentRevision,
          portLabelDraft: invalidLabel ? null : next.portLabelDraft,
          portPositionDraft: invalidPosition ? null : next.portPositionDraft,
        },
      }
    : result;
}
