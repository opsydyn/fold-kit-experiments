import {
  boxBounds,
  finitePoint,
  fitViewport,
  minimapGeometry,
  screenToWorld,
  validViewport,
  zoomAt,
} from './geometry';
import { copyGraph, FlowError, validateGraph } from './graph';
import type {
  EditorEvent,
  EditorOptions,
  EditorPolicy,
  EditorState,
  FlowGraph,
  FlowNode,
  FlowEdge,
  Endpoint,
  Point,
} from './types';

export function createEditor(graph: FlowGraph, options: EditorOptions = {}): EditorState {
  const viewport = options.viewport ?? { x: 0, y: 0, zoom: 1 };
  validViewport(viewport);
  const historyLimit = options.historyLimit ?? 100;
  if (!Number.isInteger(historyLimit) || historyLimit < 0 || historyLimit > 1000)
    throw new FlowError('invalid-edit', 'History limit must be an integer from 0 to 1000');
  return {
    graph: copyGraph(graph),
    revision: 0,
    surface: null,
    viewport: { ...viewport },
    selectedNodes: [],
    selectedEdges: [],
    connection: null,
    gesture: { type: 'idle' },
    past: [],
    future: [],
    historyLimit,
    readOnly: options.readOnly ?? false,
    routes: [],
    notice: null,
  };
}
function history(state: EditorState, before: FlowGraph): readonly FlowGraph[] {
  return state.historyLimit === 0 ? [] : [...state.past, before].slice(-state.historyLimit);
}
/** Shared transaction boundary; document publications invalidate cached routes. */
export function commitGraph(state: EditorState, graph: FlowGraph): EditorState {
  validateGraph(graph);
  return {
    ...state,
    graph,
    revision: state.revision + 1,
    past: history(state, state.graph),
    future: [],
    routes: [],
    gesture: { type: 'idle' },
    connection: null,
    notice: null,
    selectedNodes: state.selectedNodes.filter((id) => graph.nodes.some((node) => node.id === id)),
    selectedEdges: state.selectedEdges.filter((id) => graph.edges.some((edge) => edge.id === id)),
  };
}
function withDescendants(graph: FlowGraph, ids: readonly string[]): ReadonlySet<string> {
  const children = new Map<string, string[]>();
  for (const node of graph.nodes) {
    if (node.parentId === undefined) continue;
    const siblings = children.get(node.parentId) ?? [];
    siblings.push(node.id);
    children.set(node.parentId, siblings);
  }
  const included = new Set(ids);
  for (const id of included) {
    for (const child of children.get(id) ?? []) included.add(child);
  }
  return included;
}

function move(graph: FlowGraph, ids: readonly string[], delta: Point): FlowGraph {
  finitePoint(delta);
  const moving = withDescendants(graph, ids);
  const moved = {
    ...graph,
    nodes: graph.nodes.map((node) =>
      moving.has(node.id)
        ? { ...node, position: { x: node.position.x + delta.x, y: node.position.y + delta.y } }
        : node,
    ),
  };
  validateGraph(moved);
  return moved;
}
function selection(ids: readonly string[], id: string, additive: boolean): readonly string[] {
  if (!additive) return [id];
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}
function cancel(state: EditorState): EditorState {
  if (state.gesture.type === 'node-drag' || state.gesture.type === 'node-resize')
    return {
      ...state,
      graph: state.gesture.before,
      revision: state.revision + 1,
      gesture: { type: 'idle' },
      routes: [],
      connection: null,
    };
  if (state.gesture.type === 'pan')
    return {
      ...state,
      viewport: state.gesture.before,
      gesture: { type: 'idle' },
      connection: null,
    };
  return {
    ...state,
    gesture: { type: 'idle' },
    connection: null,
    notice: state.connection ? 'Connection cancelled' : null,
  };
}
function portKind(graph: FlowGraph, endpoint: Endpoint) {
  return graph.nodes
    .find((node) => node.id === endpoint.node)
    ?.ports.find((port) => port.id === endpoint.port)?.kind;
}

