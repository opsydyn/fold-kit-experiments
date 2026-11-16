import { portAnchor, finitePoint, fitViewport, screenToWorld, zoomAt } from './geometry';
import {
  applyGroupPasteV3,
  copyGroupSelectionV3,
  groupPasteRequestV3,
  type ZlozGroupClipboardV3,
  type ZlozGroupClipboardFindingV3,
  type ZlozGroupClipboardPolicyV3,
  type ZlozGroupPasteRequestV3,
} from './group-clipboard-v3';
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
  applyGroupLayoutV3,
  type ZlozGroupLayoutRequestV3,
  type ZlozGroupLayoutResultV3,
} from './group-layout-v3';
import {
  applyGroupOperationV3,
  planGroupOperationV3,
  type ZlozGroupOperationV3,
} from './group-operations-v3';
import {
  applyPortEditV3,
  planPortEditV3,
  applyGroupPortEditV3,
  type ZlozGroupPortEditV3,
} from './group-port-edit-v3';
import { presentGroups } from './group-presentation';
import { historyValueEqual } from './history';
import { resolvePortAnchorSnap, resolvePortAnchorSnapSettings } from './port-anchor-snap';
import { resizeNodeGeometry } from './resize-geometry';
import { resolveBoxSelection } from './selection-preview';
import type {
  EditorEvent,
  Endpoint,
  Point,
  Size,
  Viewport,
  ZlozGraph,
  EdgeRoute,
  ResizeHandle,
  PortPosition,
  PortAnchorSnapSettings,
  PortAnchorSnapResult,
  PortAnchorSnapOverrides,
  EdgeEnd,
} from './types';

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
  | Readonly<{
      type: 'resize';
      source: ZlozGroupEditorSourceV3;
      id: string;
      handle: ResizeHandle;
      pointer: number;
      origin: Point;
      delta: Point;
    }>
  | Readonly<{
      type: 'anchor';
      source: ZlozGroupEditorSourceV3;
      endpoint: Endpoint;
      pointer: number;
      origin: Point;
      position: PortPosition;
      settings: PortAnchorSnapSettings;
      snap: PortAnchorSnapResult | null;
      bypassed: boolean;
    }>
  | Readonly<{ type: 'box-selection'; pointer: number; origin: Point; point: Point }>
  | Readonly<{ type: 'pinch'; center: Point; distance: number; before: Viewport }>
  | Readonly<{
      type: 'reconnect';
      source: ZlozGroupEditorSourceV3;
      pointer: number;
      edgeId: string;
      end: EdgeEnd;
      target: Endpoint | null;
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
  clipboard: ZlozGroupClipboardV3 | null;
  clipboardFindings: readonly ZlozGroupClipboardFindingV3[];
  selectedNodeIds: readonly string[];
  selectedEdgeId: string | null;
  collapsedGroupIds: readonly string[];
  viewport: Viewport;
  surface: Size;
  gesture: ZlozGroupWorkbenchGestureV3;
  connectionSource: Endpoint | null;
  status: string;
  /** Required protection feedback is independent of optional diagnostic status. */
  statusRequired?: boolean;
  layout: Readonly<{ document: ZlozGroupDocumentV3; routes: readonly EdgeRoute[] }> | null;
}>;
export type ZlozGroupWorkbenchEventV3 =
  | EditorEvent
  | Readonly<{ type: 'GroupOperationRequested'; operation: ZlozGroupOperationV3 }>
  | Readonly<{ type: 'GroupPortEditRequested'; edit: ZlozGroupPortEditV3 }>
  | Readonly<{ type: 'ConnectionEditRequested'; edit: ZlozGroupConnectionEditV3 }>
  | Readonly<{ type: 'GroupCollapseToggled'; id: string }>
  | Readonly<{ type: 'FitViewRequested' }>
  | Readonly<{ type: 'GroupPasteRequested'; request: ZlozGroupPasteRequestV3 }>;
