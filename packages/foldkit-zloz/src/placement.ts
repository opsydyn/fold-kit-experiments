import { commitGraph } from './editor';
import { finitePoint, screenToWorld } from './geometry';
import { copyGraph, ZlozError } from './graph';
import { presentVisibleGraph } from './group-presentation';
import {
  patternInsertionReason,
  preparePatternInsertion,
  type ZlozPatternInsertionPolicy,
} from './patterns';
import type { EditorState, Point, Size, Viewport, ZlozGraph, ZlozNode } from './types';

export type ZlozPlacementSource = Readonly<{ type: 'palette' | 'external'; id: string }>;
/** Node-frame anchors, independent of HTML content or artistic outline geometry. */
export type ZlozPlacementAnchor =
  | 'center'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';
export type ZlozPlacementIntent = Readonly<{
  source: ZlozPlacementSource;
  fragment: ZlozGraph;
  /** Grip in the fragment's world-coordinate system, not a normalized fraction. */
  anchor: Point;
  snapping?: Readonly<{
    grid?: boolean;
    anchorDistance?: number;
    anchors?: readonly ZlozPlacementAnchor[];
  }>;
}>;
export type ZlozPlacementTarget = Readonly<{
  /** screen is canvas-local CSS pixels; client subtracts context.origin first. */
  space: 'world' | 'screen' | 'client';
  point: Point;
  parentId?: string | null;
  /** Defaults to true when a parent is chosen. False permits unconstrained membership. */
  constrainToParent?: boolean;
  snapBypassed?: boolean;
}>;
/** Scope must identify this editor/controller incarnation; change it when replacing either. */
export type ZlozPlacementContext = Readonly<{ scope: string; editor: EditorState; origin?: Point }>;
/** Projection/preferences captured with a target fact, rebuilt only by updatePlacement. */
export type ZlozPlacementTargetSample = Readonly<{
  target: ZlozPlacementTarget;
  viewport: Viewport;
  surface: Size | null;
  origin: Point | null;
  grid: boolean;
  gridSpacing: number;
  presentationKey: string;
}>;
export type ZlozPlacement =
  | Readonly<{ type: 'idle'; scope: string; generation: number }>
  | Readonly<{
      type: 'placing';
      scope: string;
      generation: number;
      revision: number;
      intent: ZlozPlacementIntent;
      targetRevision: number;
      sample: ZlozPlacementTargetSample | null;
    }>;
export type ZlozPlacementEvent = Readonly<{ scope: string; generation: number }> &
  (
    | Readonly<{ type: 'PlacementStarted'; intent: ZlozPlacementIntent }>
    | Readonly<{ type: 'PlacementTargetChanged'; target: ZlozPlacementTarget }>
    | Readonly<{ type: 'PlacementCancelled' }>
  );
/** Pins both the active source and the reviewed target sample. Never grants permission. */
export type ZlozPlacementRequest = Readonly<{
  scope: string;
  generation: number;
  targetRevision: number;
}>;
export type ZlozPlacementSnap = Readonly<{ raw: Point; position: Point }> &
  (
    | Readonly<{ type: 'none' | 'grid'; anchor?: never }>
    | Readonly<{ type: 'anchor'; anchor: Readonly<{ nodeId: string; kind: ZlozPlacementAnchor }> }>
  );
export type ZlozPlacementCandidate = Readonly<{
  source: ZlozPlacementSource;
  position: Point;
  offset: Point;
  snap: ZlozPlacementSnap;
  parent: ZlozNode | null;
  /** Inserted subset; parent IDs may refer to existing nodes in graph. */
  fragment: ZlozGraph;
  graph: ZlozGraph;
}>;
export type ZlozPlacementPolicy = ZlozPatternInsertionPolicy &
  Readonly<{
    /** Complete validated proposal, alongside the current graph. Return a protection reason or null. */
    canPlace?: (candidate: ZlozPlacementCandidate, current: ZlozGraph) => string | null;
  }>;
