import { connectionReason } from './connection-validation';
import { resolveDeletion } from './deletion';
import { copyGraph, validateGraph, isGraph, isNode, isNodeIcon, isEdge, ZlozError } from './graph';
import { withDescendants } from './group-presentation';
import {
  isOperationRequest,
  canonicalOperationValue,
  copyOperationValue,
  operationEntityId,
  operationFrame,
  operationId,
  operationKeys,
  operationRecord,
  operationVersion,
} from './operation-codec';
import type {
  ZlozEdgeChange,
  ZlozNodeChange,
  ZlozNodeClock,
  ZlozNodeFrame,
  ZlozOperationChange,
  ZlozOperationDecision,
  ZlozOperationDocument,
  ZlozOperationPatch,
  ZlozOperationPolicy,
  ZlozOperationReceipt,
  ZlozOperationRejection,
  ZlozOperationRequest,
  ZlozOperationScope,
} from './operation-types';
import { resolvePortRemoval } from './port-removal';
import type { Port, ZlozEdge, ZlozGraph, ZlozNode } from './types';

type OperationComparable =
  | null
  | string
  | ZlozGraph
  | ZlozNode
  | ZlozEdge
  | ZlozNodeFrame
  | ZlozNodeFrame['position']
  | ZlozNodeFrame['size']
  | readonly Port[];
const equal = (a: OperationComparable, b: OperationComparable) =>
  canonicalOperationValue(a) === canonicalOperationValue(b);
// A translation reconstructed from absolute coordinates may differ by a few
// floating-point units. Preserve submitted coordinates; tolerate only roundoff.
const sameCoordinate = (actual: number, expected: number) =>
  Number.isFinite(actual) &&
  Number.isFinite(expected) &&
  Math.abs(actual - expected) <=
    Number.EPSILON * 4 * Math.max(1, Math.abs(actual), Math.abs(expected));
const frame = (node: ZlozNode): ZlozNodeFrame => ({ position: node.position, size: node.size });
class OperationFault extends ZlozError {
  constructor(
    readonly rejection: ZlozOperationRejection,
    message: string,
  ) {
    super('invalid-edit', message);
  }
}
function failure(message: string, code: ZlozOperationRejection = 'Conflict'): never {
  throw new OperationFault(code, message);
}
const clockFor = (document: ZlozOperationDocument, id: string) =>
  document.nodes.find((clock) => clock.id === id);
const edgeClockFor = (document: ZlozOperationDocument, id: string) =>
  document.edges.find((clock) => clock.id === id);
const nodeFor = (document: ZlozOperationDocument, id: string) =>
  document.graph.nodes.find((node) => node.id === id) ??
  failure(`Node ${id} is no longer present`, 'Missing');
const nodeClock = (id: string, version: number, present = true): ZlozNodeClock => ({
  id,
  present,
  version,
  geometry: version,
  label: version,
  ports: version,
});

/** A detached initial document. Its clocks are unrelated to local revision or a Domain cursor. */
export function createOperationDocument(graph: ZlozGraph): ZlozOperationDocument {
  const checked = copyGraph(graph);
  return {
    version: 0,
    graph: checked,
    nodes: checked.nodes.map(({ id }) => nodeClock(id, 0)),
    edges: checked.edges.map(({ id }) => ({ id, present: true, version: 0 })),
    undo: [],
  };
}

