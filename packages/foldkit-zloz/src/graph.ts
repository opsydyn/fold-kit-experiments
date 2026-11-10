import { validNodeArchitectureFields, isEdgeArchitecture } from './architecture';
import type {
  Endpoint,
  ZlozEdge,
  ZlozGraph,
  ZlozNode,
  ZlozSnapshot,
  NodeResizeLimits,
  JsonValue,
  Point,
  Port,
  PortPosition,
  Size,
  Viewport,
} from './types';

export class ZlozError extends Error {
  override readonly name = 'ZlozError';
  constructor(
    readonly code: 'invalid-graph' | 'invalid-edit' | 'invalid-layout',
    message: string,
  ) {
    super(message);
  }
}
function isPoint(value: unknown): value is Point {
  return (
    typeof value === 'object' &&
    value !== null &&
    'x' in value &&
    'y' in value &&
    typeof value.x === 'number' &&
    Number.isFinite(value.x) &&
    typeof value.y === 'number' &&
    Number.isFinite(value.y)
  );
}
function isSize(value: unknown): value is Size {
  return (
    typeof value === 'object' &&
    value !== null &&
    'width' in value &&
    'height' in value &&
    typeof value.width === 'number' &&
    Number.isFinite(value.width) &&
    value.width > 0 &&
    typeof value.height === 'number' &&
    Number.isFinite(value.height) &&
    value.height > 0
  );
}
function isJson(value: unknown, ancestors: ReadonlySet<object> = new Set()): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || ancestors.has(value)) return false;
  const next = new Set(ancestors).add(value);
  if (Array.isArray(value)) return value.every((item) => isJson(item, next));
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
    return false;
  return Object.values(value).every((item) => isJson(item, next));
}
function isPort(value: unknown): value is Port {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    'kind' in value &&
    (value.kind === 'input' || value.kind === 'output') &&
    'side' in value &&
    (value.side === 'left' ||
      value.side === 'right' ||
      value.side === 'top' ||
      value.side === 'bottom') &&
    (('anchor' in value &&
      !('offset' in value) &&
      isPoint(value.anchor) &&
      value.anchor.x >= 0 &&
      value.anchor.x <= 1 &&
      value.anchor.y >= 0 &&
      value.anchor.y <= 1) ||
      (!('anchor' in value) &&
        'offset' in value &&
        typeof value.offset === 'number' &&
        Number.isFinite(value.offset) &&
        value.offset >= 0 &&
        value.offset <= 1)) &&
    (!('label' in value) || typeof value.label === 'string')
  );
}
/** Internal edit boundary: validate positioning while preserving identity and detaching anchor values. */
export function withPortPosition(port: Port, position: PortPosition): Port {
  if (!isPort({ ...position, id: port.id, kind: port.kind }))
    throw new ZlozError('invalid-edit', 'Invalid port position');
  const { side: _side, anchor: _anchor, offset: _offset, ...identity } = port;
  return position.anchor
    ? { ...identity, side: position.side, anchor: { x: position.anchor.x, y: position.anchor.y } }
    : { ...identity, side: position.side, offset: position.offset };
}

