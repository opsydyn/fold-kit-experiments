import { finitePoint, fitViewport, screenToWorld, zoomAt } from './geometry';
import { applyGroupConnectionV3, type ZlozGroupConnectionEditV3 } from './group-connection-v3';
import { captureGroupDocumentV3, type ZlozGroupDocumentV3 } from './group-document-v3';
import {
  createGroupEditorV3,
  captureGroupEditorSourceV3,
  updateGroupEditorV3,
  type ZlozGroupEditorOptionsV3,
  type ZlozGroupEditorStateV3,
  type ZlozGroupEditorSourceV3,
  type ZlozGroupEditorPolicyV3,
} from './group-editor-v3';
import {
  applyGroupOperationV3,
  planGroupOperationV3,
  type ZlozGroupOperationV3,
} from './group-operations-v3';
import { applyGroupPortEditV3, type ZlozGroupPortEditV3 } from './group-port-edit-v3';
import { presentGroups } from './group-presentation';
import { historyValueEqual } from './history';
import type { EditorEvent, Endpoint, Point, Size, Viewport, ZlozGraph } from './types';

export type ZlozGroupWorkbenchGestureV3 =
  | Readonly<{ type: 'idle' }>
  | Readonly<{
      type: 'move';
      pointer: number;
      source: ZlozGroupEditorSourceV3;
      nodeIds: readonly string[];
      origin: Point;
      delta: Point;
    }>
  | Readonly<{ type: 'pan'; pointer: number; origin: Point; viewport: Viewport }>
  | Readonly<{
      type: 'connect';
      pointer: number;
      source: ZlozGroupEditorSourceV3;
      endpoint: Endpoint;
      target: Endpoint | null;
    }>;
/** One authored document in editor; selection, camera, collapse and gestures are transient. */
export type ZlozGroupWorkbenchV3 = Readonly<{
  editor: ZlozGroupEditorStateV3;
  selectedNodeIds: readonly string[];
  selectedEdgeId: string | null;
  collapsedGroupIds: readonly string[];
  viewport: Viewport;
  surface: Size;
  gesture: ZlozGroupWorkbenchGestureV3;
  connectionSource: Endpoint | null;
  status: string;
}>;
export type ZlozGroupWorkbenchEventV3 =
  | EditorEvent
  | Readonly<{ type: 'GroupOperationRequested'; operation: ZlozGroupOperationV3 }>
  | Readonly<{ type: 'GroupPortEditRequested'; edit: ZlozGroupPortEditV3 }>
  | Readonly<{ type: 'ConnectionEditRequested'; edit: ZlozGroupConnectionEditV3 }>
  | Readonly<{ type: 'GroupCollapseToggled'; id: string }>
  | Readonly<{ type: 'FitViewRequested' }>;