function inverseNode(patch: ZlozNodeChange, version: number): ZlozNodeChange {
  switch (patch.type) {
    case 'geometry':
      return { ...patch, before: patch.after, after: patch.before, expected: version };
    case 'label':
      return { ...patch, before: patch.after, after: patch.before, expected: version };
    case 'icon':
      return { ...patch, before: patch.after, after: patch.before, expected: version };
    case 'ports':
      return { ...patch, before: patch.after, after: patch.before, expected: version };
    case 'record':
      return { ...patch, before: patch.after, after: patch.before, expected: version };
  }
}
function inverseOf(change: ZlozOperationChange): ZlozOperationPatch {
  return {
    nodes: change.nodes.map((patch) => inverseNode(patch, change.version)),
    edges: change.edges.map((patch) => ({
      ...patch,
      before: patch.after,
      after: patch.before,
      expected: change.version,
    })),
  };
}
function checkedNodePatch(document: ZlozOperationDocument, patch: ZlozNodeChange) {
  const node = document.graph.nodes.find((item) => item.id === patch.id);
  const clock = clockFor(document, patch.id);
  if (patch.type === 'record') {
    if (patch.before === null) {
      if (
        node ||
        (patch.expected === null
          ? clock !== undefined
          : !clock || clock.present || clock.version !== patch.expected)
      )
        failure('Node identity is occupied or its tombstone changed');
    } else if (
      !node ||
      !clock?.present ||
      clock.version !== patch.expected ||
      !equal(node, patch.before)
    )
      failure('Node changed before this operation');
    if (
      (patch.before === null) === (patch.after === null) ||
      (patch.after && patch.after.id !== patch.id)
    )
      failure('Invalid node record change');
    return;
  }
  if (!node || !clock?.present || (clock[patch.type] ?? 0) !== patch.expected)
    failure('Node field changed before this operation');
  const before =
    patch.type === 'geometry'
      ? frame(node)
      : patch.type === 'icon'
        ? (node.icon ?? null)
        : node[patch.type];
  if (!equal(before, patch.before)) failure('Node field does not match the accepted change');
}
function checkedEdgePatch(document: ZlozOperationDocument, patch: ZlozEdgeChange) {
  const edge = document.graph.edges.find((item) => item.id === patch.id);
  const clock = edgeClockFor(document, patch.id);
  if (patch.before === null) {
    if (
      edge ||
      (patch.expected === null
        ? clock !== undefined
        : !clock || clock.present || clock.version !== patch.expected)
    )
      failure('Edge identity is occupied or its tombstone changed');
  } else if (
    !edge ||
    !clock?.present ||
    clock.version !== patch.expected ||
    !equal(edge, patch.before)
  )
    failure('Edge changed before this operation');
  if (
    (patch.before === null) === (patch.after === null) ||
    (patch.after && patch.after.id !== patch.id)
  )
    failure('Invalid edge record change');
}
type ReplayOwnership = 'detached' | 'shared';
function applyPatch(
  document: ZlozOperationDocument,
  patch: ZlozOperationPatch,
  ownership: ReplayOwnership,
): ZlozGraph {
  if (
    new Set(patch.nodes.map(({ id }) => id)).size !== patch.nodes.length ||
    new Set(patch.edges.map(({ id }) => id)).size !== patch.edges.length
  )
    failure('A change repeats an identity');
  for (const item of patch.nodes) checkedNodePatch(document, item);
  for (const item of patch.edges) checkedEdgePatch(document, item);
  const byNode = new Map(patch.nodes.map((item) => [item.id, item]));
  const nodes = document.graph.nodes.flatMap((node) => {
    const item = byNode.get(node.id);
    if (!item) return [node];
    if (item.type === 'record') return [];
    if (item.type === 'geometry') {
      const after = ownership === 'shared' ? copyOperationValue(item.after) : item.after;
      return [{ ...node, position: after.position, size: after.size }];
    }
    if (item.type === 'label') return [{ ...node, label: item.after }];
    if (item.type === 'icon') {
      const { icon: previousIcon, ...bare } = node;
      return [item.after === null ? bare : { ...bare, icon: item.after }];
    }
    return [
      { ...node, ports: ownership === 'shared' ? copyOperationValue(item.after) : item.after },
    ];
  });
  for (const item of patch.nodes
    .filter((item) => item.type === 'record')
    .sort((a, b) => a.index - b.index))
    if (item.type === 'record' && item.after)
      nodes.splice(
        Math.min(item.index, nodes.length),
        0,
        ownership === 'shared' ? copyOperationValue(item.after) : item.after,
      );
  const changedEdges = new Set(patch.edges.map(({ id }) => id));
  const edges = document.graph.edges.filter(({ id }) => !changedEdges.has(id));
  for (const item of [...patch.edges].sort((a, b) => a.index - b.index))
    if (item.after)
      edges.splice(
        Math.min(item.index, edges.length),
        0,
        ownership === 'shared' ? copyOperationValue(item.after) : item.after,
      );
  const graph = { ...document.graph, nodes, edges };
  if (ownership === 'detached') return copyGraph(graph);
  // No graph invariant is skipped: immutable replay avoids serialization, not validation.
  validateGraph(graph);
  return graph;
}

