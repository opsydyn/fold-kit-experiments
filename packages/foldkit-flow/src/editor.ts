import {
  alignDrag,
  alignResize,
  resizeGuides,
  sameGuides,
  type ResizeAlignment,
} from './alignment';
import { resolveDeletion } from './deletion';
import {
  clampZoom,
  defaultFitViewPadding,
  defaultZoomLimits,
  finitePoint,
  fitNodes,
  fittedGroupBounds,
  gridSpacing as defaultGridSpacing,
  minimapGeometry,
  screenToWorld,
  validateZoomLimits,
  validViewport,
  zoomAt,
} from './geometry';
import { copyGraph, FlowError, validateGraph, withPortPosition } from './graph';
import {
  edgeIsVisible,
  groupAtDropPoint,
  presentGroups,
  withDescendants,
} from './group-presentation';
import { movementReason } from './movement';
import { expandParents } from './parent-expansion';
import { resolveBoxSelection } from './selection-preview';
import type {
  EditorEvent,
  EditorOptions,
  EditorPolicy,
  EditorState,
  ConnectionTarget,
  FlowGraph,
  FlowNode,
  FlowEdge,
  Endpoint,
  Point,
  ResizeHandle,
  Viewport,
} from './types';

function validateFitViewPadding(padding: number): void {
  if (!Number.isFinite(padding) || padding < 0)
    throw new FlowError('invalid-edit', 'Fit view padding must be finite and non-negative');
}

/** Validate and detach an authored graph, then initialize host-owned editor state. Throws FlowError for invalid input. */
export function createEditor(graph: FlowGraph, options: EditorOptions = {}): EditorState {
  const zoomLimits = options.zoomLimits ?? defaultZoomLimits;
  validateZoomLimits(zoomLimits);
  const fitViewPadding = options.fitViewPadding ?? defaultFitViewPadding;
  validateFitViewPadding(fitViewPadding);
  const viewport = options.viewport ?? { x: 0, y: 0, zoom: clampZoom(1, zoomLimits) };
  validViewport(viewport, zoomLimits);
  const gridSpacing = options.gridSpacing ?? defaultGridSpacing;
  if (!Number.isFinite(gridSpacing) || gridSpacing <= 0)
    throw new FlowError('invalid-edit', 'Grid spacing must be finite and positive');
  const fitViewDuration = options.fitViewDuration ?? 0;
  if (!Number.isFinite(fitViewDuration) || fitViewDuration < 0)
    throw new FlowError('invalid-edit', 'Fit view duration must be finite and non-negative');
  const historyLimit = options.historyLimit ?? 100;
  if (!Number.isInteger(historyLimit) || historyLimit < 0 || historyLimit > 1000)
    throw new FlowError('invalid-edit', 'History limit must be an integer from 0 to 1000');
  return {
    graph: copyGraph(graph),
    context: null,
    connectionsExpanded: false,
    clipboard: null,
    collapsedGroups: [],
    edgeLabelDraft: null,
    revision: 0,
    surface: null,
    viewport: { ...viewport },
    zoomLimits: { ...zoomLimits },
    fitViewPadding,
    fitViewDuration,
    fitViewTransition: { type: 'idle', id: 0 },
    selectedNodes: [],
    selectedEdges: [],
    connection: null,
    gesture: { type: 'idle' },
    past: [],
    future: [],
    historyLimit,
    readOnly: options.readOnly ?? false,
    snapToGrid: options.snapToGrid ?? false,
    gridSpacing,
    snapToAlignment: options.snapToAlignment ?? false,
    selectionMode: options.selectionMode ?? false,
    boxSelectionMatch: options.boxSelectionMatch ?? 'full',
    routes: [],
    notice: null,
  };
}
/** Anchor the opposite boundary; locked side handles preserve the perpendicular center. */
function resizeGroup(
  graph: FlowGraph,
  id: string,
  delta: Point,
  handle: ResizeHandle = 'bottom-right',
  snapToGrid = false,
  spacing = defaultGridSpacing,
  alignment: readonly ResizeAlignment[] = [],
): FlowGraph {
  const group = graph.nodes.find((node) => node.id === id && node.kind === 'group');
  if (!group || (delta.x === 0 && delta.y === 0)) return graph;
  const left = handle.endsWith('left');
  const top = handle.startsWith('top');
  const horizontal = handle === 'left' || handle === 'right';
  const vertical = handle === 'top' || handle === 'bottom';
  const centerX = vertical && group.keepAspectRatio;
  const centerY = horizontal && group.keepAspectRatio;
  const middle = {
    x: group.position.x + group.size.width / 2,
    y: group.position.y + group.size.height / 2,
  };
  const right = group.position.x + group.size.width;
  const bottom = group.position.y + group.size.height;
  const snapped = (edge: number, offset: number) =>
    snapToGrid && offset !== 0 ? Math.round((edge + offset) / spacing) * spacing - edge : offset;
  const x = vertical
    ? 0
    : (alignment.find((match) => match.axis === 'x')?.offset ??
      snapped(left ? group.position.x : right, delta.x));
  const y = horizontal
    ? 0
    : (alignment.find((match) => match.axis === 'y')?.offset ??
      snapped(top ? group.position.y : bottom, delta.y));
  const growth = { x: left ? -x : x, y: top ? -y : y };
  if (growth.x === 0 && growth.y === 0) return graph;
  const included = withDescendants(graph, [id]);
  const contents = graph.nodes.filter((node) => node.id !== id && included.has(node.id));
  const limits = group.resizeLimits;
  let maximumWidth = limits?.maxWidth ?? Infinity;
  let maximumHeight = limits?.maxHeight ?? Infinity;
  const minimumWidth = Math.max(
    limits?.minWidth ?? Math.min(224, group.size.width, maximumWidth),
    Math.min(
      group.size.width,
      Math.max(
        1,
        ...contents.map((node) =>
          centerX
            ? Math.max(
                2 * (middle.x - node.position.x + 24),
                2 * (node.position.x + node.size.width + 24 - middle.x),
              )
            : left
              ? right - node.position.x + 24
              : node.position.x + node.size.width + 24 - group.position.x,
        ),
      ),
    ),
  );
  const minimumHeight = Math.max(
    limits?.minHeight ?? Math.min(96, group.size.height, maximumHeight),
    Math.min(
      group.size.height,
      Math.max(
        1,
        ...contents.map((node) =>
          centerY
            ? Math.max(
                2 * (middle.y - node.position.y + 48),
                2 * (node.position.y + node.size.height + 24 - middle.y),
              )
            : top
              ? bottom - node.position.y + 48
              : node.position.y + node.size.height + 24 - group.position.y,
        ),
      ),
    ),
  );
  const parent = graph.nodes.find((node) => node.id === group.parentId);
  if (parent && group.extent === 'parent' && !group.expandParent) {
    maximumWidth = Math.min(
      maximumWidth,
      centerX
        ? Math.min(
            2 * (middle.x - parent.position.x),
            2 * (parent.position.x + parent.size.width - middle.x),
          )
        : left
          ? right - parent.position.x
          : parent.position.x + parent.size.width - group.position.x,
    );
    maximumHeight = Math.min(
      maximumHeight,
      centerY
        ? Math.min(
            2 * (middle.y - parent.position.y),
            2 * (parent.position.y + parent.size.height - middle.y),
          )
        : top
          ? bottom - parent.position.y
          : parent.position.y + parent.size.height - group.position.y,
    );
  }
  let width: number;
  let height: number;
  if (group.keepAspectRatio) {
    const minimumScale = Math.max(
      minimumWidth / group.size.width,
      minimumHeight / group.size.height,
    );
    const maximumScale = Math.min(
      maximumWidth / group.size.width,
      maximumHeight / group.size.height,
    );
    if (minimumScale > maximumScale) return graph;
    const x = growth.x / group.size.width;
    const y = growth.y / group.size.height;
    const driver = alignment[0]?.axis;
    const requested =
      1 + (driver === 'x' ? x : driver === 'y' ? y : Math.abs(x) >= Math.abs(y) ? x : y);
    const scale = Math.max(minimumScale, Math.min(maximumScale, requested));
    // Repeated edits at a floating-point boundary must not create history entries.
    if (Math.abs(scale - 1) <= Number.EPSILON * 4) return graph;
    width = group.size.width * scale;
    height = group.size.height * scale;
  } else {
    if (
      (growth.x !== 0 && minimumWidth > maximumWidth) ||
      (growth.y !== 0 && minimumHeight > maximumHeight)
    )
      return graph;
    width =
      growth.x === 0
        ? group.size.width
        : Math.max(minimumWidth, Math.min(maximumWidth, group.size.width + growth.x));
    height =
      growth.y === 0
        ? group.size.height
        : Math.max(minimumHeight, Math.min(maximumHeight, group.size.height + growth.y));
  }
  if (width === group.size.width && height === group.size.height) return graph;
  return expandParents(
    {
      ...graph,
      nodes: graph.nodes.map((node) =>
        node.id === id
          ? {
              ...node,
              position: {
                x: centerX ? middle.x - width / 2 : left ? right - width : group.position.x,
                y: centerY ? middle.y - height / 2 : top ? bottom - height : group.position.y,
              },
              size: { width, height },
            }
          : node,
      ),
    },
    id,
  );
}