export type ZlozGroupWorkbenchOptionsV3 = Readonly<{ grid?: number }>;
export function createGroupWorkbenchV3(
  document: ZlozGroupDocumentV3,
  options: ZlozGroupEditorOptionsV3,
): ZlozGroupWorkbenchV3 {
  const editor = createGroupEditorV3(document, options);
  return {
    editor,
    selectedNodeIds: [],
    selectedEdgeId: null,
    collapsedGroupIds: [],
    viewport: editor.document.viewport ?? { x: 20, y: 20, zoom: 1 },
    surface: { width: 800, height: 600 },
    gesture: { type: 'idle' },
    connectionSource: null,
    status: 'Select a node or port. Arrow keys move the selection; Escape cancels.',
  };
}
function completed(
  model: ZlozGroupWorkbenchV3,
  result: Readonly<{ type: string; editor: ZlozGroupEditorStateV3; reason?: string }>,
): ZlozGroupWorkbenchV3 {
  const nodes = new Set(result.editor.document.graph.nodes.map((node) => node.id));
  return {
    ...model,
    editor: result.editor,
    viewport: historyValueEqual(model.editor.document.viewport, result.editor.document.viewport)
      ? model.viewport
      : (result.editor.document.viewport ?? { x: 20, y: 20, zoom: 1 }),
    gesture: { type: 'idle' },
    status:
      result.reason ??
      (result.type === 'applied' ? 'Change applied. Undo is available.' : 'No document change.'),
    selectedNodeIds: model.selectedNodeIds.filter((id) => nodes.has(id)),
    collapsedGroupIds: model.collapsedGroupIds.filter((id) => nodes.has(id)),
    selectedEdgeId: result.editor.document.graph.edges.some(
      (edge) => edge.id === model.selectedEdgeId,
    )
      ? model.selectedEdgeId
      : null,
  };
}
function sourceReason(
  model: ZlozGroupWorkbenchV3,
  endpoint: Endpoint,
  policy: ZlozGroupEditorPolicyV3,
): string | null {
  const graph = model.editor.document.graph,
    port = graph.nodes
      .find((node) => node.id === endpoint.node)
      ?.ports.find((p) => p.id === endpoint.port);
  if (!port) return 'This connection source no longer exists.';
  if (model.editor.document.connectionMode === 'strict' && port.kind !== 'output')
    return 'Strict connections start at an output port.';
  const reason = policy.canConnectPort?.(endpoint, graph);
  return reason == null ? null : reason.trim() || 'This port is protected.';
}
function edgeId(model: ZlozGroupWorkbenchV3): string {
  const ids = new Set(model.editor.document.graph.edges.map((edge) => edge.id));
  let index = 0;
  while (ids.has(`${model.editor.sessionId}:edge:${model.editor.revision + 1}:${index}`)) index++;
  return `${model.editor.sessionId}:edge:${model.editor.revision + 1}:${index}`;
}
/** Capture a portable view checkpoint; this does not publish editor state or grant Apply permission. */
export function captureGroupWorkbenchDocumentV3(model: ZlozGroupWorkbenchV3): ZlozGroupDocumentV3 {
  return captureGroupDocumentV3({ ...model.editor.document, viewport: model.viewport });
}
/** Recompute transient geometry through the same live planner used at release. No preview is authority. */
export function groupWorkbenchGraphV3(
  model: ZlozGroupWorkbenchV3,
  policy: ZlozGroupEditorPolicyV3 = {},
): ZlozGraph {
  if (model.gesture.type !== 'move') return model.editor.document.graph;
  const plan = planGroupOperationV3(
    model.editor,
    {
      source: model.gesture.source,
      operation: { operation: 'move', nodeIds: model.gesture.nodeIds, delta: model.gesture.delta },
    },
    policy,
  );
  return plan.type === 'ready' ? plan.transaction.document.graph : model.editor.document.graph;
}
/** Native/browser facts and custom controls share source-bound live v3 transactions. */
export function updateGroupWorkbenchV3(
  model: ZlozGroupWorkbenchV3,
  event: ZlozGroupWorkbenchEventV3,
  policy: ZlozGroupEditorPolicyV3 = {},
  options: ZlozGroupWorkbenchOptionsV3 = {},
): ZlozGroupWorkbenchV3 {
  const editor = model.editor,
    graph = editor.document.graph;
  const source = () => captureGroupEditorSourceV3(editor);
  const operate = (operation: ZlozGroupOperationV3) =>
    completed(model, applyGroupOperationV3(editor, { source: source(), operation }, policy));
  const grid = options.grid ?? 1;
  if (!Number.isFinite(grid) || grid <= 0)
    throw new RangeError('Grid must be positive and finite.');
  if (
    model.gesture.type !== 'idle' &&
    [
      'GroupOperationRequested',
      'GroupPortEditRequested',
      'ConnectionEditRequested',
      'UndoPressed',
      'RedoPressed',
      'DeletePressed',
    ].includes(event.type)
  )
    return { ...model, status: 'Finish or cancel the active gesture first.' };
  switch (event.type) {
    case 'GroupOperationRequested':
      return operate(event.operation);
    case 'GroupPortEditRequested':
      return completed(
        model,
        applyGroupPortEditV3(editor, { source: source(), edit: event.edit }, policy),
      );
    case 'ConnectionEditRequested':
      return completed(
        model,
        applyGroupConnectionV3(editor, { source: source(), edit: event.edit }, policy),
      );
    case 'UndoPressed':
    case 'RedoPressed':
      return completed(
        model,
        updateGroupEditorV3(editor, { type: event.type, source: source() }, policy),
      );
    case 'GestureCancelled':
      return {
        ...model,
        gesture: { type: 'idle' },
        connectionSource: null,
        status: 'Gesture cancelled. The document is unchanged.',
      };
    case 'NodeSelected': {
      const node = graph.nodes.find((n) => n.id === event.id);
      if (!node) return model;
      const reason = policy.canSelectNode?.(node, graph);
      if (reason != null)
        return { ...model, status: reason.trim() || 'Node selection is protected.' };
      const selectedNodeIds = event.additive
        ? model.selectedNodeIds.includes(event.id)
          ? model.selectedNodeIds.filter((id) => id !== event.id)
          : [...model.selectedNodeIds, event.id]
        : [event.id];
      return { ...model, selectedNodeIds, selectedEdgeId: null };
    }
    case 'EdgeSelected': {
      const edge = graph.edges.find((e) => e.id === event.id);
      if (!edge) return model;
      const reason = policy.canSelectEdge?.(edge, graph);
      return reason != null
        ? { ...model, status: reason.trim() || 'Connection selection is protected.' }
        : { ...model, selectedEdgeId: event.id, selectedNodeIds: [] };
    }
    case 'SelectionCleared':
      return model.gesture.type === 'idle'
        ? { ...model, selectedNodeIds: [], selectedEdgeId: null }
        : model;
    case 'NodeDragStarted': {
      if (model.gesture.type !== 'idle') return model;
      const selected = model.selectedNodeIds.includes(event.id)
        ? model
        : updateGroupWorkbenchV3(
            model,
            { type: 'NodeSelected', id: event.id, additive: false },
            policy,
            options,
          );
      if (!selected.selectedNodeIds.includes(event.id)) return selected;
      const gesture = {
        type: 'move' as const,
        pointer: event.pointer,
        source: source(),
        nodeIds: selected.selectedNodeIds,
        origin: screenToWorld(event.point, model.viewport),
        delta: { x: 0, y: 0 },
      };
      return { ...selected, gesture };
    }
    case 'PointerMoved': {
      const gesture = model.gesture;
      if (gesture.type === 'idle' || gesture.pointer !== event.pointer) return model;
      finitePoint(event.point);
      if (gesture.type === 'pan')
        return {
          ...model,
          viewport: {
            ...gesture.viewport,
            x: gesture.viewport.x + event.point.x - gesture.origin.x,
            y: gesture.viewport.y + event.point.y - gesture.origin.y,
          },
        };
      if (gesture.type === 'connect')
        return { ...model, gesture: { ...gesture, target: event.target ?? null } };
      const world = screenToWorld(event.point, model.viewport),
        delta = {
          x: Math.round((world.x - gesture.origin.x) / grid) * grid,
          y: Math.round((world.y - gesture.origin.y) / grid) * grid,
        };
      const plan = planGroupOperationV3(
        editor,
        {
          source: gesture.source,
          operation: { operation: 'move', nodeIds: gesture.nodeIds, delta },
        },
        policy,
      );
      return {
        ...model,
        gesture: { ...gesture, delta },
        status:
          plan.type === 'blocked' ? plan.reason : 'Preview. Release to apply; Escape cancels.',
      };
    }
    case 'PointerReleased': {
      const gesture = model.gesture;
      if (gesture.type === 'idle' || gesture.pointer !== event.pointer) return model;
      if (gesture.type === 'pan') return { ...model, gesture: { type: 'idle' } };
      if (gesture.type === 'move')
        return completed(
          model,
          applyGroupOperationV3(
            editor,
            {
              source: gesture.source,
              operation: { operation: 'move', nodeIds: gesture.nodeIds, delta: gesture.delta },
            },
            policy,
          ),
        );
      if (!gesture.target)
        return {
          ...model,
          gesture: { type: 'idle' },
          status: 'No connection target. The document is unchanged.',
        };
      return completed(
        model,
        applyGroupConnectionV3(
          editor,
          {
            source: gesture.source,
            edit: {
              operation: 'create',
              edges: [{ id: edgeId(model), source: gesture.endpoint, target: gesture.target }],
            },
          },
          policy,
        ),
      );
    }
    case 'ConnectionDragStarted': {
      const reason = sourceReason(model, event.endpoint, policy);
      if (reason !== null) return { ...model, status: reason };
      return model.gesture.type !== 'idle'
        ? model
        : {
            ...model,
            connectionSource: null,
            gesture: {
              type: 'connect',
              source: source(),
              pointer: event.pointer,
              endpoint: event.endpoint,
              target: null,
            },
          };
    }
    case 'PortActivated': {
      if (model.gesture.type !== 'idle') return model;
      if (!model.connectionSource) {
        const reason = sourceReason(model, event.endpoint, policy);
        if (reason !== null) return { ...model, status: reason };
        return {
          ...model,
          connectionSource: event.endpoint,
          status: 'Source chosen. Activate a target port or press Escape.',
        };
      }
      return {
        ...completed(
          model,
          applyGroupConnectionV3(
            editor,
            {
              source: source(),
              edit: {
                operation: 'create',
                edges: [
                  { id: edgeId(model), source: model.connectionSource, target: event.endpoint },
                ],
              },
            },
            policy,
          ),
        ),
        connectionSource: null,
      };
    }
    case 'SelectionNudged':
      if (event.id && !model.selectedNodeIds.includes(event.id)) {
        const selected = updateGroupWorkbenchV3(
          model,
          { type: 'NodeSelected', id: event.id, additive: false },
          policy,
          options,
        );
        return selected.selectedNodeIds.includes(event.id)
          ? updateGroupWorkbenchV3(
              selected,
              { type: 'SelectionNudged', delta: event.delta },
              policy,
              options,
            )
          : selected;
      }
      return model.selectedNodeIds.length
        ? operate({ operation: 'move', nodeIds: model.selectedNodeIds, delta: event.delta })
        : model;
    case 'DeletePressed':
      return operate({
        operation: 'delete',
        nodeIds: model.selectedNodeIds,
        edgeIds: model.selectedEdgeId ? [model.selectedEdgeId] : [],
      });
    case 'GroupCollapseToggled': {
      if (
        model.gesture.type !== 'idle' ||
        !graph.nodes.some((node) => node.id === event.id && node.kind === 'group')
      )
        return model;
      const collapsedGroupIds = model.collapsedGroupIds.includes(event.id)
        ? model.collapsedGroupIds.filter((id) => id !== event.id)
        : [...model.collapsedGroupIds, event.id];
      const visible = new Set(presentGroups(graph, collapsedGroupIds).nodes.map((node) => node.id));
      return {
        ...model,
        collapsedGroupIds,
        selectedNodeIds: model.selectedNodeIds.filter((id) => visible.has(id)),
        connectionSource: null,
      };
    }
    case 'PanStarted':
      return model.gesture.type !== 'idle'
        ? model
        : {
            ...model,
            gesture: {
              type: 'pan',
              pointer: event.pointer,
              origin: event.point,
              viewport: model.viewport,
            },
          };
    case 'ViewportNudged':
      return {
        ...model,
        viewport: {
          ...model.viewport,
          x: model.viewport.x + event.delta.x,
          y: model.viewport.y + event.delta.y,
        },
      };
    case 'Zoomed':
      return model.gesture.type !== 'idle'
        ? model
        : { ...model, viewport: zoomAt(model.viewport, event.point, event.factor) };
    case 'SurfaceMeasured':
      return { ...model, surface: event.size };
    case 'FitViewRequested':
      return { ...model, viewport: fitViewport(graph, model.surface), gesture: { type: 'idle' } };
    case 'NodeFocusChanged':
    case 'ContextDismissed':
    case 'NodeMeasured':
      return model;
    default:
      return {
        ...model,
        status: `${event.type} is not supported by the v3 native controls. Use the documented v3 planners for custom controls.`,
      };
  }
}