export type ZlozPlacementPreview =
  | Readonly<{ type: 'idle' | 'pending' }>
  | Readonly<{ type: 'blocked'; reason: string }>
  | (ZlozPlacementCandidate &
      Readonly<{
        type: 'ready';
        request: ZlozPlacementRequest;
        nodeIds: ReadonlyMap<string, string>;
        edgeIds: ReadonlyMap<string, string>;
      }>);
export type ZlozPlacementResult =
  | Readonly<{ type: 'blocked'; reason: string; editor: EditorState; placement: ZlozPlacement }>
  | Readonly<{
      type: 'placed';
      editor: EditorState;
      placement: Extract<ZlozPlacement, { type: 'idle' }>;
      source: ZlozPlacementSource;
      snap: ZlozPlacementSnap;
      nodeIds: ReadonlyMap<string, string>;
      edgeIds: ReadonlyMap<string, string>;
    }>;

const anchors: readonly ZlozPlacementAnchor[] = [
  'center',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
];
function isContainer(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}
function isRecord(value: unknown): value is object {
  return isContainer(value) && !Array.isArray(value);
}
function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
function isPoint(value: unknown): value is Point {
  return (
    isRecord(value) &&
    'x' in value &&
    'y' in value &&
    typeof value.x === 'number' &&
    Number.isFinite(value.x) &&
    typeof value.y === 'number' &&
    Number.isFinite(value.y)
  );
}
function isSource(value: unknown): value is ZlozPlacementSource {
  return (
    isRecord(value) &&
    'type' in value &&
    'id' in value &&
    (value.type === 'palette' || value.type === 'external') &&
    isText(value.id)
  );
}
function isAnchor(value: unknown): value is ZlozPlacementAnchor {
  return anchors.some((anchor) => anchor === value);
}
function isSnapping(value: unknown): value is NonNullable<ZlozPlacementIntent['snapping']> {
  return (
    isRecord(value) &&
    (!('grid' in value) || typeof value.grid === 'boolean') &&
    (!('anchorDistance' in value) ||
      (typeof value.anchorDistance === 'number' &&
        Number.isFinite(value.anchorDistance) &&
        value.anchorDistance >= 0)) &&
    (!('anchors' in value) ||
      (Array.isArray(value.anchors) &&
        new Set(value.anchors).size === value.anchors.length &&
        value.anchors.every(isAnchor)))
  );
}
function isTarget(value: unknown): value is ZlozPlacementTarget {
  return (
    isRecord(value) &&
    'space' in value &&
    'point' in value &&
    (value.space === 'world' || value.space === 'screen' || value.space === 'client') &&
    isPoint(value.point) &&
    (!('parentId' in value) || value.parentId === null || isId(value.parentId)) &&
    (!('constrainToParent' in value) || typeof value.constrainToParent === 'boolean') &&
    (!('snapBypassed' in value) || typeof value.snapBypassed === 'boolean')
  );
}
function invalid(message: string): never {
  throw new ZlozError('invalid-edit', message);
}
function next(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value >= Number.MAX_SAFE_INTEGER)
    invalid('Placement counter is invalid or exhausted.');
  return value + 1;
}
function freeze<T>(value: T): T {
  if (isContainer(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function point(value: Point): Point {
  if (!isPoint(value)) invalid('Placement coordinates must be finite points.');
  return { x: value.x, y: value.y };
}
function usesAnchors(intent: ZlozPlacementIntent): boolean {
  return (
    (intent.snapping?.anchorDistance ?? 0) > 0 &&
    (intent.snapping?.anchors?.length ?? anchors.length) > 0
  );
}
function captureIntent(intent: ZlozPlacementIntent): ZlozPlacementIntent {
  if (!isRecord(intent) || !isSource(intent.source))
    invalid('Placement requires an identified palette or external source.');
  const anchor = point(intent.anchor);
  const fragment = copyGraph(intent.fragment);
  if (!fragment.nodes.length) invalid('A placement source must contain at least one node.');
  if (intent.snapping !== undefined && !isSnapping(intent.snapping))
    invalid('Invalid placement snapping options.');
  const snapping = intent.snapping ?? {};
  const captured = {
    source: { type: intent.source.type, id: intent.source.id },
    fragment,
    anchor,
  };
  if (intent.snapping === undefined) return freeze(captured);
  const base = {
    anchorDistance: snapping.anchorDistance ?? 0,
    anchors: [...(snapping.anchors ?? anchors)],
  };
  return freeze({
    ...captured,
    snapping: snapping.grid === undefined ? base : { ...base, grid: snapping.grid },
  });
}
/** Parent-owned ephemeral state; never added to a portable graph or editor history. */
export function createPlacement(scope: string): ZlozPlacement {
  if (!isText(scope)) invalid('Placement scope must be non-blank.');
  return Object.freeze({ type: 'idle', scope, generation: 0 });
}
/** Facts are scoped to a controller generation. Cancel/restart invalidates queued source callbacks. */
export function updatePlacement(
  state: ZlozPlacement,
  context: ZlozPlacementContext,
  event: ZlozPlacementEvent,
): ZlozPlacement {
  if (
    event.scope !== state.scope ||
    context.scope !== state.scope ||
    event.generation !== state.generation
  )
    return state;
  if (event.type === 'PlacementStarted')
    return freeze({
      type: 'placing',
      scope: state.scope,
      generation: next(state.generation),
      revision: context.editor.revision,
      intent: captureIntent(event.intent),
      targetRevision: 0,
      sample: null,
    });
  if (state.type !== 'placing') return state;
  if (event.type === 'PlacementCancelled')
    return Object.freeze({ type: 'idle', scope: state.scope, generation: next(state.generation) });
  const target = event.target;
  if (!isTarget(target)) invalid('Invalid placement target.');
  const targetPoint = point(target.point);
  return freeze({
    ...state,
    targetRevision: next(state.targetRevision),
    sample: {
      target: {
        space: target.space,
        point: targetPoint,
        parentId: target.parentId ?? null,
        constrainToParent: target.constrainToParent ?? true,
        snapBypassed: target.snapBypassed ?? false,
      },
      viewport: { ...point(context.editor.viewport), zoom: context.editor.viewport.zoom },
      surface: context.editor.surface
        ? { width: context.editor.surface.width, height: context.editor.surface.height }
        : null,
      origin: context.origin ? point(context.origin) : null,
      grid: state.intent.snapping?.grid ?? context.editor.snapToGrid,
      gridSpacing: context.editor.gridSpacing,
      presentationKey: presentationKey(context.editor),
    },
  });
}
function presentationKey(editor: EditorState): string {
  return JSON.stringify([
    [...editor.collapsedGroups].sort(),
    [...(editor.visibility?.hiddenNodeIds ?? [])].sort(),
  ]);
}
function samePoint(a: Point, b: Point) {
  return a.x === b.x && a.y === b.y;
}
function snapPoint(
  state: Extract<ZlozPlacement, { type: 'placing' }>,
  editor: EditorState,
  raw: Point,
  bypassed: boolean,
): ZlozPlacementSnap {
  const config = state.intent.snapping;
  const distance = bypassed ? 0 : (config?.anchorDistance ?? 0);
  let best:
    | { nodeId: string; kind: ZlozPlacementAnchor; position: Point; distance: number }
    | undefined;
  if (distance > 0)
    for (const node of presentVisibleGraph(editor).nodes)
      for (const kind of config?.anchors ?? anchors) {
        const position = {
          x:
            node.position.x +
            (kind === 'center'
              ? node.size.width / 2
              : kind.endsWith('right')
                ? node.size.width
                : 0),
          y:
            node.position.y +
            (kind === 'center'
              ? node.size.height / 2
              : kind.startsWith('bottom')
                ? node.size.height
                : 0),
        };
        const measured = Math.hypot(position.x - raw.x, position.y - raw.y) * editor.viewport.zoom;
        if (
          measured <= distance &&
          (!best ||
            measured < best.distance ||
            (measured === best.distance &&
              (node.id < best.nodeId || (node.id === best.nodeId && kind < best.kind))))
        )
          best = { nodeId: node.id, kind, position, distance: measured };
      }
  if (best)
    return {
      type: 'anchor',
      raw,
      position: best.position,
      anchor: { nodeId: best.nodeId, kind: best.kind },
    };
  if (!bypassed && (config?.grid ?? editor.snapToGrid))
    return {
      type: 'grid',
      raw,
      position: {
        x: Math.round(raw.x / editor.gridSpacing) * editor.gridSpacing,
        y: Math.round(raw.y / editor.gridSpacing) * editor.gridSpacing,
      },
    };
  return { type: 'none', raw, position: { ...raw } };
}
/** Internal projection freshness, independent of destination validity or host policy. */
export function placementTargetFreshnessReason(
  state: Extract<ZlozPlacement, { type: 'placing' }>,
  context: ZlozPlacementContext,
): string | null {
  const editor = context.editor;
  if (state.revision !== editor.revision) return 'The graph changed; start placement again.';
  const unavailable = patternInsertionReason(editor);
  if (unavailable !== null) return unavailable;
  const sample = state.sample;
  if (!sample) return 'Choose a placement target first.';
  const { target, viewport, surface, origin } = sample;
  if (
    sample.grid !== (state.intent.snapping?.grid ?? editor.snapToGrid) ||
    (sample.grid && sample.gridSpacing !== editor.gridSpacing)
  )
    return 'Snapping changed; choose the placement target again.';
  if (target.space !== 'world') {
    if (
      !surface ||
      !editor.surface ||
      !samePoint(viewport, editor.viewport) ||
      viewport.zoom !== editor.viewport.zoom ||
      surface.width !== editor.surface.width ||
      surface.height !== editor.surface.height
    )
      return 'The canvas changed or is unmeasured; choose the target again.';
    if (
      target.space === 'client' &&
      (!origin || !context.origin || !samePoint(origin, context.origin))
    )
      return 'The canvas moved or its origin is unmeasured; choose the target again.';
  } else if (usesAnchors(state.intent) && viewport.zoom !== editor.viewport.zoom)
    return 'Zoom changed; choose the snapping target again.';
  if (usesAnchors(state.intent) && sample.presentationKey !== presentationKey(editor))
    return 'Visible anchors changed; choose the target again.';
  return null;
}
function preparePlacement(
  state: ZlozPlacement,
  context: ZlozPlacementContext,
  policy: ZlozPlacementPolicy,
) {
  const blocked = (reason: string) => ({
    type: 'blocked' as const,
    reason: reason.trim() || 'Placement is protected.',
  });
  const editor = context.editor;
  if (state.scope !== context.scope)
    return blocked('The placement belongs to another editor session.');
  if (state.type === 'idle') return { type: 'idle' as const };
  if (state.revision !== editor.revision)
    return blocked('The graph changed; start placement again.');
  const unavailable = patternInsertionReason(editor);
  if (unavailable !== null) return blocked(unavailable);
  const sample = state.sample;
  if (!sample) return { type: 'pending' as const };
  const { target, surface, origin } = sample;
  const freshness = placementTargetFreshnessReason(state, context);
  if (freshness !== null) return blocked(freshness);
  const local =
    target.space === 'client' && origin
      ? { x: target.point.x - origin.x, y: target.point.y - origin.y }
      : { ...target.point };
  if (
    target.space !== 'world' &&
    surface &&
    (local.x < 0 || local.y < 0 || local.x > surface.width || local.y > surface.height)
  )
    return blocked('The pointer is outside the canvas.');
  const raw = target.space === 'world' ? local : screenToWorld(local, editor.viewport);
  const snap = snapPoint(state, editor, raw, target.snapBypassed ?? false);
  const offset = {
    x: snap.position.x - state.intent.anchor.x,
    y: snap.position.y - state.intent.anchor.y,
  };
  finitePoint(offset);
  const parent = target.parentId
    ? (editor.graph.nodes.find((node) => node.id === target.parentId) ?? null)
    : null;
  if (
    target.parentId &&
    (!parent ||
      parent.kind !== 'group' ||
      editor.collapsedGroups.includes(parent.id) ||
      !presentVisibleGraph(editor).nodes.some((node) => node.id === parent.id))
  )
    return blocked('Choose a visible, expanded group as the placement parent.');
  if (
    parent &&
    target.constrainToParent !== false &&
    state.intent.fragment.nodes.some(
      (node) =>
        node.position.x + offset.x < parent.position.x ||
        node.position.y + offset.y < parent.position.y ||
        node.position.x + offset.x + node.size.width > parent.position.x + parent.size.width ||
        node.position.y + offset.y + node.size.height > parent.position.y + parent.size.height,
    )
  )
    return blocked('The complete fragment must fit inside the chosen group.');
  const source = state.intent.source;
  const options = {
    offset,
    policy: {
      ...policy,
      canInsertPattern: (fragment: ZlozGraph, current: ZlozGraph) => {
        const graph = {
          nodes: [...current.nodes, ...fragment.nodes],
          edges: [...current.edges, ...fragment.edges],
        };
        return (
          policy.canPlace?.(
            { source, position: snap.position, offset, snap, parent, fragment, graph },
            current,
          ) ??
          policy.canInsertPattern?.(fragment, current) ??
          null
        );
      },
    },
  };
  const prepared = preparePatternInsertion(
    editor,
    state.intent.fragment,
    options,
    parent ? { id: parent.id, constrain: target.constrainToParent !== false } : undefined,
  );
  if (prepared.type !== 'ready')
    return blocked(
      prepared.type === 'blocked' ? prepared.reason : 'The placement source is empty.',
    );
  return {
    type: 'ready' as const,
    prepared,
    source,
    position: snap.position,
    offset,
    snap,
    parent,
    request: {
      scope: state.scope,
      generation: state.generation,
      targetRevision: state.targetRevision,
    },
  };
}
/** Read-only projection, detached from both the source template and current editor. */
export function resolvePlacement(
  state: ZlozPlacement,
  context: ZlozPlacementContext,
  policy: ZlozPlacementPolicy = {},
): ZlozPlacementPreview {
  const result = preparePlacement(state, context, policy);
  if (result.type !== 'ready') return result;
  const graph = copyGraph(result.prepared.graph);
  const nodeIds = new Set(result.prepared.nodeIds.values());
  const edgeIds = new Set(result.prepared.edgeIds.values());
  return {
    type: 'ready',
    request: result.request,
    source: result.source,
    position: result.position,
    offset: result.offset,
    snap: result.snap,
    parent: result.parent
      ? (graph.nodes.find((node) => node.id === result.parent?.id) ?? null)
      : null,
    graph,
    fragment: {
      nodes: graph.nodes.filter((node) => nodeIds.has(node.id)),
      edges: graph.edges.filter((edge) => edgeIds.has(edge.id)),
    },
    nodeIds: new Map(result.prepared.nodeIds),
    edgeIds: new Map(result.prepared.edgeIds),
  };
}
/** Rebuild against live context/policy; publish returned editor and placement together in the host Model. */
export function applyPlacement(
  state: ZlozPlacement,
  context: ZlozPlacementContext,
  request: ZlozPlacementRequest,
  policy: ZlozPlacementPolicy = {},
): ZlozPlacementResult {
  const blocked = (reason: string): ZlozPlacementResult => ({
    type: 'blocked',
    reason,
    editor: context.editor,
    placement: state,
  });
  if (
    state.type !== 'placing' ||
    request.scope !== state.scope ||
    request.generation !== state.generation ||
    request.targetRevision !== state.targetRevision
  )
    return blocked('The placement changed or ended; review the target again.');
  const result = preparePlacement(state, context, policy);
  if (result.type !== 'ready')
    return blocked(result.type === 'blocked' ? result.reason : 'Choose a placement target first.');
  return {
    type: 'placed',
    editor: {
      ...commitGraph(context.editor, result.prepared.graph),
      selectedNodes: result.prepared.selectedNodes,
      selectedEdges: [],
      notice: `${result.prepared.fragment.nodes.length} nodes placed`,
    },
    placement: Object.freeze({
      type: 'idle',
      scope: state.scope,
      generation: next(state.generation),
    }),
    source: result.source,
    snap: result.snap,
    nodeIds: result.prepared.nodeIds,
    edgeIds: result.prepared.edgeIds,
  };
}