/** Explicit resize edits preserve node order, including when they expand ancestors. */
function resizeChangeReason(
  before: FlowGraph,
  after: FlowGraph,
  canResizeNode: EditorPolicy['canResizeNode'],
): string | null {
  if (!canResizeNode || before === after) return null;
  for (const [index, node] of before.nodes.entries()) {
    const next = after.nodes[index];
    if (!next || (next.size.width === node.size.width && next.size.height === node.size.height))
      continue;
    const reason = canResizeNode(node, before);
    if (reason !== null) return reason;
  }
  return null;
}

function history(state: EditorState, before: FlowGraph): readonly FlowGraph[] {
  return state.historyLimit === 0 ? [] : [...state.past, before].slice(-state.historyLimit);
}
function retainedCollapsedGroups(state: EditorState, graph: FlowGraph) {
  return state.collapsedGroups.filter((id) =>
    graph.nodes.some((node) => node.id === id && node.kind === 'group'),
  );
}

/** Shared transaction boundary; document publications invalidate cached routes. */
export function commitGraph(state: EditorState, graph: FlowGraph): EditorState {
  validateGraph(graph);
  return {
    ...cancelFit(state),
    graph,
    context: null,
    revision: state.revision + 1,
    collapsedGroups: retainedCollapsedGroups(state, graph),
    edgeLabelDraft: null,
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
function selectedFragment(state: EditorState): FlowGraph {
  const included = withDescendants(state.graph, state.selectedNodes);
  return copyGraph({
    nodes: state.graph.nodes
      .filter((node) => included.has(node.id))
      .map((node) => {
        if (node.parentId === undefined || included.has(node.parentId)) return node;
        const { parentId: _, extent: _extent, expandParent: _expandParent, ...root } = node;
        return root;
      }),
    edges: state.graph.edges.filter(
      (edge) => included.has(edge.source.node) && included.has(edge.target.node),
    ),
  });
}

function insertFragment(
  state: EditorState,
  fragment: FlowGraph,
  canSelectNode: EditorPolicy['canSelectNode'],
): EditorState {
  if (fragment.nodes.length === 0) return state;
  const taken = new Set([...state.graph.nodes, ...state.graph.edges].map((item) => item.id));
  let sequence = 1;
  const nextId = () => {
    while (taken.has(`copy:${sequence}`)) sequence++;
    return `copy:${sequence++}`;
  };
  const ids = new Map(fragment.nodes.map((node) => [node.id, nextId()]));
  const remap = (id: string): string => {
    const mapped = ids.get(id);
    if (!mapped) throw new FlowError('invalid-edit', 'Copied node is missing');
    return mapped;
  };
  const occupied = new Set(
    state.graph.nodes.map((node) => `${node.position.x},${node.position.y}`),
  );
  const step = 2 * state.gridSpacing;
  let offset = step;
  for (let attempt = 0; attempt < state.graph.nodes.length; attempt++) {
    if (
      !fragment.nodes.some((node) =>
        occupied.has(`${node.position.x + offset},${node.position.y + offset}`),
      )
    )
      break;
    offset += step;
  }
  const nodes = fragment.nodes.map((node) => {
    const copy = {
      ...node,
      id: remap(node.id),
      position: { x: node.position.x + offset, y: node.position.y + offset },
    };
    return node.parentId === undefined ? copy : { ...copy, parentId: remap(node.parentId) };
  });
  const edges = fragment.edges.map((edge) => ({
    ...edge,
    id: nextId(),
    source: { ...edge.source, node: remap(edge.source.node) },
    target: { ...edge.target, node: remap(edge.target.node) },
  }));
  const graph = {
    nodes: [...state.graph.nodes, ...nodes],
    edges: [...state.graph.edges, ...edges],
  };
  return {
    ...commitGraph(state, graph),
    selectedNodes: nodes
      .filter(
        (node) => node.parentId === undefined && (canSelectNode?.(node, graph) ?? null) === null,
      )
      .map((node) => node.id),
    selectedEdges: [],
    notice: `${nodes.length} pasted`,
  };
}

function containedOffset(graph: FlowGraph, moving: ReadonlySet<string>, delta: Point): Point {
  if (delta.x === 0 && delta.y === 0) return delta;
  let left = -Infinity;
  let right = Infinity;
  let top = -Infinity;
  let bottom = Infinity;
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  for (const node of graph.nodes) {
    if (
      node.extent !== 'parent' ||
      !moving.has(node.id) ||
      node.parentId === undefined ||
      moving.has(node.parentId)
    )
      continue;
    const parent = byId.get(node.parentId);
    if (!parent) continue;
    const fitsX = node.size.width <= parent.size.width;
    const fitsY = node.size.height <= parent.size.height;
    left = Math.max(left, fitsX ? parent.position.x - node.position.x : 0);
    right = Math.min(
      right,
      fitsX ? parent.position.x + parent.size.width - node.position.x - node.size.width : 0,
    );
    top = Math.max(top, fitsY ? parent.position.y - node.position.y : 0);
    bottom = Math.min(
      bottom,
      fitsY ? parent.position.y + parent.size.height - node.position.y - node.size.height : 0,
    );
  }
  return {
    x: left > right ? 0 : Math.max(left, Math.min(right, delta.x)),
    y: top > bottom ? 0 : Math.max(top, Math.min(bottom, delta.y)),
  };
}

function move(graph: FlowGraph, moving: ReadonlySet<string>, delta: Point): FlowGraph {
  finitePoint(delta);
  const offset = containedOffset(graph, moving, delta);
  if (offset.x === 0 && offset.y === 0) return graph;
  const moved = {
    ...graph,
    nodes: graph.nodes.map((node) =>
      moving.has(node.id)
        ? { ...node, position: { x: node.position.x + offset.x, y: node.position.y + offset.y } }
        : node,
    ),
  };
  validateGraph(moved);
  return moved;
}
function reparentDraggedNodes(
  graph: FlowGraph,
  ids: readonly string[],
  parentId: string | null,
): FlowGraph {
  const moving = withDescendants(graph, ids);
  const selected = new Set(ids);
  let changed = false;
  const nodes = graph.nodes.map((node) => {
    if (
      node.extent === 'parent' ||
      !selected.has(node.id) ||
      (node.parentId !== undefined && moving.has(node.parentId)) ||
      (node.parentId ?? null) === parentId
    )
      return node;
    changed = true;
    const { parentId: _previousParent, ...root } = node;
    if (parentId !== null) return { ...root, parentId };
    const { expandParent: _expandParent, ...detached } = root;
    return detached;
  });
  return changed ? { ...graph, nodes } : graph;
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
  if (state.gesture.type === 'pan' || state.gesture.type === 'pinch')
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

function connectionReason(
  graph: FlowGraph,
  edge: FlowEdge,
  policy: EditorPolicy,
  replacedId?: string,
) {
  if (portKind(graph, edge.source) !== 'output' || portKind(graph, edge.target) !== 'input')
    return 'Choose a compatible port.';
  const remaining = graph.edges.filter((item) => item.id !== replacedId);
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
      node.size.width === b.nodes[index]?.size.width &&
      node.size.height === b.nodes[index]?.size.height,
  );
}
// Metadata edits reuse the nodes and endpoints. Geometry edits replace them.
function routesForHistory(state: EditorState, graph: FlowGraph): EditorState['routes'] {
  const before = state.graph;
  return before.nodes === graph.nodes &&
    before.edges.length === graph.edges.length &&
    before.edges.every((edge, index) => {
      const other = graph.edges[index];
      return edge.id === other?.id && edge.source === other.source && edge.target === other.target;
    })
    ? state.routes
    : [];
}
function cancelFit(state: EditorState): EditorState {
  const transition = state.fitViewTransition;
  return transition.type === 'idle'
    ? state
    : { ...state, fitViewTransition: { type: 'idle', id: transition.id } };
}

function advanceFit(
  state: EditorState,
  event: Extract<EditorEvent, { type: 'FitViewAnimationFrame' }>,
): EditorState {
  const transition = state.fitViewTransition;
  if (transition.type !== 'fitting' || transition.id !== event.id || !Number.isFinite(event.time))
    return state;

  const { from, to, startedAt } = transition;
  if (event.reducedMotion) return { ...cancelFit(state), viewport: to };
  if (startedAt === null)
    return { ...state, fitViewTransition: { ...transition, startedAt: event.time } };

  const progress = (event.time - startedAt) / state.fitViewDuration;
  if (progress >= 1) return { ...cancelFit(state), viewport: to };
  if (progress <= 0) return state;
  const eased = 1 - (1 - progress) ** 3;
  const interpolate = (key: keyof Viewport) => from[key] * (1 - eased) + to[key] * eased;
  return {
    ...state,
    viewport: {
      x: interpolate('x'),
      y: interpolate('y'),
      zoom: clampZoom(interpolate('zoom'), state.zoomLimits),
    },
  };
}

/** Pure reducer. Consumers retain the returned state in their own Model. */
export function updateEditor(
  state: EditorState,
  event: EditorEvent,
  policy: EditorPolicy = {},
): EditorState {
  if (event.type === 'FitViewAnimationFrame') return advanceFit(state, event);
  switch (event.type) {
    case 'ViewportNudged':
    case 'ViewportChanged':
    case 'MinimapClicked':
    case 'Zoomed':
    case 'PanStarted':
    case 'PinchStarted':
    case 'NodeDragStarted':
    case 'NodeResizeStarted':
    case 'BoxSelectionStarted':
    case 'ConnectionDragStarted':
    case 'ReconnectionDragStarted':
    case 'GestureCancelled':
      state = cancelFit(state);
      break;
  }

  if (
    state.context &&
    event.type !== 'ContextOpened' &&
    event.type !== 'GroupDimensionChanged' &&
    event.type !== 'SurfaceMeasured' &&
    event.type !== 'NodeMeasured'
  )
    state = { ...state, context: null };

  switch (event.type) {
    case 'ContextDismissed':
      return state;
    case 'ContextOpened': {
      if (state.readOnly || state.gesture.type !== 'idle') return state;
      const context = event.context;
      const node =
        context.kind === 'node'
          ? state.graph.nodes.find((item) => item.id === context.id)
          : undefined;
      const edge =
        context.kind === 'edge'
          ? state.graph.edges.find((item) => item.id === context.id)
          : undefined;
      if (!node && !edge) return state;
      const reason = node
        ? policy.canSelectNode?.(node, state.graph)
        : edge && policy.canSelectEdge?.(edge, state.graph);
      if (reason !== null && reason !== undefined) return { ...state, notice: reason };
      finitePoint(context.point);
      return {
        ...state,
        context,
        edgeLabelDraft: null,
        connection: null,
        selectedNodes: context.kind === 'node' ? [context.id] : [],
        selectedEdges: context.kind === 'edge' ? [context.id] : [],
      };
    }
    case 'NodeSelected':
    case 'SelectionNudged': {
      const { id } = event;
      if (id !== undefined) {
        const node = state.graph.nodes.find((item) => item.id === id);
        if (!node) return state;
        const reason = policy.canSelectNode?.(node, state.graph) ?? null;
        if (reason !== null) return { ...state, notice: reason };
        const additive = event.type === 'NodeSelected' && event.additive;
        state = {
          ...state,
          edgeLabelDraft: null,
          selectedNodes: selection(state.selectedNodes, id, additive),
          selectedEdges: additive ? state.selectedEdges : [],
        };
      }
      if (event.type === 'NodeSelected' || state.readOnly || state.gesture.type !== 'idle')
        return state;
      if (state.selectedNodes.length === 0 || (event.delta.x === 0 && event.delta.y === 0))
        return state;
      const moving = withDescendants(state.graph, state.selectedNodes);
      const reason = movementReason(state.graph, moving, policy.canMoveNode);
      if (reason !== undefined) return { ...state, notice: reason };
      const graph = move(state.graph, moving, event.delta);
      return graph === state.graph ? state : commitGraph(state, graph);
    }
    case 'EdgeSelected': {
      const edge = state.graph.edges.find((item) => item.id === event.id);
      if (!edge) return state;
      const reason = policy.canSelectEdge?.(edge, state.graph) ?? null;
      if (reason !== null) return { ...state, notice: reason };
      return {
        ...state,
        edgeLabelDraft: null,
        selectedEdges: selection(state.selectedEdges, event.id, event.additive),
        selectedNodes: event.additive ? state.selectedNodes : [],
      };
    }
    case 'GroupCollapseToggled': {
      const group = state.graph.nodes.find((node) => node.id === event.id && node.kind === 'group');
      if (!group || state.gesture.type !== 'idle') return state;
      const collapsed = state.collapsedGroups.includes(group.id);
      const collapsedGroups = collapsed
        ? state.collapsedGroups.filter((id) => id !== group.id)
        : [...state.collapsedGroups, group.id];
      const { hiddenBy } = presentGroups(state.graph, collapsedGroups);
      const selectedEdges = state.selectedEdges.filter((id) =>
        state.graph.edges.some((edge) => edge.id === id && edgeIsVisible(edge, hiddenBy)),
      );
      return {
        ...cancelFit(state),
        collapsedGroups,
        connection: null,
        edgeLabelDraft: null,
        selectedNodes: state.selectedNodes.filter((id) => !hiddenBy.has(id)),
        selectedEdges,
        notice: `${group.label} ${collapsed ? 'expanded' : 'collapsed'}`,
      };
    }
    case 'SelectionCleared':
      return { ...state, edgeLabelDraft: null, selectedNodes: [], selectedEdges: [] };
    case 'GestureCancelled':
      return cancel(state);
    case 'CopyPressed': {
      if (state.gesture.type !== 'idle' || state.selectedNodes.length === 0) return state;
      const clipboard = selectedFragment(state);
      return { ...state, clipboard, notice: `${clipboard.nodes.length} copied` };
    }
    case 'ConnectionListToggled':
      if (state.gesture.type !== 'idle') return state;
      return { ...state, connectionsExpanded: !state.connectionsExpanded };
    case 'BoxSelectionMatchChanged':
      if (state.gesture.type !== 'idle' || event.match === state.boxSelectionMatch) return state;
      return { ...state, boxSelectionMatch: event.match };
    case 'SelectionModeToggled':
      if (state.gesture.type !== 'idle') return state;
      return { ...state, selectionMode: !state.selectionMode };
    case 'AlignmentSnapToggled':
      if (state.readOnly || state.gesture.type !== 'idle') return state;
      return { ...state, snapToAlignment: !state.snapToAlignment };
    case 'GridSpacingChanged':
      if (
        state.readOnly ||
        state.gesture.type !== 'idle' ||
        !Number.isFinite(event.spacing) ||
        event.spacing <= 0 ||
        event.spacing === state.gridSpacing
      )
        return state;
      return { ...state, gridSpacing: event.spacing };
    case 'GridSnapToggled':
      if (state.readOnly || state.gesture.type !== 'idle') return state;
      return { ...state, snapToGrid: !state.snapToGrid };
    case 'ViewportNudged': {
      if (state.gesture.type !== 'idle') return state;
      finitePoint(event.delta);
      const viewport = {
        ...state.viewport,
        x: state.viewport.x + event.delta.x,
        y: state.viewport.y + event.delta.y,
      };
      validViewport(viewport, state.zoomLimits);
      return { ...state, viewport };
    }
    case 'ViewportChanged':
      if (state.gesture.type !== 'idle') return state;
      validViewport(event.viewport, state.zoomLimits);
      return { ...state, viewport: { ...event.viewport } };
    case 'ViewportConstraintsChanged': {
      if (state.gesture.type !== 'idle') return state;
      const { zoomLimits, fitViewPadding } = event;
      validateFitViewPadding(fitViewPadding);
      const center = { x: (state.surface?.width ?? 0) / 2, y: (state.surface?.height ?? 0) / 2 };
      return {
        ...cancelFit(state),
        viewport: zoomAt(state.viewport, center, 1, zoomLimits),
        zoomLimits: { ...zoomLimits },
        fitViewPadding,
      };
    }
    case 'FitViewClicked': {
      const { surface } = state;
      if (!surface || state.gesture.type !== 'idle' || state.graph.nodes.length === 0) return state;
      const padding = Math.min(state.fitViewPadding, surface.width / 4, surface.height / 4);
      const to = fitNodes(
        presentGroups(state.graph, state.collapsedGroups).nodes,
        surface,
        padding,
        state.zoomLimits,
      );
      const from = state.viewport;
      if (
        state.fitViewDuration === 0 ||
        (from.x === to.x && from.y === to.y && from.zoom === to.zoom)
      )
        return { ...cancelFit(state), viewport: to };
      return {
        ...state,
        fitViewTransition: {
          type: 'fitting',
          id: state.fitViewTransition.id + 1,
          from,
          to,
          startedAt: null,
        },
      };
    }
    case 'FitViewDurationChanged':
      if (
        !Number.isFinite(event.duration) ||
        event.duration < 0 ||
        event.duration === state.fitViewDuration
      )
        return state;
      return { ...cancelFit(state), fitViewDuration: event.duration };
    case 'MinimapClicked': {
      const { surface, viewport } = state;
      if (!surface || state.gesture.type !== 'idle') return state;
      finitePoint(event.point);
      const { x, y, width, height } = minimapGeometry(
        presentGroups(state.graph, state.collapsedGroups),
        surface,
        viewport,
      );
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
      return {
        ...state,
        viewport: zoomAt(state.viewport, event.point, event.factor, state.zoomLimits),
      };
    case 'PinchStarted': {
      if (!Number.isFinite(event.distance) || event.distance < 1 || state.gesture.type === 'pinch')
        return state;
      finitePoint(event.center);
      const ready =
        state.gesture.type === 'idle' && state.connection === null ? state : cancel(state);
      return {
        ...ready,
        edgeLabelDraft: null,
        gesture: {
          type: 'pinch',
          center: event.center,
          distance: event.distance,
          before: ready.viewport,
        },
      };
    }
    case 'PinchMoved': {
      const gesture = state.gesture;
      if (gesture.type !== 'pinch' || !Number.isFinite(event.distance) || event.distance < 1)
        return state;
      finitePoint(event.center);
      const zoomed = zoomAt(
        gesture.before,
        gesture.center,
        event.distance / gesture.distance,
        state.zoomLimits,
      );
      const viewport = {
        ...zoomed,
        x: zoomed.x + event.center.x - gesture.center.x,
        y: zoomed.y + event.center.y - gesture.center.y,
      };
      validViewport(viewport, state.zoomLimits);
      return { ...state, viewport };
    }
    case 'PinchEnded':
      return state.gesture.type === 'pinch' ? { ...state, gesture: { type: 'idle' } } : state;
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
    case 'DragPanned': {
      const gesture = state.gesture;
      if (
        state.readOnly ||
        (gesture.type !== 'node-drag' && gesture.type !== 'connection-drag') ||
        gesture.pointer !== event.pointer
      )
        return state;
      const { type: _type, delta, ...move } = event;
      finitePoint(delta);
      const viewport = {
        ...state.viewport,
        x: state.viewport.x + delta.x,
        y: state.viewport.y + delta.y,
      };
      validViewport(viewport, state.zoomLimits);
      return updateEditor(
        {
          ...state,
          viewport,
          gesture:
            gesture.type === 'node-drag'
              ? {
                  ...gesture,
                  origin: { x: gesture.origin.x + delta.x, y: gesture.origin.y + delta.y },
                }
              : gesture,
        },
        { ...move, type: 'PointerMoved' },
        policy,
      );
    }
    case 'PointerMoved': {
      const gesture = state.gesture;
      if (gesture.type === 'idle' || gesture.type === 'pinch' || gesture.pointer !== event.pointer)
        return state;
      finitePoint(event.point);
      if (gesture.type === 'box-selection')
        return {
          ...state,
          gesture: { ...gesture, point: screenToWorld(event.point, state.viewport) },
        };
      if (gesture.type === 'connection-drag') {
        const existing =
          gesture.reconnect && state.graph.edges.find((edge) => edge.id === gesture.reconnect?.id);
        if (existing && gesture.reconnect) {
          const reason =
            policy.canReconnect?.(existing, gesture.reconnect.end, state.graph) ?? null;
          if (reason !== null) return { ...cancel(state), notice: reason };
        }
        let feedback: ConnectionTarget = { target: null };
        if (state.connection) {
          const candidates = event.target ? [event.target] : (event.nearbyTargets ?? []);
          for (const candidate of candidates) {
            const edge =
              existing && gesture.reconnect
                ? { ...existing, [gesture.reconnect.end]: candidate }
                : proposedEdge(state.graph, state.connection, candidate);
            const reason = connectionReason(state.graph, edge, policy, existing?.id);
            if (reason === null) {
              feedback = { target: candidate };
              break;
            }
            if (event.target)
              feedback = { target: null, rejected: { endpoint: candidate, reason } };
          }
        }
        const { target: _target, rejected: _rejected, ...previous } = gesture;
        return {
          ...state,
          gesture: { ...previous, point: event.point, ...feedback },
          notice:
            feedback.rejected?.reason ??
            (feedback.target
              ? 'Release to connect.'
              : 'Drag to a compatible port. Escape cancels.'),
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
        if (original.kind === 'group') {
          const raw = { x: delta.x / state.viewport.zoom, y: delta.y / state.viewport.zoom };
          const handle = gesture.handle ?? gesture.corner ?? 'bottom-right';
          const { nodes } = presentGroups(gesture.before, state.collapsedGroups);
          const alignment =
            state.snapToAlignment && Math.hypot(delta.x, delta.y) >= 4
              ? alignResize(
                  nodes,
                  original,
                  withDescendants(gesture.before, [original.id]),
                  state.collapsedGroups,
                  raw,
                  handle,
                  state.viewport.zoom,
                )
              : [];
          const graph = resizeGroup(
            gesture.before,
            original.id,
            raw,
            handle,
            state.snapToGrid,
            state.gridSpacing,
            alignment,
          );
          const reason = resizeChangeReason(gesture.before, graph, policy.canResizeNode);
          if (reason !== null) return { ...cancel(state), notice: reason };
          const resized = graph.nodes.find((node) => node.id === original.id) ?? original;
          const guides = resizeGuides(resized, handle, alignment, state.viewport.zoom);
          const resize = { ...gesture, guides };
          if (sameGeometry(state.graph, graph))
            return sameGuides(gesture.guides ?? [], guides) ? state : { ...state, gesture: resize };
          return { ...state, gesture: resize, graph, revision: state.revision + 1, routes: [] };
        }
        const initial = original.size.width;
        const minimum =
          original.resizeLimits?.minWidth ??
          Math.min(140, initial, original.resizeLimits?.maxWidth ?? Infinity);
        const maximum = original.resizeLimits?.maxWidth ?? Math.max(320, initial, minimum);
        const width = Math.max(minimum, Math.min(maximum, initial + delta.x / state.viewport.zoom));
        if (state.graph.nodes.find((node) => node.id === original.id)?.size.width === width)
          return state;
        const graph = expandParents(
          {
            ...gesture.before,
            nodes: gesture.before.nodes.map((node) =>
              node.id === original.id ? { ...node, size: { ...node.size, width } } : node,
            ),
          },
          original.id,
        );
        const reason = resizeChangeReason(gesture.before, graph, policy.canResizeNode);
        if (reason !== null) return { ...cancel(state), notice: reason };
        return { ...state, graph, revision: state.revision + 1, routes: [] };
      }
      const moving = withDescendants(gesture.before, gesture.ids);
      const reason = movementReason(gesture.before, moving, policy.canMoveNode);
      if (reason !== undefined) return { ...cancel(state), notice: reason };
      const zoom = state.viewport.zoom;
      const raw = { x: delta.x / zoom, y: delta.y / zoom };
      const fallback = { ...raw };
      const anchor =
        state.snapToGrid && gesture.before.nodes.find((node) => node.id === gesture.ids[0]);
      if (anchor && (raw.x !== 0 || raw.y !== 0)) {
        const snap = (value: number) => Math.round(value / state.gridSpacing) * state.gridSpacing;
        fallback.x = snap(anchor.position.x + raw.x) - anchor.position.x;
        fallback.y = snap(anchor.position.y + raw.y) - anchor.position.y;
      }
      const dragging = Math.hypot(delta.x, delta.y) >= 4;
      const { nodes } = presentGroups(gesture.before, state.collapsedGroups);
      const { offset, guides } =
        dragging && state.snapToAlignment
          ? alignDrag(nodes, moving, state.collapsedGroups, raw, fallback, zoom)
          : { offset: fallback, guides: [] };
      const bounded = containedOffset(gesture.before, moving, offset);
      const visibleGuides = bounded.x === offset.x && bounded.y === offset.y ? guides : [];
      const graph = move(gesture.before, moving, bounded);
      const canReparent = gesture.ids.some((id) => {
        const node = gesture.before.nodes.find((node) => node.id === id);
        return (
          node &&
          node.extent !== 'parent' &&
          (node.parentId === undefined || !moving.has(node.parentId))
        );
      });
      const dropParent =
        dragging && canReparent
          ? groupAtDropPoint(
              nodes,
              state.collapsedGroups,
              moving,
              screenToWorld(event.point, state.viewport),
            )
          : undefined;
      const drag = { ...gesture, dropParent, guides: visibleGuides };
      if (sameGeometry(state.graph, graph))
        return gesture.dropParent === dropParent && sameGuides(gesture.guides, visibleGuides)
          ? state
          : { ...state, gesture: drag };
      return { ...state, graph, gesture: drag, revision: state.revision + 1, routes: [] };
    }
    case 'PointerReleased': {
      const gesture = state.gesture;
      if (gesture.type === 'idle' || gesture.type === 'pinch' || gesture.pointer !== event.pointer)
        return state;
      if (gesture.type === 'box-selection') {
        const { previewNodeIds: selectedNodes } = resolveBoxSelection(
          state,
          gesture,
          presentGroups(state.graph, state.collapsedGroups).nodes,
          policy.canSelectNode,
        );
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
      if (gesture.type === 'node-resize') {
        const reason = resizeChangeReason(gesture.before, state.graph, policy.canResizeNode);
        if (reason !== null) return { ...cancel(state), notice: reason };
      }
      if (gesture.type === 'node-drag' && policy.canMoveNode) {
        const moving = withDescendants(gesture.before, gesture.ids);
        const reason = movementReason(gesture.before, moving, policy.canMoveNode);
        if (reason !== undefined) return { ...cancel(state), notice: reason };
      }
      if (gesture.type === 'node-drag' && gesture.dropParent !== undefined) {
        const graph = reparentDraggedNodes(state.graph, gesture.ids, gesture.dropParent);
        if (graph !== state.graph)
          return {
            ...commitGraph({ ...state, graph: gesture.before }, graph),
            notice: gesture.dropParent === null ? 'Moved out of group' : 'Moved into group',
          };
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
      if (state.surface?.width === event.size.width && state.surface.height === event.size.height)
        return state;
      return { ...cancelFit(state), surface: event.size };
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
      const measure = (graph: FlowGraph): FlowGraph =>
        expandParents(
          {
            ...graph,
            nodes: graph.nodes.map((item) =>
              item.id === event.id
                ? { ...item, size: { ...item.size, height: event.size.height } }
                : item,
            ),
          },
          event.id,
        );
      const gesture =
        state.gesture.type === 'node-drag' || state.gesture.type === 'node-resize'
          ? { ...state.gesture, before: measure(state.gesture.before) }
          : state.gesture;
      return {
        ...cancelFit(state),
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
      const reason = policy.canReconnect?.(edge, event.end, state.graph) ?? null;
      if (reason !== null) return { ...state, notice: reason };
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
      const node = state.graph.nodes.find((item) => item.id === event.id);
      if (!node) return state;
      finitePoint(event.point);
      const selectionReason = policy.canSelectNode?.(node, state.graph) ?? null;
      if (selectionReason !== null) return { ...state, notice: selectionReason };
      const resizing = event.type === 'NodeResizeStarted';
      if (resizing) {
        if (state.collapsedGroups.includes(event.id)) return state;
        const reason = policy.canResizeNode?.(node, state.graph) ?? null;
        if (reason !== null) return { ...state, notice: reason };
      }
      const ids =
        !resizing && state.selectedNodes.includes(event.id) ? state.selectedNodes : [event.id];
      const selected = { ...state, selectedNodes: ids, selectedEdges: [], connection: null };
      if (!resizing && policy.canMoveNode) {
        const reason = movementReason(
          state.graph,
          withDescendants(state.graph, ids),
          policy.canMoveNode,
        );
        if (reason !== undefined) return { ...selected, notice: reason };
      }
      return {
        ...selected,
        gesture: {
          ...(resizing
            ? {
                type: 'node-resize' as const,
                handle: event.handle ?? event.corner ?? 'bottom-right',
                guides: [],
              }
            : { type: 'node-drag' as const, dropParent: undefined, guides: [] }),
          pointer: event.pointer,
          origin: event.point,
          before: state.graph,
          ids: [event.id, ...ids.filter((id) => id !== event.id)],
        },
      };
    }
    case 'NodeExpansionToggled': {
      const node = state.graph.nodes.find((node) => node.id === event.id);
      if (!node || node.parentId === undefined) return state;
      const { expandParent: _expandParent, ...free } = node;
      const updated = node.expandParent ? free : { ...node, expandParent: true };
      return commitGraph(
        state,
        expandParents(
          {
            ...state.graph,
            nodes: state.graph.nodes.map((node) => (node.id === event.id ? updated : node)),
          },
          node.id,
        ),
      );
    }
    case 'NodeContainmentToggled': {
      const node = state.graph.nodes.find((node) => node.id === event.id);
      if (!node || node.parentId === undefined) return state;
      const { extent: _extent, ...free } = node;
      const updated = node.extent === 'parent' ? free : { ...node, extent: 'parent' as const };
      return commitGraph(state, {
        ...state.graph,
        nodes: state.graph.nodes.map((node) => (node.id === event.id ? updated : node)),
      });
    }
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
    case 'GroupDimensionChanged': {
      if (!Number.isFinite(event.value) || event.value <= 0) return state;
      const group = state.graph.nodes.find((node) => node.id === event.id && node.kind === 'group');
      if (!group || state.collapsedGroups.includes(group.id)) return state;
      const delta =
        event.dimension === 'width'
          ? { x: event.value - group.size.width, y: 0 }
          : { x: 0, y: event.value - group.size.height };
      const graph = resizeGroup(
        state.graph,
        group.id,
        delta,
        'bottom-right',
        state.snapToGrid,
        state.gridSpacing,
      );
      if (graph === state.graph) return state;
      const reason = resizeChangeReason(state.graph, graph, policy.canResizeNode);
      if (reason !== null) return { ...state, notice: reason };
      const context =
        state.context?.kind === 'node' && state.context.id === group.id ? state.context : null;
      return { ...commitGraph(state, graph), context, notice: 'Group resized' };
    }
    case 'NodeResizeNudged': {
      const node = state.graph.nodes.find((node) => node.id === event.id && node.kind !== 'group');
      if (!node || !Number.isFinite(event.delta)) return state;
      const proposed = node.size.width + event.delta;
      const width = state.snapToGrid
        ? Math.round(proposed / state.gridSpacing) * state.gridSpacing
        : proposed;
      return updateEditor(state, { type: 'NodeWidthChanged', id: node.id, width }, policy);
    }
    case 'NodeWidthChanged': {
      if (!Number.isFinite(event.width) || event.width <= 0) return state;
      const node = state.graph.nodes.find((node) => node.id === event.id);
      if (!node) return state;
      if (node.kind === 'group')
        return updateEditor(
          state,
          { type: 'GroupDimensionChanged', id: node.id, dimension: 'width', value: event.width },
          policy,
        );
      const width = Math.max(
        node.resizeLimits?.minWidth ?? 0,
        Math.min(node.resizeLimits?.maxWidth ?? Infinity, event.width),
      );
      if (width === node.size.width) return state;
      const graph = expandParents(
        {
          ...state.graph,
          nodes: state.graph.nodes.map((node) =>
            node.id === event.id ? { ...node, size: { ...node.size, width } } : node,
          ),
        },
        event.id,
      );
      const reason = resizeChangeReason(state.graph, graph, policy.canResizeNode);
      return reason === null ? commitGraph(state, graph) : { ...state, notice: reason };
    }
    case 'EdgeLabelEditingStarted': {
      const edge = state.graph.edges.find((edge) => edge.id === event.id);
      if (!edge || state.edgeLabelDraft?.id === edge.id) return state;
      const reason = policy.canSelectEdge?.(edge, state.graph) ?? null;
      if (reason !== null) return { ...state, notice: reason };
      return {
        ...state,
        selectedNodes: [],
        selectedEdges: [edge.id],
        edgeLabelDraft: { id: edge.id, text: edge.label ?? '' },
      };
    }
    case 'EdgeLabelDraftChanged':
      if (state.edgeLabelDraft?.id !== event.id) return state;
      return { ...state, edgeLabelDraft: { id: event.id, text: event.text } };
    case 'EdgeLabelCancelled':
      if (state.edgeLabelDraft?.id !== event.id) return state;
      return { ...state, edgeLabelDraft: null };
    case 'EdgeLabelSaved': {
      if (state.edgeLabelDraft?.id !== event.id) return state;
      const edge = state.graph.edges.find((edge) => edge.id === event.id);
      const label = state.edgeLabelDraft.text.trim();
      if (!edge || (label || undefined) === edge.label) return { ...state, edgeLabelDraft: null };
      const { label: _previousLabel, ...unlabeled } = edge;
      const updated = label ? { ...unlabeled, label } : unlabeled;
      return {
        ...commitGraph(state, {
          ...state.graph,
          edges: state.graph.edges.map((edge) => (edge.id === event.id ? updated : edge)),
        }),
        routes: state.routes,
        notice: label ? 'Edge label saved' : 'Edge label removed',
      };
    }
    case 'EdgePathStyleChanged': {
      const edge = state.graph.edges.find((edge) => edge.id === event.id);
      if (!edge || edge.pathStyle === (event.pathStyle ?? undefined)) return state;
      const { pathStyle: _previousStyle, ...automatic } = edge;
      const updated = event.pathStyle ? { ...automatic, pathStyle: event.pathStyle } : automatic;
      return {
        ...commitGraph(state, {
          ...state.graph,
          edges: state.graph.edges.map((edge) => (edge.id === event.id ? updated : edge)),
        }),
        routes: state.routes,
      };
    }
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
      const locked = policy.canReconnect?.(existing, event.end, state.graph) ?? null;
      if (locked !== null) return { ...state, notice: locked };
      const edge = { ...existing, [event.end]: { ...event.endpoint } };
      const reason = connectionReason(state.graph, edge, policy, edge.id);
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
      const reason = connectionReason(state.graph, event.edge, policy);
      if (reason !== null) return { ...state, notice: reason, connection: null };
      return { ...commitGraph(state, copyGraph(graph)), notice: 'Connection created' };
    }
    case 'PortPositionsChanged': {
      if (event.positions.length === 0) return state;
      const byNode = new Map<string, Map<string, (typeof event.positions)[number]['position']>>();
      for (const { endpoint, position } of event.positions) {
        const node = state.graph.nodes.find((node) => node.id === endpoint.node);
        if (!node?.ports.some((port) => port.id === endpoint.port))
          throw new FlowError('invalid-edit', 'Port position edit references an unknown port');
        const positions = byNode.get(endpoint.node) ?? new Map();
        if (positions.has(endpoint.port))
          throw new FlowError('invalid-edit', 'Port position edit repeats an endpoint');
        positions.set(endpoint.port, position);
        byNode.set(endpoint.node, positions);
      }
      let changed = false;
      const nodes = state.graph.nodes.map((node) => {
        const positions = byNode.get(node.id);
        if (!positions) return node;
        const ports = node.ports.map((port) => {
          const position = positions.get(port.id);
          if (!position) return port;
          const updated = withPortPosition(port, position);
          const same =
            port.side === position.side &&
            (port.anchor && position.anchor
              ? port.anchor.x === position.anchor.x && port.anchor.y === position.anchor.y
              : port.offset !== undefined && port.offset === position.offset);
          if (same) return port;
          changed = true;
          return updated;
        });
        return { ...node, ports };
      });
      return changed ? commitGraph(state, { ...state.graph, nodes }) : state;
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
    case 'PastePressed':
      return state.clipboard ? insertFragment(state, state.clipboard, policy.canSelectNode) : state;
    case 'DuplicatePressed': {
      const duplicated = insertFragment(state, selectedFragment(state), policy.canSelectNode);
      return duplicated === state ? state : { ...duplicated, notice: 'Selection duplicated' };
    }
    case 'GroupAspectRatioToggled': {
      const group = state.graph.nodes.find((node) => node.id === event.id && node.kind === 'group');
      if (!group) return state;
      return {
        ...commitGraph(state, {
          ...state.graph,
          nodes: state.graph.nodes.map((node) =>
            node.id === group.id ? { ...node, keepAspectRatio: !group.keepAspectRatio } : node,
          ),
        }),
        notice: group.keepAspectRatio ? 'Group proportions unlocked' : 'Group proportions locked',
      };
    }
    case 'GroupResizeNudged': {
      if (state.collapsedGroups.includes(event.id)) return state;
      finitePoint(event.delta);
      const graph = resizeGroup(
        state.graph,
        event.id,
        event.delta,
        event.handle ?? event.corner,
        state.snapToGrid,
        state.gridSpacing,
      );
      if (graph === state.graph) return state;
      const reason = resizeChangeReason(state.graph, graph, policy.canResizeNode);
      return reason === null
        ? { ...commitGraph(state, graph), notice: 'Group resized' }
        : { ...state, notice: reason };
    }
    case 'GroupFitClicked': {
      const group = state.graph.nodes.find((node) => node.id === event.id && node.kind === 'group');
      if (!group) return state;
      const locked = policy.canResizeNode?.(group, state.graph) ?? null;
      if (locked !== null) return { ...state, notice: locked };
      const included = withDescendants(state.graph, [group.id]);
      const contents = state.graph.nodes.filter(
        (node) => node.id !== group.id && included.has(node.id),
      );
      if (contents.length === 0) return { ...state, notice: 'Group has no contents to fit.' };
      const bounds = fittedGroupBounds(contents);
      const fitted = {
        ...group,
        ...bounds,
        size: { width: Math.max(224, bounds.size.width), height: Math.max(96, bounds.size.height) },
      };
      if (
        fitted.position.x === group.position.x &&
        fitted.position.y === group.position.y &&
        fitted.size.width === group.size.width &&
        fitted.size.height === group.size.height
      )
        return state;
      const graph = expandParents(
        {
          ...state.graph,
          nodes: state.graph.nodes.map((node) => (node.id === group.id ? fitted : node)),
        },
        group.id,
      );
      const parent = graph.nodes.find((node) => node.id === group.parentId);
      if (
        group.extent === 'parent' &&
        parent &&
        (fitted.position.x < parent.position.x ||
          fitted.position.y < parent.position.y ||
          fitted.position.x + fitted.size.width > parent.position.x + parent.size.width ||
          fitted.position.y + fitted.size.height > parent.position.y + parent.size.height)
      )
        return { ...state, notice: 'Fitted bounds exceed the parent. Enable Grow parent to fit.' };
      const reason = resizeChangeReason(state.graph, graph, policy.canResizeNode);
      return reason === null
        ? { ...commitGraph(state, graph), notice: 'Group fitted to contents' }
        : { ...state, notice: reason };
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
      let index = 1;
      while (state.graph.nodes.some((node) => node.id === `group:${index}`)) index++;
      const boundary: FlowNode = {
        id: `group:${index}`,
        label: `Group ${index}`,
        kind: 'group',
        ...fittedGroupBounds(contents),
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
        selectedNodes: (policy.canSelectNode?.(group, graph) ?? null) === null ? [group.id] : [],
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
          const { parentId: _, extent: _extent, expandParent: _expandParent, ...root } = node;
          return parent === undefined ? root : { ...node, parentId: parent };
        });
      return { ...commitGraph(state, { ...state.graph, nodes }), notice: 'Selection ungrouped' };
    }
    case 'EdgeDeleted':
    case 'DeletePressed': {
      const targets =
        event.type === 'EdgeDeleted'
          ? { nodeIds: [], edgeIds: [event.id] }
          : { nodeIds: state.selectedNodes, edgeIds: state.selectedEdges };
      const decision = resolveDeletion(state.graph, targets, policy.canDelete);
      if (decision.type === 'empty') return state;
      if (decision.type === 'blocked') return { ...state, notice: decision.reason };
      const nodeIds = new Set(decision.candidate.nodes.map((node) => node.id));
      const edgeIds = new Set(decision.candidate.edges.map((edge) => edge.id));
      const committed = commitGraph(state, {
        nodes: state.graph.nodes.filter((node) => !nodeIds.has(node.id)),
        edges: state.graph.edges.filter((edge) => !edgeIds.has(edge.id)),
      });
      return event.type === 'EdgeDeleted'
        ? {
            ...committed,
            routes: state.routes.filter((route) => !edgeIds.has(route.id)),
            notice: 'Connection deleted',
          }
        : committed;
    }
    case 'UndoPressed': {
      const graph = state.past.at(-1);
      if (!graph) return state;
      return {
        ...cancelFit(state),
        graph,
        collapsedGroups: retainedCollapsedGroups(state, graph),
        revision: state.revision + 1,
        past: state.past.slice(0, -1),
        future: [state.graph, ...state.future],
        routes: routesForHistory(state, graph),
        connection: null,
        selectedNodes: [],
        selectedEdges: [],
        edgeLabelDraft: null,
        notice: 'Undone',
      };
    }
    case 'RedoPressed': {
      const graph = state.future[0];
      if (!graph) return state;
      return {
        ...cancelFit(state),
        graph,
        collapsedGroups: retainedCollapsedGroups(state, graph),
        revision: state.revision + 1,
        past: history(state, state.graph),
        future: state.future.slice(1),
        routes: routesForHistory(state, graph),
        connection: null,
        selectedNodes: [],
        selectedEdges: [],
        edgeLabelDraft: null,
        notice: 'Redone',
      };
    }
  }
}