/** Replay an accepted fact at exactly its predecessor version; no policy callbacks run during replay. */
export function applyOperationChange(
  document: ZlozOperationDocument,
  change: ZlozOperationChange,
): ZlozOperationDocument {
  return replayOperationChange(document, change, 'detached');
}

/**
 * Replay onto an already validated immutable JSON document, retaining untouched graph references.
 * The complete candidate graph is validated and incoming changed values are detached.
 * Use the detached variant when a host policy or caller may mutate retained input objects.
 */
export function applyOperationChangeShared(
  document: ZlozOperationDocument,
  change: ZlozOperationChange,
): ZlozOperationDocument {
  return replayOperationChange(document, change, 'shared');
}
function replayOperationChange(
  document: ZlozOperationDocument,
  change: ZlozOperationChange,
  ownership: ReplayOwnership,
): ZlozOperationDocument {
  if (!isOperationChange(change)) failure('Invalid accepted change');
  if (
    change.fromVersion !== document.version ||
    change.version !== document.version + 1 ||
    !Number.isSafeInteger(change.version)
  )
    failure('Change does not follow the current document version');
  const graph = applyPatch(document, change, ownership);
  const nodeClocks = new Map(document.nodes.map((clock) => [clock.id, clock]));
  for (const patch of change.nodes) {
    const current = nodeClocks.get(patch.id);
    if (patch.type === 'record') {
      const next = nodeClock(patch.id, change.version, patch.after !== null);
      nodeClocks.set(
        patch.id,
        current?.icon === undefined ? next : { ...next, icon: change.version },
      );
      continue;
    }
    nodeClocks.set(patch.id, {
      ...(current ?? nodeClock(patch.id, 0)),
      version: change.version,
      [patch.type]: change.version,
    });
  }
  const edgeClocks = new Map(document.edges.map((clock) => [clock.id, clock]));
  for (const patch of change.edges)
    edgeClocks.set(patch.id, {
      id: patch.id,
      present: patch.after !== null,
      version: change.version,
    });
  const undo = document.undo.filter(
    (entry) => !(entry.actorId === change.actorId && entry.operationId === change.undoOf),
  );
  return {
    version: change.version,
    graph,
    nodes: [...nodeClocks.values()],
    edges: [...edgeClocks.values()],
    undo: [
      ...undo,
      copyOperationValue({
        actorId: change.actorId,
        operationId: change.operationId,
        inverse: inverseOf(change),
      }),
    ].slice(-100),
  };
}

function removedPatch(
  document: ZlozOperationDocument,
  nodes: readonly ZlozNode[],
  edges: ZlozGraph['edges'],
): ZlozOperationPatch {
  return {
    nodes: nodes.map((node) => ({
      type: 'record',
      id: node.id,
      expected: clockFor(document, node.id)?.version ?? 0,
      before: node,
      after: null,
      index: document.graph.nodes.findIndex(({ id }) => id === node.id),
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      expected: edgeClockFor(document, edge.id)?.version ?? 0,
      before: edge,
      after: null,
      index: document.graph.edges.findIndex(({ id }) => id === edge.id),
    })),
  };
}

