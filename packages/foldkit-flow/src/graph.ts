import type {
  Endpoint,
  FlowEdge,
  FlowGraph,
  FlowNode,
  NodeResizeLimits,
  JsonValue,
  Point,
  Port,
  Size,
} from './types';

export class FlowError extends Error {
  override readonly name = 'FlowError';
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
    'offset' in value &&
    typeof value.offset === 'number' &&
    Number.isFinite(value.offset) &&
    value.offset >= 0 &&
    value.offset <= 1 &&
    (!('label' in value) || typeof value.label === 'string')
  );
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
function isNode(value: unknown): value is FlowNode {
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
    (!('parentId' in value) || typeof value.parentId === 'string') &&
    (!('extent' in value) || value.extent === 'parent') &&
    (!('expandParent' in value) || typeof value.expandParent === 'boolean') &&
    (!('data' in value) || isJson(value.data))
  );
}
function isEdge(value: unknown): value is FlowEdge {
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
    (!('data' in value) || isJson(value.data))
  );
}
function isGraph(value: unknown): value is FlowGraph {
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
    throw new FlowError('invalid-graph', `Duplicate ${kind} ID`);
}
/** Identity, finite dimensions, JSON payloads and directed ports. Cycles are allowed. */
export function validateGraph(graph: FlowGraph): void {
  if (!isGraph(graph))
    throw new FlowError(
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
      throw new FlowError('invalid-graph', `Group ${node.id} cannot have ports`);
    if ((node.extent === 'parent' || node.expandParent) && node.parentId === undefined)
      throw new FlowError(
        'invalid-graph',
        `Node ${node.id} requires a parent for its extent or expansion`,
      );
    const visited = new Set([node.id]);
    let parentId = node.parentId;
    while (parentId !== undefined) {
      const parent = nodes.get(parentId);
      if (parent?.kind !== 'group')
        throw new FlowError('invalid-graph', `Node ${node.id} requires a group parent`);
      if (visited.has(parentId)) throw new FlowError('invalid-graph', `Group cycle at ${parentId}`);
      visited.add(parentId);
      parentId = parent.parentId;
    }
  }
  for (const edge of graph.edges) {
    const source = nodes.get(edge.source.node)?.ports.find((port) => port.id === edge.source.port);
    const target = nodes.get(edge.target.node)?.ports.find((port) => port.id === edge.target.port);
    if (source?.kind !== 'output' || target?.kind !== 'input')
      throw new FlowError(
        'invalid-graph',
        `Edge ${edge.id} requires an existing output and input port`,
      );
  }
}
/** Versioned document only: excludes session state and browser resources. */
export function serializeGraph(graph: FlowGraph): string {
  validateGraph(graph);
  return JSON.stringify({ version: 1, graph });
}
function isDocument(value: unknown): value is { version: 1; graph?: unknown } {
  return typeof value === 'object' && value !== null && 'version' in value && value.version === 1;
}
/** SyntaxError and FlowError are deliberately caller-visible. */
export function parseGraph(text: string): FlowGraph {
  const value: unknown = JSON.parse(text);
  if (!isDocument(value))
    throw new FlowError('invalid-graph', 'Unsupported graph document version');
  if (!('graph' in value) || !isGraph(value.graph))
    throw new FlowError('invalid-graph', 'Invalid graph document');
  validateGraph(value.graph);
  return value.graph;
}
export function copyGraph(graph: FlowGraph): FlowGraph {
  return parseGraph(serializeGraph(graph));
}