function isEndpoint(value: unknown): value is Endpoint {
  return (
    typeof value === 'object' &&
    value !== null &&
    'node' in value &&
    typeof value.node === 'string' &&
    'port' in value &&
    typeof value.port === 'string'
  );
}
function isResizeLimits(value: unknown): value is NodeResizeLimits {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const dimension = (limit: unknown): limit is number =>
    typeof limit === 'number' && Number.isFinite(limit) && limit > 0;
  if (
    ('minWidth' in value && !dimension(value.minWidth)) ||
    ('maxWidth' in value && !dimension(value.maxWidth)) ||
    ('minHeight' in value && !dimension(value.minHeight)) ||
    ('maxHeight' in value && !dimension(value.maxHeight))
  )
    return false;
  return (
    (!('minWidth' in value) ||
      !('maxWidth' in value) ||
      Number(value.minWidth) <= Number(value.maxWidth)) &&
    (!('minHeight' in value) ||
      !('maxHeight' in value) ||
      Number(value.minHeight) <= Number(value.maxHeight))
  );
}
function isNode(value: unknown): value is ZlozNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    'label' in value &&
    typeof value.label === 'string' &&
    'position' in value &&
    isPoint(value.position) &&
    'size' in value &&
    isSize(value.size) &&
    'ports' in value &&
    Array.isArray(value.ports) &&
    value.ports.every(isPort) &&
    (!('kind' in value) || value.kind === 'group') &&
    (!('resizeLimits' in value) || isResizeLimits(value.resizeLimits)) &&
    (!('keepAspectRatio' in value) ||
      ('kind' in value && value.kind === 'group' && typeof value.keepAspectRatio === 'boolean')) &&
    (!('parentId' in value) || typeof value.parentId === 'string') &&
    (!('extent' in value) || value.extent === 'parent') &&
    (!('expandParent' in value) || typeof value.expandParent === 'boolean') &&
    (!('data' in value) || isJson(value.data)) &&
    validNodeArchitectureFields(value)
  );
}
function isEdge(value: unknown): value is ZlozEdge {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    'source' in value &&
    isEndpoint(value.source) &&
    'target' in value &&
    isEndpoint(value.target) &&
    (!('pathStyle' in value) ||
      value.pathStyle === 'straight' ||
      value.pathStyle === 'stepped' ||
      value.pathStyle === 'smooth') &&
    (!('label' in value) || typeof value.label === 'string') &&
    (!('data' in value) || isJson(value.data)) &&
    (!('architecture' in value) || isEdgeArchitecture(value.architecture))
  );
}
function isGraph(value: unknown): value is ZlozGraph {
  return (
    typeof value === 'object' &&
    value !== null &&
    'nodes' in value &&
    Array.isArray(value.nodes) &&
    value.nodes.every(isNode) &&
    'edges' in value &&
    Array.isArray(value.edges) &&
    value.edges.every(isEdge)
  );
}
function unique(ids: readonly string[], kind: string): void {
  if (new Set(ids).size !== ids.length)
    throw new ZlozError('invalid-graph', `Duplicate ${kind} ID`);
}
/** Identity, finite dimensions, JSON payloads and directed ports. Cycles are allowed. */
export function validateGraph(graph: ZlozGraph): void {
  if (!isGraph(graph))
    throw new ZlozError(
      'invalid-graph',
      'Invalid graph: finite positions, positive sizes, valid ports and JSON data are required',
    );
  unique(
    graph.nodes.map((node) => node.id),
    'node',
  );
  unique(
    graph.edges.map((edge) => edge.id),
    'edge',
  );
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  for (const node of graph.nodes)
    unique(
      node.ports.map((port) => port.id),
      `port on ${node.id}`,
    );
  for (const node of graph.nodes) {
    if (node.kind === 'group' && node.ports.length > 0)
      throw new ZlozError('invalid-graph', `Group ${node.id} cannot have ports`);
    if ((node.extent === 'parent' || node.expandParent) && node.parentId === undefined)
      throw new ZlozError(
        'invalid-graph',
        `Node ${node.id} requires a parent for its extent or expansion`,
      );
    const visited = new Set([node.id]);
    let parentId = node.parentId;
    while (parentId !== undefined) {
      const parent = nodes.get(parentId);
      if (parent?.kind !== 'group')
        throw new ZlozError('invalid-graph', `Node ${node.id} requires a group parent`);
      if (visited.has(parentId)) throw new ZlozError('invalid-graph', `Group cycle at ${parentId}`);
      visited.add(parentId);
      parentId = parent.parentId;
    }
  }
  for (const edge of graph.edges) {
    const source = nodes.get(edge.source.node)?.ports.find((port) => port.id === edge.source.port);
    const target = nodes.get(edge.target.node)?.ports.find((port) => port.id === edge.target.port);
    if (source?.kind !== 'output' || target?.kind !== 'input')
      throw new ZlozError(
        'invalid-graph',
        `Edge ${edge.id} requires an existing output and input port`,
      );
  }
}
/** Versioned document only: excludes session state and browser resources. */
export function serializeGraph(graph: ZlozGraph): string {
  validateGraph(graph);
  return JSON.stringify({ version: 1, graph });
}
function isDocument(value: unknown): value is { version: 1; graph?: unknown } {
  return typeof value === 'object' && value !== null && 'version' in value && value.version === 1;
}
function parseDocument(text: string): { graph: ZlozGraph; viewport?: unknown } {
  const value: unknown = JSON.parse(text);
  if (!isDocument(value))
    throw new ZlozError('invalid-graph', 'Unsupported graph document version');
  if (!isGraph(value.graph)) throw new ZlozError('invalid-graph', 'Invalid graph document');
  validateGraph(value.graph);
  return 'viewport' in value
    ? { graph: value.graph, viewport: value.viewport }
    : { graph: value.graph };
}

/** SyntaxError and ZlozError are deliberately caller-visible. */
export function parseGraph(text: string): ZlozGraph {
  return parseDocument(text).graph;
}

function assertDocumentViewport(value: unknown): asserts value is Viewport {
  if (
    !isPoint(value) ||
    !('zoom' in value) ||
    typeof value.zoom !== 'number' ||
    !Number.isFinite(value.zoom) ||
    value.zoom <= 0
  )
    throw new ZlozError(
      'invalid-graph',
      'Snapshot viewport requires finite coordinates and positive zoom',
    );
}

function viewportFields({ x, y, zoom }: Viewport): Viewport {
  return { x, y, zoom };
}

/** Save the graph and an optional camera. Other editor state is excluded. */
export function serializeSnapshot({ graph, viewport }: ZlozSnapshot): string {
  if (viewport === undefined) return serializeGraph(graph);
  validateGraph(graph);
  assertDocumentViewport(viewport);
  return JSON.stringify({ version: 1, graph, viewport: viewportFields(viewport) });
}

/** Read a graph-only v1 document or a v1 document with a validated camera. */
export function parseSnapshot(text: string): ZlozSnapshot {
  const document = parseDocument(text);
  if (!('viewport' in document)) return { graph: document.graph };
  assertDocumentViewport(document.viewport);
  return { graph: document.graph, viewport: viewportFields(document.viewport) };
}

export function copyGraph(graph: ZlozGraph): ZlozGraph {
  return parseGraph(serializeGraph(graph));
}