function proposedEdge(graph: FlowGraph, source: Endpoint, target: Endpoint) {
  let index = 1;
  while (graph.edges.some((edge) => edge.id === `edge:${index}`)) index++;
  return { id: `edge:${index}`, source, target };
}

function reconnectionReason(
  graph: FlowGraph,
  edge: FlowEdge,
  end: 'source' | 'target',
  policy: EditorPolicy,
) {
  if (portKind(graph, edge[end]) !== (end === 'source' ? 'output' : 'input'))
    return 'Choose a compatible port.';
  const remaining = graph.edges.filter((item) => item.id !== edge.id);
  if (
    remaining.some(
      (item) =>
        item.source.node === edge.source.node &&
        item.source.port === edge.source.port &&
        item.target.node === edge.target.node &&
        item.target.port === edge.target.port,
    )
  )
    return 'These ports are already connected';
  return policy.canConnect?.(edge, { ...graph, edges: remaining }) ?? null;
}

function sameGeometry(a: FlowGraph, b: FlowGraph): boolean {
  return a.nodes.every(
    (node, index) =>
      node.position.x === b.nodes[index]?.position.x &&
      node.position.y === b.nodes[index]?.position.y &&
      node.size.width === b.nodes[index]?.size.width,
  );
}
/** Pure reducer. Consumers retain the returned state in their own Model. */
export function updateEditor(
  state: EditorState,
  event: EditorEvent,
  policy: EditorPolicy = {},
): EditorState {
  switch (event.type) {
    case 'NodeSelected':
      if (!state.graph.nodes.some((node) => node.id === event.id)) return state;
      return {
        ...state,
        selectedNodes: selection(state.selectedNodes, event.id, event.additive),
        selectedEdges: event.additive ? state.selectedEdges : [],
      };
    case 'EdgeSelected':
      if (!state.graph.edges.some((edge) => edge.id === event.id)) return state;
      return {
        ...state,
        selectedEdges: selection(state.selectedEdges, event.id, event.additive),
        selectedNodes: event.additive ? state.selectedNodes : [],
      };
    case 'SelectionCleared':
      return { ...state, selectedNodes: [], selectedEdges: [] };
    case 'GestureCancelled':
      return cancel(state);
    case 'ViewportChanged':
      if (state.gesture.type !== 'idle') return state;
      validViewport(event.viewport);
      return { ...state, viewport: { ...event.viewport } };
    case 'FitViewClicked': {
      const { surface } = state;
      if (!surface || state.gesture.type !== 'idle' || state.graph.nodes.length === 0) return state;
      const padding = Math.min(24, surface.width / 4, surface.height / 4);
      return { ...state, viewport: fitViewport(state.graph, surface, padding) };
    }
    case 'MinimapClicked': {
      const { surface, viewport } = state;
      if (!surface || state.gesture.type !== 'idle') return state;
      finitePoint(event.point);
      const { x, y, width, height } = minimapGeometry(state.graph, surface, viewport);
      const worldX = x + Math.max(0, Math.min(1, event.point.x)) * width;
      const worldY = y + Math.max(0, Math.min(1, event.point.y)) * height;
      return {
        ...state,
        viewport: {
          x: surface.width / 2 - worldX * viewport.zoom,
          y: surface.height / 2 - worldY * viewport.zoom,
          zoom: viewport.zoom,
        },
      };
    }
    case 'Zoomed':
      if (state.gesture.type !== 'idle') return state;
      return { ...state, viewport: zoomAt(state.viewport, event.point, event.factor) };
    case 'BoxSelectionStarted': {
      if (state.gesture.type !== 'idle') return state;
      const origin = screenToWorld(event.point, state.viewport);
      return {
        ...state,
        connection: null,
        notice: null,
        gesture: { type: 'box-selection', pointer: event.pointer, origin, point: origin },
      };
    }
    case 'PanStarted':
      if (state.gesture.type !== 'idle') return state;
      finitePoint(event.point);
      return {
        ...state,
        gesture: {
          type: 'pan',
          pointer: event.pointer,
          origin: event.point,
          before: state.viewport,
        },
      };
    case 'PointerMoved': {
      const gesture = state.gesture;
      if (gesture.type === 'idle' || gesture.pointer !== event.pointer) return state;
      finitePoint(event.point);
      if (gesture.type === 'box-selection')
        return {
          ...state,
          gesture: { ...gesture, point: screenToWorld(event.point, state.viewport) },
        };
      if (gesture.type === 'connection-drag') {
        if (gesture.reconnect) {
          const { id, end } = gesture.reconnect;
          const existing = state.graph.edges.find((edge) => edge.id === id);
          const target =
            event.target &&
            existing &&
            reconnectionReason(state.graph, { ...existing, [end]: event.target }, end, policy) ===
              null
              ? event.target
              : null;
          return { ...state, gesture: { ...gesture, point: event.point, target } };
        }
        const source = state.connection;
        const target = event.target;
        const edge =
          source && target && portKind(state.graph, target) === 'input'
            ? proposedEdge(state.graph, source, target)
            : null;
        const duplicate =
          edge &&
          state.graph.edges.some(
            (existing) =>
              existing.source.node === edge.source.node &&
              existing.source.port === edge.source.port &&
              existing.target.node === edge.target.node &&
              existing.target.port === edge.target.port,
          );
        const allowed =
          edge && !duplicate && (policy.canConnect?.(edge, state.graph) ?? null) === null;
        return {
          ...state,
          gesture: { ...gesture, point: event.point, target: allowed ? edge.target : null },
        };
      }
      const delta = { x: event.point.x - gesture.origin.x, y: event.point.y - gesture.origin.y };
      if (gesture.type === 'pan')
        return {
          ...state,
          viewport: {
            ...gesture.before,
            x: gesture.before.x + delta.x,
            y: gesture.before.y + delta.y,
          },
        };
      if (gesture.type === 'node-resize') {
        const original = gesture.before.nodes.find((node) => node.id === gesture.ids[0]);
        if (!original) return state;
        const initial = original.size.width;
        const width = Math.max(
          Math.min(140, initial),
          Math.min(Math.max(320, initial), initial + delta.x / state.viewport.zoom),
        );
        if (state.graph.nodes.find((node) => node.id === original.id)?.size.width === width)
          return state;
        const graph = {
          ...state.graph,
          nodes: state.graph.nodes.map((node) =>
            node.id === original.id ? { ...node, size: { ...node.size, width } } : node,
          ),
        };
        return { ...state, graph, revision: state.revision + 1, routes: [] };
      }
      const graph = move(gesture.before, gesture.ids, {
        x: delta.x / state.viewport.zoom,
        y: delta.y / state.viewport.zoom,
      });
      if (sameGeometry(state.graph, graph)) return state;
      return { ...state, graph, revision: state.revision + 1, routes: [] };
    }
    case 'PointerReleased': {
      const gesture = state.gesture;
      if (gesture.type === 'idle' || gesture.pointer !== event.pointer) return state;
      if (gesture.type === 'box-selection') {
        const bounds = boxBounds(gesture.origin, gesture.point);
        const enclosed = state.graph.nodes.filter(
          (node) =>
            node.position.x >= bounds.left &&
            node.position.y >= bounds.top &&
            node.position.x + node.size.width <= bounds.right &&
            node.position.y + node.size.height <= bounds.bottom,
        );
        const enclosedIds = new Set(enclosed.map((node) => node.id));
        const byId = new Map(state.graph.nodes.map((node) => [node.id, node]));
        const selectedNodes = enclosed
          .filter((node) => {
            let parent = node.parentId;
            while (parent !== undefined) {
              if (enclosedIds.has(parent)) return false;
              parent = byId.get(parent)?.parentId;
            }
            return true;
          })
          .map((node) => node.id);
        return {
          ...state,
          gesture: { type: 'idle' },
          selectedNodes,
          selectedEdges: [],
          notice: `${selectedNodes.length} selected`,
        };
      }
      if (gesture.type === 'connection-drag') {
        if (!gesture.target) return cancel(state);
        return updateEditor(
          {
            ...state,
            gesture: { type: 'idle' },
            connection: gesture.reconnect ? null : state.connection,
            notice: null,
          },
          gesture.reconnect
            ? { type: 'EdgeReconnected', ...gesture.reconnect, endpoint: gesture.target }
            : { type: 'PortActivated', endpoint: gesture.target },
          policy,
        );
      }
      if (gesture.type === 'pan' || sameGeometry(state.graph, gesture.before))
        return { ...state, gesture: { type: 'idle' } };
      return {
        ...state,
        gesture: { type: 'idle' },
        past: history(state, gesture.before),
        future: [],
        notice: gesture.type === 'node-resize' ? 'Node resized' : 'Nodes moved',
      };
    }
    case 'SurfaceMeasured':
      if (
        !Number.isFinite(event.size.width) ||
        !Number.isFinite(event.size.height) ||
        event.size.width <= 0 ||
        event.size.height <= 0
      )
        return state;
      return { ...state, surface: event.size };
    case 'NodeMeasured': {
      if (
        !Number.isFinite(event.size.width) ||
        !Number.isFinite(event.size.height) ||
        event.size.width <= 0 ||
        event.size.height <= 0
      )
        throw new FlowError('invalid-edit', 'Measured size must be positive and finite');
      const node = state.graph.nodes.find((item) => item.id === event.id);
      if (!node || node.kind === 'group' || node.size.height === event.size.height) return state;
      const measure = (graph: FlowGraph): FlowGraph => ({
        ...graph,
        nodes: graph.nodes.map((item) =>
          item.id === event.id
            ? { ...item, size: { ...item.size, height: event.size.height } }
            : item,
        ),
      });
      const gesture =
        state.gesture.type === 'node-drag' || state.gesture.type === 'node-resize'
          ? { ...state.gesture, before: measure(state.gesture.before) }
          : state.gesture;
      return {
        ...state,
        graph: measure(state.graph),
        past: state.past.map(measure),
        future: state.future.map(measure),
        gesture,
        revision: state.revision + 1,
        routes: [],
      };
    }
  }
  if (state.readOnly || state.gesture.type !== 'idle') return state;
  switch (event.type) {
    case 'ReconnectionDragStarted': {
      const edge = state.graph.edges.find((item) => item.id === event.id);
      if (!edge) return state;
      finitePoint(event.point);
      return {
        ...state,
        connection: edge[event.end === 'source' ? 'target' : 'source'],
        gesture: {
          type: 'connection-drag',
          pointer: event.pointer,
          point: event.point,
          target: null,
          reconnect: { id: event.id, end: event.end },
        },
        notice: 'Drag to a compatible port. Escape cancels.',
      };
    }
    case 'ConnectionDragStarted':
      if (portKind(state.graph, event.endpoint) !== 'output') return state;
      finitePoint(event.point);
      return {
        ...state,
        connection: event.endpoint,
        gesture: {
          type: 'connection-drag',
          pointer: event.pointer,
          point: event.point,
          target: null,
        },
        notice: 'Drag to an input port. Escape cancels.',
      };
    case 'NodeResizeStarted':
    case 'NodeDragStarted': {
      if (!state.graph.nodes.some((node) => node.id === event.id)) return state;
      finitePoint(event.point);
      const resizing = event.type === 'NodeResizeStarted';
      const ids =
        !resizing && state.selectedNodes.includes(event.id) ? state.selectedNodes : [event.id];
      return {
        ...state,
        selectedNodes: ids,
        selectedEdges: [],
        connection: null,
        gesture: {
          type: resizing ? 'node-resize' : 'node-drag',
          pointer: event.pointer,
          origin: event.point,
          before: state.graph,
          ids,
        },
      };
    }
    case 'SelectionNudged':
      if (state.selectedNodes.length === 0 || (event.delta.x === 0 && event.delta.y === 0))
        return state;
      return commitGraph(state, move(state.graph, state.selectedNodes, event.delta));
    case 'NodeAdded':
      return commitGraph(state, {
        ...state.graph,
        nodes: [...state.graph.nodes, ...copyGraph({ nodes: [event.node], edges: [] }).nodes],
      });
    case 'NodeLabelChanged':
      if (!state.graph.nodes.some((node) => node.id === event.id && node.label !== event.label))
        return state;
      return commitGraph(state, {
        ...state.graph,
        nodes: state.graph.nodes.map((node) =>
          node.id === event.id ? { ...node, label: event.label } : node,
        ),
      });
    case 'NodeWidthChanged':
      if (!Number.isFinite(event.width) || event.width <= 0) return state;
      if (
        !state.graph.nodes.some((node) => node.id === event.id && node.size.width !== event.width)
      )
        return state;
      return commitGraph(state, {
        ...state.graph,
        nodes: state.graph.nodes.map((node) =>
          node.id === event.id ? { ...node, size: { ...node.size, width: event.width } } : node,
        ),
      });
    case 'EdgeDataChanged':
      if (!state.graph.edges.some((edge) => edge.id === event.id)) return state;
      return {
        ...commitGraph(
          state,
          copyGraph({
            ...state.graph,
            edges: state.graph.edges.map((edge) =>
              edge.id === event.id ? { ...edge, data: event.data } : edge,
            ),
          }),
        ),
        routes: state.routes,
      };
    case 'EdgeReconnected': {
      const existing = state.graph.edges.find((edge) => edge.id === event.id);
      if (!existing) return state;
      const previous = existing[event.end];
      if (previous.node === event.endpoint.node && previous.port === event.endpoint.port)
        return state;
      const edge = { ...existing, [event.end]: { ...event.endpoint } };
      const reason = reconnectionReason(state.graph, edge, event.end, policy);
      if (reason !== null) return { ...state, notice: reason };
      return {
        ...commitGraph(state, {
          ...state.graph,
          edges: state.graph.edges.map((item) => (item.id === edge.id ? edge : item)),
        }),
        notice: 'Connection updated',
      };
    }
    case 'ConnectionCreated': {
      const graph = { ...state.graph, edges: [...state.graph.edges, event.edge] };
      validateGraph(graph);
      const reason = policy.canConnect?.(event.edge, state.graph) ?? null;
      if (reason !== null) return { ...state, notice: reason, connection: null };
      if (
        state.graph.edges.some(
          (edge) =>
            edge.source.node === event.edge.source.node &&
            edge.source.port === event.edge.source.port &&
            edge.target.node === event.edge.target.node &&
            edge.target.port === event.edge.target.port,
        )
      )
        return { ...state, notice: 'These ports are already connected', connection: null };
      return { ...commitGraph(state, copyGraph(graph)), notice: 'Connection created' };
    }
    case 'PortActivated': {
      const port = state.graph.nodes
        .find((node) => node.id === event.endpoint.node)
        ?.ports.find((item) => item.id === event.endpoint.port);
      if (!port) return state;
      if (port.kind === 'output')
        return {
          ...state,
          connection: { ...event.endpoint },
          notice: 'Choose an input port to connect. Escape cancels.',
        };
      if (!state.connection) return { ...state, notice: 'Choose an output port first' };
      return updateEditor(
        state,
        {
          type: 'ConnectionCreated',
          edge: proposedEdge(state.graph, state.connection, event.endpoint),
        },
        policy,
      );
    }
    case 'SelectionGrouped': {
      const selected = state.graph.nodes.filter((node) => state.selectedNodes.includes(node.id));
      const first = selected[0];
      if (
        !first ||
        selected.length < 2 ||
        selected.some((node) => node.parentId !== first.parentId)
      )
        return { ...state, notice: 'Select at least two nodes in the same group.' };
      const included = withDescendants(state.graph, state.selectedNodes);
      const contents = state.graph.nodes.filter((node) => included.has(node.id));
      const left = Math.min(...contents.map((node) => node.position.x)) - 24;
      const top = Math.min(...contents.map((node) => node.position.y)) - 48;
      const right = Math.max(...contents.map((node) => node.position.x + node.size.width)) + 24;
      const bottom = Math.max(...contents.map((node) => node.position.y + node.size.height)) + 24;
      let index = 1;
      while (state.graph.nodes.some((node) => node.id === `group:${index}`)) index++;
      const boundary: FlowNode = {
        id: `group:${index}`,
        label: `Group ${index}`,
        kind: 'group',
        position: { x: left, y: top },
        size: { width: right - left, height: bottom - top },
        ports: [],
      };
      const group =
        first.parentId === undefined ? boundary : { ...boundary, parentId: first.parentId };
      const graph = {
        ...state.graph,
        nodes: [
          ...state.graph.nodes.map((node) =>
            state.selectedNodes.includes(node.id) ? { ...node, parentId: group.id } : node,
          ),
          group,
        ],
      };
      return {
        ...commitGraph(state, graph),
        selectedNodes: [group.id],
        selectedEdges: [],
        notice: 'Selection grouped',
      };
    }
    case 'SelectionUngrouped': {
      const removed = new Map(
        state.graph.nodes
          .filter((node) => node.kind === 'group' && state.selectedNodes.includes(node.id))
          .map((node) => [node.id, node]),
      );
      if (removed.size === 0) return { ...state, notice: 'Select a group to ungroup.' };
      const nodes = state.graph.nodes
        .filter((node) => !removed.has(node.id))
        .map((node) => {
          if (node.parentId === undefined || !removed.has(node.parentId)) return node;
          let parent = removed.get(node.parentId)?.parentId;
          while (parent !== undefined && removed.has(parent))
            parent = removed.get(parent)?.parentId;
          const { parentId: _, ...root } = node;
          return parent === undefined ? root : { ...root, parentId: parent };
        });
      return { ...commitGraph(state, { ...state.graph, nodes }), notice: 'Selection ungrouped' };
    }
    case 'DeletePressed': {
      if (state.selectedNodes.length === 0 && state.selectedEdges.length === 0) return state;
      const removed = withDescendants(state.graph, state.selectedNodes);
      return commitGraph(state, {
        nodes: state.graph.nodes.filter((node) => !removed.has(node.id)),
        edges: state.graph.edges.filter(
          (edge) =>
            !state.selectedEdges.includes(edge.id) &&
            !removed.has(edge.source.node) &&
            !removed.has(edge.target.node),
        ),
      });
    }
    case 'UndoPressed': {
      const graph = state.past.at(-1);
      if (!graph) return state;
      return {
        ...state,
        graph,
        revision: state.revision + 1,
        past: state.past.slice(0, -1),
        future: [state.graph, ...state.future],
        routes: [],
        connection: null,
        selectedNodes: [],
        selectedEdges: [],
        notice: 'Undone',
      };
    }
    case 'RedoPressed': {
      const graph = state.future[0];
      if (!graph) return state;
      return {
        ...state,
        graph,
        revision: state.revision + 1,
        past: history(state, state.graph),
        future: state.future.slice(1),
        routes: [],
        connection: null,
        selectedNodes: [],
        selectedEdges: [],
        notice: 'Redone',
      };
    }
  }
}
