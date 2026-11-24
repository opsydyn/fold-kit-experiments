import { ZlozError, isNode, isNodeIcon, isEdge, isGraph } from './graph';
import type { ZlozGraphOperation, ZlozNodeFrame, ZlozOperationRequest } from './operation-types';
import type { JsonValue, Point } from './types';

export const operationRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
export const operationVersion = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 0;
export const operationEntityId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
export const operationId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 256;
export const operationKeys = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const point = (value: unknown): value is Point =>
  operationRecord(value) &&
  operationKeys(value, ['x', 'y']) &&
  typeof value.x === 'number' &&
  Number.isFinite(value.x) &&
  typeof value.y === 'number' &&
  Number.isFinite(value.y);
export const operationFrame = (value: unknown): value is ZlozNodeFrame =>
  operationRecord(value) &&
  operationKeys(value, ['position', 'size']) &&
  point(value.position) &&
  operationRecord(value.size) &&
  operationKeys(value.size, ['width', 'height']) &&
  typeof value.size.width === 'number' &&
  Number.isFinite(value.size.width) &&
  value.size.width > 0 &&
  typeof value.size.height === 'number' &&
  Number.isFinite(value.size.height) &&
  value.size.height > 0;
const ids = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every(operationEntityId) && new Set(value).size === value.length;
// Raw array entries are parsed by the command-specific predicate at this boundary.
// oxlint-disable-next-line anti-slop/no-unknown-parameters
const entries = (value: unknown, predicate: (entry: Record<string, unknown>) => boolean) =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.length <= 250 &&
  value.every((entry) => operationRecord(entry) && predicate(entry)) &&
  new Set(value.map((entry) => entry.id)).size === value.length;

/** Shape validation precedes graph validation against the current document. */
export function isGraphOperation(value: unknown): value is ZlozGraphOperation {
  if (!operationRecord(value)) return false;
  switch (value.type) {
    case 'MoveNodes':
      return (
        operationKeys(value, ['type', 'nodes']) &&
        entries(
          value.nodes,
          (entry) =>
            operationKeys(entry, ['id', 'expected', 'position']) &&
            operationEntityId(entry.id) &&
            operationVersion(entry.expected) &&
            point(entry.position),
        )
      );
    case 'ResizeNodes':
      return (
        operationKeys(value, ['type', 'nodes']) &&
        entries(
          value.nodes,
          (entry) =>
            operationKeys(entry, ['id', 'expected', 'frame']) &&
            operationEntityId(entry.id) &&
            operationVersion(entry.expected) &&
            operationFrame(entry.frame),
        )
      );
    case 'RenameNode':
      return (
        operationKeys(value, ['type', 'id', 'expected', 'label']) &&
        operationEntityId(value.id) &&
        operationVersion(value.expected) &&
        typeof value.label === 'string'
      );
    case 'SetNodeIcon':
      return (
        operationKeys(value, ['type', 'id', 'expected', 'icon']) &&
        operationEntityId(value.id) &&
        operationVersion(value.expected) &&
        (value.icon === null || isNodeIcon(value.icon))
      );
    case 'SetHotspotStatus':
      return (
        operationKeys(value, ['type', 'id', 'expected', 'status']) &&
        operationEntityId(value.id) &&
        operationVersion(value.expected) &&
        (value.status === 'open' || value.status === 'resolved')
      );
    case 'AddNode':
      return (
        operationKeys(value, ['type', 'expectedVersion', 'node']) &&
        operationVersion(value.expectedVersion) &&
        isNode(value.node) &&
        operationEntityId(value.node.id)
      );
    case 'ImportEmptyBoard':
      return (
        operationKeys(value, ['type', 'expectedVersion', 'graph']) &&
        operationVersion(value.expectedVersion) &&
        operationRecord(value.graph) &&
        operationKeys(value.graph, ['nodes', 'edges']) &&
        isGraph(value.graph) &&
        value.graph.nodes.length > 0 &&
        value.graph.nodes.length <= 250 &&
        value.graph.edges.length <= 500 &&
        value.graph.nodes.every(({ id }) => operationEntityId(id)) &&
        value.graph.edges.every(({ id }) => operationEntityId(id))
      );
    case 'Connect':
      return (
        operationKeys(value, ['type', 'expectedVersion', 'edge']) &&
        operationVersion(value.expectedVersion) &&
        isEdge(value.edge) &&
        operationEntityId(value.edge.id)
      );
    case 'Delete':
      return (
        operationKeys(value, ['type', 'expectedVersion', 'nodeIds', 'edgeIds']) &&
        operationVersion(value.expectedVersion) &&
        ids(value.nodeIds) &&
        ids(value.edgeIds) &&
        value.nodeIds.length + value.edgeIds.length > 0
      );
    case 'RemovePort':
      return (
        operationKeys(value, ['type', 'expectedVersion', 'endpoint']) &&
        operationVersion(value.expectedVersion) &&
        operationRecord(value.endpoint) &&
        operationKeys(value.endpoint, ['node', 'port']) &&
        operationEntityId(value.endpoint.node) &&
        operationEntityId(value.endpoint.port)
      );
    case 'Undo':
      return operationKeys(value, ['type', 'operationId']) && operationId(value.operationId);
    default:
      return false;
  }
}
export const isOperationRequest = (value: unknown): value is ZlozOperationRequest =>
  operationRecord(value) &&
  operationKeys(value, ['version', 'operationId', 'operation']) &&
  value.version === 1 &&
  operationId(value.operationId) &&
  isGraphOperation(value.operation);

export function parseOperationRequest(text: string): ZlozOperationRequest {
  if (text.length > 1_000_000)
    throw new ZlozError('invalid-edit', 'Operation exceeds the wire limit');
  const value: unknown = JSON.parse(text);
  if (!isOperationRequest(value))
    throw new ZlozError(
      'invalid-edit',
      'Invalid operation v1: a supported command and explicit preconditions are required',
    );
  return value;
}
export function serializeOperationRequest(request: ZlozOperationRequest): string {
  if (!isOperationRequest(request))
    throw new ZlozError('invalid-edit', 'Invalid operation request');
  const text = JSON.stringify(request);
  parseOperationRequest(text);
  return text;
}
/** Stable JSON binding: key order is irrelevant; array order and all values are significant. */
// This public JSON boundary recursively validates every value before producing a binding.
// oxlint-disable-next-line anti-slop/no-unknown-parameters
export function canonicalOperationValue(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalOperationValue).join(',')}]`;
  if (operationRecord(value))
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalOperationValue(value[key])}`)
      .join(',')}}`;
  throw new ZlozError('invalid-edit', 'Operation binding requires finite JSON values');
}
/** Deep detach at the operation boundary; no host callbacks or resources survive. */
export function copyOperationValue<T extends JsonValue | object>(value: T): T {
  canonicalOperationValue(value);
  return JSON.parse(JSON.stringify(value));
}