export type ZlozGroupWorkbenchOptionsV3 = Readonly<{
  grid?: number;
  pasteOffset?: Point;
  portAnchorSnap?: PortAnchorSnapOverrides;
}>;
export function createGroupWorkbenchV3(
  document: ZlozGroupDocumentV3,
  options: ZlozGroupEditorOptionsV3,
): ZlozGroupWorkbenchV3 {
  const editor = createGroupEditorV3(document, options);
  return {
    editor,
    clipboard: null,
    clipboardFindings: [],
    selectedNodeIds: [],
    selectedEdgeId: null,
    collapsedGroupIds: [],
    viewport: editor.document.viewport ?? { x: 20, y: 20, zoom: 1 },
    surface: { width: 800, height: 600 },
    gesture: { type: 'idle' },
    connectionSource: null,
    layout: null,
    status: 'Select a node or port. Arrow keys move the selection; Escape cancels.',
  };
}
/** Compose a trusted headless Apply/Undo result into transient presentation. This helper grants no edit authority; run the native planner/kernel first. */
export function publishGroupWorkbenchResultV3(
  model: ZlozGroupWorkbenchV3,
  result: Readonly<{ type: string; editor: ZlozGroupEditorStateV3; reason?: string }>,
): ZlozGroupWorkbenchV3 {
  const nodes = new Set(result.editor.document.graph.nodes.map((node) => node.id));
  return {
    ...model,
    editor: result.editor,
    layout: result.editor === model.editor ? model.layout : null,
    viewport: historyValueEqual(model.editor.document.viewport, result.editor.document.viewport)
      ? model.viewport
      : (result.editor.document.viewport ?? { x: 20, y: 20, zoom: 1 }),
    gesture: { type: 'idle' },
    statusRequired: result.reason != null,
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
  if (model.editor.readOnly) return 'This diagram is read-only.';
  if (model.editor.activity.type === 'busy') return model.editor.activity.reason;
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
/** Session placement convenience: advance the requested offset until copied anchors are unoccupied. Custom headless requests retain exact offsets. */
export function groupWorkbenchPasteRequestV3(
  model: ZlozGroupWorkbenchV3,
  step: Point = { x: 40, y: 40 },
): ZlozGroupPasteRequestV3 | null {
  if (!model.clipboard) return null;
  const occupied = new Set(
    model.editor.document.graph.nodes.map((n) => JSON.stringify([n.position.x, n.position.y])),
  );
  let offset = step;
  if (step.x !== 0 || step.y !== 0) {
    for (let multiple = 1; multiple <= model.editor.document.graph.nodes.length + 1; multiple++) {
      offset = { x: step.x * multiple, y: step.y * multiple };
      if (
        !model.clipboard.document.graph.nodes.some((n) =>
          occupied.has(JSON.stringify([n.position.x + offset.x, n.position.y + offset.y])),
        )
      )
        break;
    }
  }
  return groupPasteRequestV3(model.editor, model.clipboard, { offset });
}
/** Resolve resize geometry separately from native transaction authority. */
function resizeOperation(
  graph: ZlozGraph,
  id: string,
  delta: Point,
  handle: ResizeHandle,
): ZlozGroupOperationV3 {
  const next = resizeNodeGeometry(graph, id, delta, handle, false, 1, [], false).nodes.find(
    (n) => n.id === id,
  );
  if (!next) return { operation: 'resize', id, size: { width: 1, height: 1 } };
  return { operation: 'resize', id, size: next.size, position: next.position };
}
function gesturePlan(model: ZlozGroupWorkbenchV3, policy: ZlozGroupEditorPolicyV3) {
  const g = model.gesture;
  if (g.type === 'anchor')
    return planPortEditV3(
      model.editor,
      {
        source: g.source,
        edit: { operation: 'position', endpoint: g.endpoint, position: g.position },
      },
      policy,
    );
  if (g.type !== 'move' && g.type !== 'resize') return null;
  return planGroupOperationV3(
    model.editor,
    {
      source: g.source,
      operation:
        g.type === 'move'
          ? { operation: 'move', nodeIds: g.nodeIds, delta: g.delta }
          : resizeOperation(g.source.document.graph, g.id, g.delta, g.handle),
    },
    policy,
  );
}
/** Recompute transient geometry through the same live planner used at release. No preview is authority. */
export function groupWorkbenchGraphV3(
  model: ZlozGroupWorkbenchV3,
  policy: ZlozGroupEditorPolicyV3 = {},
): ZlozGraph {
  const plan = gesturePlan(model, policy);
  return plan?.type === 'ready' ? plan.transaction.document.graph : model.editor.document.graph;
}
/** Visible root selection shared by marquee feedback and release-time selection policy. */
export function groupWorkbenchBoxSelectionV3(
  model: ZlozGroupWorkbenchV3,
  policy: ZlozGroupEditorPolicyV3 = {},
) {
  if (model.gesture.type !== 'box-selection') return null;
  return resolveBoxSelection(
    {
      graph: model.editor.document.graph,
      collapsedGroups: model.collapsedGroupIds,
      boxSelectionMatch: 'full',
    },
    model.gesture,
    presentGroups(model.editor.document.graph, model.collapsedGroupIds).nodes,
    policy.canSelectNode,
  );
}
/** Accepted routes are transient and valid only for this complete document and unprojected geometry. */
export function groupWorkbenchRoutesV3(model: ZlozGroupWorkbenchV3): readonly EdgeRoute[] {
  return model.layout &&
    model.gesture.type === 'idle' &&
    model.collapsedGroupIds.length === 0 &&
    historyValueEqual(model.layout.document, model.editor.document)
    ? model.layout.routes
    : [];
}
/** Apply current async geometry to an idle workbench using the same live transaction kernel. */
export function applyGroupWorkbenchLayoutV3(
  model: ZlozGroupWorkbenchV3,
  active: ZlozGroupLayoutRequestV3,
  result: ZlozGroupLayoutResultV3,
  policy: ZlozGroupEditorPolicyV3 = {},
): ZlozGroupWorkbenchV3 {
  if (model.gesture.type !== 'idle')
    return { ...model, status: 'Finish or cancel the active gesture before applying layout.' };
  const applied = applyGroupLayoutV3(model.editor, active, result, policy),
    next = publishGroupWorkbenchResultV3(model, applied);
  return applied.type === 'blocked'
    ? next
    : {
        ...next,
        layout: { document: applied.editor.document, routes: applied.routes ?? [] },
        status:
          applied.type === 'unchanged'
            ? 'Layout geometry is unchanged. No Undo frame added.'
            : 'Layout applied. One Undo restores the complete document.',
      };
}
/** Native/browser facts and custom controls share source-bound live v3 transactions. */
export function updateGroupWorkbenchV3(
  model: ZlozGroupWorkbenchV3,
  event: ZlozGroupWorkbenchEventV3,
  policy: ZlozGroupClipboardPolicyV3 = {},
  options: ZlozGroupWorkbenchOptionsV3 = {},
): ZlozGroupWorkbenchV3 {
  const editor = model.editor,
    graph = editor.document.graph;
  const source = () => captureGroupEditorSourceV3(editor);
  const operate = (operation: ZlozGroupOperationV3) =>
    publishGroupWorkbenchResultV3(
      model,
      applyGroupOperationV3(editor, { source: source(), operation }, policy),
    );
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
      'CopyPressed',
      'PastePressed',
      'GroupPasteRequested',
      'GroupResizeNudged',
      'NodeResizeNudged',
      'PortAnchorNudged',
      'SelectionNudged',
      'PortActivated',
      'GroupCollapseToggled',
    ].includes(event.type)
  )
    return { ...model, status: 'Finish or cancel the active gesture first.' };
  switch (event.type) {
    case 'CopyPressed': {
      const result = copyGroupSelectionV3(editor, model.selectedNodeIds, policy);
      return result.type === 'blocked'
        ? { ...model, status: result.reason }
        : {
            ...model,
            clipboard: result.clipboard,
            clipboardFindings: result.findings,
            status: `Selection copied. ${result.findings.map((f) => f.reason).join(' ')}`.trim(),
          };
    }
    case 'PastePressed':
    case 'GroupPasteRequested': {
      if (event.type === 'PastePressed' && !model.clipboard)
        return { ...model, status: 'Copy a selection before pasting.' };
      const request =
        event.type === 'GroupPasteRequested'
          ? event.request
          : groupWorkbenchPasteRequestV3(
              model,
              options.pasteOffset ?? { x: grid * 2, y: grid * 2 },
            )!;
      const result = applyGroupPasteV3(editor, request, policy),
        next = publishGroupWorkbenchResultV3(model, result);
      if (result.type !== 'applied') return next;
      const graph = result.editor.document.graph;
      return {
        ...next,
        connectionSource: null,
        selectedEdgeId: null,
        selectedNodeIds: result.rootNodeIds.filter((id) => {
          const node = graph.nodes.find((n) => n.id === id);
          return node && policy.canSelectNode?.(node, graph) == null;
        }),
        status: 'Clipboard pasted. One Undo restores the complete document.',
      };
    }
    case 'GroupOperationRequested':
      return operate(event.operation);
    case 'GroupPortEditRequested':
      return publishGroupWorkbenchResultV3(
        model,
        applyGroupPortEditV3(editor, { source: source(), edit: event.edit }, policy),
      );
    case 'ConnectionEditRequested':
      return publishGroupWorkbenchResultV3(
        model,
        applyGroupConnectionV3(editor, { source: source(), edit: event.edit }, policy),
      );
    case 'UndoPressed':
    case 'RedoPressed':
      return publishGroupWorkbenchResultV3(
        model,
        updateGroupEditorV3(editor, { type: event.type, source: source() }, policy),
      );
    case 'GestureCancelled':
      return {
        ...model,
        viewport: model.gesture.type === 'pinch' ? model.gesture.before : model.viewport,
        gesture: { type: 'idle' },
        connectionSource: null,
        status: 'Gesture cancelled. The document is unchanged.',
      };
    case 'NodeSelected': {
      const node = graph.nodes.find((n) => n.id === event.id);
      if (!node) return model;
      const reason = policy.canSelectNode?.(node, graph);
      if (reason != null)
        return {
          ...model,
          statusRequired: true,
          status: reason.trim() || 'Node selection is protected.',
        };
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
        ? {
            ...model,
            statusRequired: true,
            status: reason.trim() || 'Connection selection is protected.',
          }
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
    case 'NodeResizeStarted': {
      if (model.gesture.type !== 'idle' || !graph.nodes.some((n) => n.id === event.id))
        return model;
      return {
        ...model,
        gesture: {
          type: 'resize',
          source: source(),
          id: event.id,
          handle: event.handle ?? event.corner ?? 'bottom-right',
          pointer: event.pointer,
          origin: screenToWorld(event.point, model.viewport),
          delta: { x: 0, y: 0 },
        },
      };
    }
    case 'GroupResizeNudged':
      return operate(
        resizeOperation(
          graph,
          event.id,
          event.delta,
          event.handle ?? event.corner ?? 'bottom-right',
        ),
      );
    case 'NodeResizeNudged':
      return operate(resizeOperation(graph, event.id, { x: event.delta, y: 0 }, 'right'));
    case 'PortAnchorDragStarted': {
      if (model.gesture.type !== 'idle') return model;
      const node = graph.nodes.find((n) => n.id === event.endpoint.node),
        port = node?.ports.find((p) => p.id === event.endpoint.port);
      if (!node || !port) return model;
      const position = { side: port.side, anchor: portAnchor(port, node) };
      const gesture: ZlozGroupWorkbenchGestureV3 = {
        type: 'anchor',
        snap: null,
        source: source(),
        endpoint: event.endpoint,
        pointer: event.pointer,
        origin: screenToWorld(event.point, model.viewport),
        position,
        settings: resolvePortAnchorSnapSettings(
          options.portAnchorSnap ?? {},
          policy.portAnchorSnap?.({ node, port }, graph),
        ),
        bypassed: event.snapBypassed ?? false,
      };
      const next = { ...model, gesture },
        plan = gesturePlan(next, policy);
      return plan?.type === 'blocked'
        ? { ...model, statusRequired: true, status: plan.reason }
        : next;
    }
    case 'PortAnchorNudged': {
      const node = graph.nodes.find((n) => n.id === event.endpoint.node),
        port = node?.ports.find((p) => p.id === event.endpoint.port);
      if (!node || !port || model.gesture.type !== 'idle') return model;
      finitePoint(event.delta);
      const base = portAnchor(port, node),
        anchor = {
          x: Math.max(0, Math.min(1, base.x + event.delta.x)),
          y: Math.max(0, Math.min(1, base.y + event.delta.y)),
        };
      return publishGroupWorkbenchResultV3(
        model,
        applyPortEditV3(
          editor,
          {
            source: source(),
            edit: {
              operation: 'position',
              endpoint: event.endpoint,
              position: { side: port.side, anchor },
            },
          },
          policy,
        ),
      );
    }
    case 'PortAnchorSnapBypassChanged':
      return model.gesture.type === 'anchor' && model.gesture.pointer === event.pointer
        ? { ...model, gesture: { ...model.gesture, bypassed: event.bypassed } }
        : model;
    case 'ReconnectionDragStarted':
      return model.gesture.type !== 'idle' || !graph.edges.some((e) => e.id === event.id)
        ? model
        : {
            ...model,
            gesture: {
              type: 'reconnect',
              source: source(),
              edgeId: event.id,
              end: event.end,
              pointer: event.pointer,
              target: null,
            },
          };
    case 'BoxSelectionStarted':
      return model.gesture.type !== 'idle'
        ? model
        : {
            ...model,
            gesture: {
              type: 'box-selection',
              pointer: event.pointer,
              origin: screenToWorld(event.point, model.viewport),
              point: screenToWorld(event.point, model.viewport),
            },
          };
    case 'PinchStarted':
      finitePoint(event.center);
      return !Number.isFinite(event.distance) || event.distance <= 0
        ? model
        : {
            ...model,
            connectionSource: null,
            gesture: {
              type: 'pinch',
              center: event.center,
              distance: event.distance,
              before: model.viewport,
            },
          };
    case 'PinchMoved': {
      const g = model.gesture;
      if (g.type !== 'pinch' || !Number.isFinite(event.distance) || event.distance <= 0)
        return model;
      finitePoint(event.center);
      const camera = zoomAt(g.before, g.center, event.distance / g.distance);
      return {
        ...model,
        viewport: {
          ...camera,
          x: camera.x + event.center.x - g.center.x,
          y: camera.y + event.center.y - g.center.y,
        },
      };
    }
    case 'PinchEnded':
      return model.gesture.type === 'pinch' ? { ...model, gesture: { type: 'idle' } } : model;
    case 'PointerMoved': {
      const g = model.gesture;
      if (g.type === 'idle' || g.type === 'pinch' || g.pointer !== event.pointer) return model;
      finitePoint(event.point);
      if (g.type === 'pan')
        return {
          ...model,
          viewport: {
            ...g.viewport,
            x: g.viewport.x + event.point.x - g.origin.x,
            y: g.viewport.y + event.point.y - g.origin.y,
          },
        };
      if (g.type === 'connect' || g.type === 'reconnect')
        return { ...model, gesture: { ...g, target: event.target ?? null } };
      const world = screenToWorld(event.point, model.viewport);
      if (g.type === 'box-selection') return { ...model, gesture: { ...g, point: world } };
      if (g.type === 'anchor') {
        const node = g.source.document.graph.nodes.find((n) => n.id === g.endpoint.node),
          port = node?.ports.find((p) => p.id === g.endpoint.port);
        if (!node || !port) return model;
        const base = portAnchor(port, node),
          bypassed = event.portAnchorSnapBypassed ?? g.bypassed;
        const snapped = resolvePortAnchorSnap(
          {
            x: base.x + (world.x - g.origin.x) / node.size.width,
            y: base.y + (world.y - g.origin.y) / node.size.height,
          },
          {
            ...g.settings,
            size: node.size,
            zoom: model.viewport.zoom,
            preferredSide: port.side,
            previousSide: g.snap?.side ?? null,
            previousCorner: g.snap?.corner ?? null,
            previousMidpoint: g.snap?.midpoint ?? null,
            distance: bypassed ? 0 : g.settings.distance,
            cornerDistance: bypassed ? 0 : g.settings.cornerDistance,
            midpointDistance: bypassed ? 0 : g.settings.midpointDistance,
          },
        );
        const next = {
            ...model,
            gesture: {
              ...g,
              bypassed,
              snap: snapped,
              position: { side: port.side, anchor: snapped.anchor },
            },
          },
          plan = gesturePlan(next, policy);
        return {
          ...next,
          statusRequired: plan?.type === 'blocked',
          status:
            plan?.type === 'blocked' ? plan.reason : 'Preview. Release to apply; Escape cancels.',
        };
      }
      const delta = {
        x: Math.round((world.x - g.origin.x) / grid) * grid,
        y: Math.round((world.y - g.origin.y) / grid) * grid,
      };
      const next = { ...model, gesture: { ...g, delta } },
        plan = gesturePlan(next, policy);
      return {
        ...next,
        statusRequired: plan?.type === 'blocked',
        status:
          plan?.type === 'blocked' ? plan.reason : 'Preview. Release to apply; Escape cancels.',
      };
    }
    case 'PointerReleased': {
      const g = model.gesture;
      if (g.type === 'idle' || g.type === 'pinch' || g.pointer !== event.pointer) return model;
      if (g.type === 'pan') return { ...model, gesture: { type: 'idle' } };
      if (g.type === 'box-selection')
        return {
          ...model,
          selectedNodeIds: groupWorkbenchBoxSelectionV3(model, policy)?.previewNodeIds ?? [],
          selectedEdgeId: null,
          gesture: { type: 'idle' },
        };
      if (g.type === 'anchor')
        return publishGroupWorkbenchResultV3(
          model,
          applyPortEditV3(
            editor,
            {
              source: g.source,
              edit: { operation: 'position', endpoint: g.endpoint, position: g.position },
            },
            policy,
          ),
        );
      if (g.type === 'move' || g.type === 'resize')
        return publishGroupWorkbenchResultV3(
          model,
          applyGroupOperationV3(
            editor,
            {
              source: g.source,
              operation:
                g.type === 'move'
                  ? { operation: 'move', nodeIds: g.nodeIds, delta: g.delta }
                  : resizeOperation(g.source.document.graph, g.id, g.delta, g.handle),
            },
            policy,
          ),
        );
      if (!g.target)
        return {
          ...model,
          gesture: { type: 'idle' },
          status: 'No connection target. The document is unchanged.',
        };
      return publishGroupWorkbenchResultV3(
        model,
        applyGroupConnectionV3(
          editor,
          {
            source: g.source,
            edit:
              g.type === 'reconnect'
                ? { operation: 'reconnect', edgeId: g.edgeId, end: g.end, endpoint: g.target }
                : {
                    operation: 'create',
                    edges: [{ id: edgeId(model), source: g.endpoint, target: g.target }],
                  },
          },
          policy,
        ),
      );
    }
    case 'ConnectionDragStarted': {
      const reason = sourceReason(model, event.endpoint, policy);
      if (reason !== null) return { ...model, statusRequired: true, status: reason };
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
        if (reason !== null) return { ...model, statusRequired: true, status: reason };
        return {
          ...model,
          connectionSource: event.endpoint,
          status: 'Source chosen. Activate a target port or press Escape.',
        };
      }
      return {
        ...publishGroupWorkbenchResultV3(
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
      if (model.gesture.type !== 'idle') return model;
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