function proposedPatch(
  document: ZlozOperationDocument,
  request: ZlozOperationRequest,
  scope: ZlozOperationScope,
): ZlozOperationPatch {
  const operation = request.operation;
  if ('expectedVersion' in operation && operation.expectedVersion !== document.version)
    failure('Structural operation observed a stale document version');
  switch (operation.type) {
    case 'MoveNodes': {
      const moving = new Map(operation.nodes.map((entry) => [entry.id, entry]));
      for (const entry of operation.nodes) {
        const node = nodeFor(document, entry.id);
        if (node.kind !== 'group') continue;
        const dx = entry.position.x - node.position.x;
        const dy = entry.position.y - node.position.y;
        for (const id of withDescendants(document.graph, [node.id])) {
          const child = nodeFor(document, id);
          const proposed = moving.get(id);
          if (
            !proposed ||
            !sameCoordinate(proposed.position.x, child.position.x + dx) ||
            !sameCoordinate(proposed.position.y, child.position.y + dy)
          )
            failure('Moving a group requires every descendant in one atomic move');
        }
      }
      return {
        nodes: operation.nodes.map((entry) => {
          const node = nodeFor(document, entry.id);
          return {
            type: 'geometry',
            id: entry.id,
            expected: entry.expected,
            before: frame(node),
            after: { position: entry.position, size: node.size },
          };
        }),
        edges: [],
      };
    }
    case 'ResizeNodes':
      return {
        nodes: operation.nodes.map((entry) => {
          const node = nodeFor(document, entry.id);
          if (node.kind === 'group')
            failure('Group resizing is not a supported shared operation', 'UnsupportedOperation');
          return {
            type: 'geometry',
            id: entry.id,
            expected: entry.expected,
            before: frame(node),
            after: entry.frame,
          };
        }),
        edges: [],
      };
    case 'RenameNode':
      return {
        nodes: [
          {
            type: 'label',
            id: operation.id,
            expected: operation.expected,
            before: nodeFor(document, operation.id).label,
            after: operation.label,
          },
        ],
        edges: [],
      };
    case 'SetNodeIcon':
      return {
        nodes: [
          {
            type: 'icon',
            id: operation.id,
            expected: operation.expected,
            before: nodeFor(document, operation.id).icon ?? null,
            after: operation.icon,
          },
        ],
        edges: [],
      };
    case 'AddNode': {
      if (clockFor(document, operation.node.id))
        failure('Node identity was already used', 'IdentityUsed');
      return {
        nodes: [
          {
            type: 'record',
            id: operation.node.id,
            expected: null,
            before: null,
            after: operation.node,
            index: document.graph.nodes.length,
          },
        ],
        edges: [],
      };
    }
    case 'ImportEmptyBoard': {
      if (document.graph.nodes.length || document.graph.edges.length)
        failure('Import requires an empty board');
      return {
        nodes: operation.graph.nodes.map((node, index) => ({
          type: 'record',
          id: node.id,
          expected: null,
          before: null,
          after: node,
          index,
        })),
        edges: operation.graph.edges.map((edge, index) => ({
          id: edge.id,
          expected: null,
          before: null,
          after: edge,
          index,
        })),
      };
    }
    case 'Connect': {
      if (edgeClockFor(document, operation.edge.id))
        failure('Edge identity was already used', 'IdentityUsed');
      return {
        nodes: [],
        edges: [
          {
            id: operation.edge.id,
            expected: null,
            before: null,
            after: operation.edge,
            index: document.graph.edges.length,
          },
        ],
      };
    }
    case 'Delete': {
      if (
        operation.nodeIds.some((id) => !document.graph.nodes.some((node) => node.id === id)) ||
        operation.edgeIds.some((id) => !document.graph.edges.some((edge) => edge.id === id))
      )
        failure('Deletion references a missing entity');
      const decision = resolveDeletion(document.graph, operation);
      return decision.type === 'allowed'
        ? removedPatch(document, decision.candidate.nodes, decision.candidate.edges)
        : { nodes: [], edges: [] };
    }
    case 'RemovePort': {
      const decision = resolvePortRemoval(document.graph, operation.endpoint);
      if (decision.type !== 'allowed') failure('Port is no longer present');
      const deleted = removedPatch(document, [], decision.edges);
      return {
        nodes: [
          {
            type: 'ports',
            id: decision.node.id,
            expected: clockFor(document, decision.node.id)?.ports ?? 0,
            before: decision.node.ports,
            after: decision.node.ports.filter((port) => port.id !== operation.endpoint.port),
          },
        ],
        edges: deleted.edges,
      };
    }
    case 'Undo': {
      const entry = document.undo.find(
        (item) => item.actorId === scope.actorId && item.operationId === operation.operationId,
      );
      if (!entry)
        failure(
          'Undo is unavailable for this actor or outside the retained window',
          'UndoUnavailable',
        );
      return entry.inverse;
    }
  }
}

function policyReason(
  before: ZlozGraph,
  after: ZlozGraph,
  patch: ZlozOperationPatch,
  policy: ZlozOperationPolicy,
): string | null {
  const removedNodes = patch.nodes.flatMap((item) =>
    item.type === 'record' && item.before && !item.after ? [item.before] : [],
  );
  const removedEdges = patch.edges.flatMap((item) =>
    item.before && !item.after ? [item.before] : [],
  );
  if (removedNodes.length || removedEdges.length) {
    const reason = policy.canDelete?.({ nodes: removedNodes, edges: removedEdges }, before) ?? null;
    if (reason !== null) return reason.trim() || 'This deletion is protected.';
  }
  for (const item of patch.nodes) {
    const node = before.nodes.find(({ id }) => id === item.id);
    if (!node) continue;
    if (item.type === 'geometry') {
      if (!equal(item.before.position, item.after.position)) {
        const reason = policy.canMoveNode?.(node, before) ?? null;
        if (reason !== null) return reason.trim() || 'Movement is protected.';
      }
      if (!equal(item.before.size, item.after.size)) {
        const reason = policy.canResizeNode?.(node, before) ?? null;
        if (reason !== null) return reason.trim() || 'Resizing is protected.';
      }
      const limits = node.resizeLimits;
      if (
        item.after.size.width < (limits?.minWidth ?? 0) ||
        item.after.size.width > (limits?.maxWidth ?? Infinity) ||
        item.after.size.height < (limits?.minHeight ?? 0) ||
        item.after.size.height > (limits?.maxHeight ?? Infinity)
      )
        return 'Authored geometry exceeds the node resize limits.';
    }
    if (item.type === 'ports') {
      for (const port of item.before.filter(
        (port) => !item.after.some(({ id }) => id === port.id),
      )) {
        const reason = policy.canEditPort?.({ operation: 'remove', node, port }, before) ?? null;
        if (reason !== null) return reason.trim() || 'Port removal is protected.';
      }
      for (const port of item.after.filter(
        (port) => !item.before.some(({ id }) => id === port.id),
      )) {
        const reason = policy.canEditPort?.({ operation: 'add', node, port }, before) ?? null;
        if (reason !== null) return reason.trim() || 'Port restoration is protected.';
      }
    }
  }
  const authored = new Set(
    patch.nodes
      .filter((item) => item.type === 'geometry' || item.type === 'record')
      .map(({ id }) => id),
  );
  for (const node of after.nodes) {
    if (!authored.has(node.id)) continue;
    if (node.parentId === undefined || (node.extent !== 'parent' && !node.expandParent)) continue;
    const parent = after.nodes.find(({ id }) => id === node.parentId);
    if (
      !parent ||
      node.position.x < parent.position.x ||
      node.position.y < parent.position.y ||
      node.position.x + node.size.width > parent.position.x + parent.size.width ||
      node.position.y + node.size.height > parent.position.y + parent.size.height
    )
      return 'Authored geometry must remain within its parent; implicit parent expansion is unavailable.';
  }
  const remaining = {
    ...after,
    edges: before.edges.filter((edge) => !patch.edges.some((item) => item.id === edge.id)),
  };
  for (const item of patch.edges)
    if (item.after) {
      const reason = connectionReason(remaining, item.after, policy);
      if (reason !== null) return reason.trim() || 'Connection is protected.';
    }
  return null;
}

export function rejectOperation(
  document: ZlozOperationDocument,
  request: ZlozOperationRequest,
  scope: ZlozOperationScope,
  code: ZlozOperationRejection,
  message: string,
): ZlozOperationDecision {
  return {
    type: 'rejected',
    document,
    receipt: {
      ...scope,
      operationId: request.operationId,
      documentVersion: document.version,
      status: 'rejected',
      code,
      message,
      change: null,
    },
  };
}
/** One pure decision shared by local editor and provider adapters; never mutates its input. */
export function decideOperation(
  document: ZlozOperationDocument,
  input: ZlozOperationRequest,
  scope: ZlozOperationScope,
  policy: ZlozOperationPolicy = {},
): ZlozOperationDecision {
  if (!isOperationRequest(input))
    return rejectOperation(
      document,
      input,
      scope,
      'InvalidOperation',
      'Invalid operation or missing precondition',
    );
  if (
    document.undo.some(
      (entry) => entry.actorId === scope.actorId && entry.operationId === input.operationId,
    )
  )
    return rejectOperation(
      document,
      input,
      scope,
      'IdentityUsed',
      'Operation identity was already accepted; recover its receipt through the adapter',
    );
  try {
    const request = parseDetachedRequest(input);
    const patch = proposedPatch(document, request, scope);
    const change: ZlozOperationChange = copyOperationValue({
      ...patch,
      ...scope,
      operationId: request.operationId,
      fromVersion: document.version,
      version: document.version + 1,
      undoOf: request.operation.type === 'Undo' ? request.operation.operationId : null,
    });
    const next = applyOperationChange(document, change);
    // Replay has checked identities, preconditions and the complete candidate.
    // A record adds/removes an identity; field patches change only their field.
    // Compare that validated write set rather than canonicalizing both graphs.
    const changed =
      change.edges.length > 0 ||
      change.nodes.some((item) => item.type === 'record' || !equal(item.before, item.after));
    if (!changed)
      return rejectOperation(
        document,
        request,
        scope,
        'NoChange',
        'This operation changes no authored data',
      );
    const veto =
      policy.canApplyOperation?.(request.operation, document.graph, scope, change, next.graph) ??
      policyReason(document.graph, next.graph, patch, policy);
    if (veto !== null)
      return rejectOperation(
        document,
        request,
        scope,
        'Protected',
        veto.trim() || 'This operation is protected.',
      );
    return {
      type: 'accepted',
      document: next,
      receipt: {
        ...scope,
        operationId: request.operationId,
        documentVersion: next.version,
        status: 'accepted',
        code: null,
        change,
      },
    };
  } catch (error) {
    if (!(error instanceof ZlozError)) throw error;
    const code =
      error instanceof OperationFault
        ? error.rejection
        : error.code === 'invalid-graph'
          ? 'InvalidGraph'
          : 'Conflict';
    return rejectOperation(document, input, scope, code, error.message);
  }
}
function parseDetachedRequest(request: ZlozOperationRequest): ZlozOperationRequest {
  return copyOperationValue(request);
}

const nullableVersion = (value: unknown): value is number | null =>
  value === null || operationVersion(value);
function isNodeChange(value: unknown): value is ZlozNodeChange {
  if (!operationRecord(value) || !operationEntityId(value.id)) return false;
  const fields = ['type', 'id', 'expected', 'before', 'after'];
  switch (value.type) {
    case 'geometry':
      return (
        operationKeys(value, fields) &&
        operationVersion(value.expected) &&
        operationFrame(value.before) &&
        operationFrame(value.after)
      );
    case 'label':
      return (
        operationKeys(value, fields) &&
        operationVersion(value.expected) &&
        typeof value.before === 'string' &&
        typeof value.after === 'string'
      );
    case 'icon':
      return (
        operationKeys(value, fields) &&
        operationVersion(value.expected) &&
        (value.before === null || isNodeIcon(value.before)) &&
        (value.after === null || isNodeIcon(value.after))
      );
    case 'ports': {
      if (
        !operationKeys(value, fields) ||
        !operationVersion(value.expected) ||
        !Array.isArray(value.before) ||
        !Array.isArray(value.after)
      )
        return false;
      const check = (ports: unknown): ports is readonly Port[] =>
        isNode({
          id: value.id,
          label: '',
          position: { x: 0, y: 0 },
          size: { width: 1, height: 1 },
          ports,
        });
      return check(value.before) && check(value.after);
    }
    case 'record':
      return (
        operationKeys(value, [...fields, 'index']) &&
        nullableVersion(value.expected) &&
        operationVersion(value.index) &&
        (value.before === null
          ? isNode(value.after) && value.after.id === value.id
          : value.after === null && isNode(value.before) && value.before.id === value.id)
      );
    default:
      return false;
  }
}
function isEdgeChange(value: unknown): value is ZlozEdgeChange {
  return (
    operationRecord(value) &&
    operationKeys(value, ['id', 'expected', 'before', 'after', 'index']) &&
    operationEntityId(value.id) &&
    nullableVersion(value.expected) &&
    operationVersion(value.index) &&
    (value.before === null
      ? isEdge(value.after) && value.after.id === value.id
      : value.after === null && isEdge(value.before) && value.before.id === value.id)
  );
}
function isPatch(value: unknown): value is ZlozOperationPatch {
  return (
    operationRecord(value) &&
    operationKeys(value, ['nodes', 'edges']) &&
    Array.isArray(value.nodes) &&
    Array.isArray(value.edges) &&
    value.nodes.every(isNodeChange) &&
    value.edges.every(isEdgeChange) &&
    new Set(value.nodes.map(({ id }) => id)).size === value.nodes.length &&
    new Set(value.edges.map(({ id }) => id)).size === value.edges.length
  );
}
type UnparsedOperationScope = Readonly<{
  actorId?: unknown;
  teamId?: unknown;
  diagramId?: unknown;
  operationId?: unknown;
}>;
const isScope = (value: UnparsedOperationScope) =>
  operationId(value.actorId) &&
  operationId(value.teamId) &&
  operationId(value.diagramId) &&
  operationId(value.operationId);
export function isOperationChange(value: unknown): value is ZlozOperationChange {
  if (
    !operationRecord(value) ||
    !operationKeys(value, [
      'actorId',
      'teamId',
      'diagramId',
      'operationId',
      'fromVersion',
      'version',
      'undoOf',
      'nodes',
      'edges',
    ]) ||
    !isScope(value) ||
    !operationVersion(value.fromVersion) ||
    !operationVersion(value.version) ||
    value.version !== value.fromVersion + 1 ||
    !(value.undoOf === null || operationId(value.undoOf))
  )
    return false;
  return isPatch({ nodes: value.nodes, edges: value.edges });
}
/** Persistence boundary validation, including field clocks and retained inverse ownership. */
export function isOperationDocument(value: unknown): value is ZlozOperationDocument {
  if (
    !operationRecord(value) ||
    !operationKeys(value, ['version', 'graph', 'nodes', 'edges', 'undo']) ||
    !operationVersion(value.version) ||
    !isGraph(value.graph) ||
    !Array.isArray(value.nodes) ||
    !Array.isArray(value.edges) ||
    !Array.isArray(value.undo) ||
    value.undo.length > 100
  )
    return false;
  try {
    validateGraph(value.graph);
    const graph = value.graph;
    const nodeIds = new Set(graph.nodes.map((node) => node.id));
    const edgeIds = new Set(graph.edges.map((edge) => edge.id));
    const ids = new Set<string>();
    for (const clock of value.nodes) {
      if (
        !operationRecord(clock) ||
        !operationKeys(clock, [
          'id',
          'present',
          'version',
          'geometry',
          'label',
          'ports',
          ...(Object.hasOwn(clock, 'icon') ? ['icon'] : []),
        ]) ||
        (Object.hasOwn(clock, 'icon') &&
          (!operationVersion(clock.icon) || clock.icon > Number(clock.version))) ||
        !operationEntityId(clock.id) ||
        ids.has(clock.id) ||
        typeof clock.present !== 'boolean' ||
        !['version', 'geometry', 'label', 'ports'].every(
          (key) => operationVersion(clock[key]) && Number(clock[key]) <= Number(value.version),
        )
      )
        return false;
      if (
        Number(clock.geometry) > Number(clock.version) ||
        Number(clock.label) > Number(clock.version) ||
        Number(clock.ports) > Number(clock.version)
      )
        return false;
      ids.add(clock.id);
      if (clock.present !== nodeIds.has(clock.id)) return false;
    }
    if (graph.nodes.some((node) => !ids.has(node.id))) return false;
    ids.clear();
    for (const clock of value.edges) {
      if (
        !operationRecord(clock) ||
        !operationKeys(clock, ['id', 'present', 'version']) ||
        !operationEntityId(clock.id) ||
        ids.has(clock.id) ||
        typeof clock.present !== 'boolean' ||
        !operationVersion(clock.version) ||
        clock.version > value.version ||
        clock.present !== edgeIds.has(clock.id)
      )
        return false;
      ids.add(clock.id);
    }
    if (graph.edges.some((edge) => !ids.has(edge.id))) return false;
    const undoIds = new Set<string>();
    return value.undo.every((entry) => {
      if (
        !operationRecord(entry) ||
        !operationKeys(entry, ['actorId', 'operationId', 'inverse']) ||
        !operationId(entry.actorId) ||
        !operationId(entry.operationId) ||
        !isPatch(entry.inverse)
      )
        return false;
      const key = canonicalOperationValue([entry.actorId, entry.operationId]);
      if (undoIds.has(key)) return false;
      undoIds.add(key);
      return [...entry.inverse.nodes, ...entry.inverse.edges].every(
        (patch) => operationVersion(patch.expected) && patch.expected <= Number(value.version),
      );
    });
  } catch {
    return false;
  }
}
const rejectionCodes: readonly ZlozOperationRejection[] = [
  'InvalidOperation',
  'Conflict',
  'Protected',
  'Missing',
  'IdentityUsed',
  'NoChange',
  'UndoUnavailable',
  'UnsupportedOperation',
  'InvalidGraph',
];
export function isOperationReceipt(value: unknown): value is ZlozOperationReceipt {
  if (!operationRecord(value) || !isScope(value) || !operationVersion(value.documentVersion))
    return false;
  if (value.status === 'accepted')
    return (
      operationKeys(value, [
        'actorId',
        'teamId',
        'diagramId',
        'operationId',
        'documentVersion',
        'status',
        'code',
        'change',
      ]) &&
      value.code === null &&
      isOperationChange(value.change) &&
      value.change.version === value.documentVersion &&
      value.change.actorId === value.actorId &&
      value.change.teamId === value.teamId &&
      value.change.diagramId === value.diagramId &&
      value.change.operationId === value.operationId
    );
  return (
    operationKeys(value, [
      'actorId',
      'teamId',
      'diagramId',
      'operationId',
      'documentVersion',
      'status',
      'code',
      'message',
      'change',
    ]) &&
    value.status === 'rejected' &&
    rejectionCodes.some((code) => code === value.code) &&
    typeof value.message === 'string' &&
    value.change === null
  );
}
