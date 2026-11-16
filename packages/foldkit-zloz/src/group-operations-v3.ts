import {
  editFields,
  editIdentifier,
  editPoint,
  editRecord,
  editSize,
  ownEditorEdit,
} from './edit-data';
import { isGraph, ZlozError } from './graph';
import { graphChanges } from './graph-change-policy';
import { captureGroupDocumentV3 } from './group-document-v3';
import {
  applyGroupEditorTransactionV3,
  captureGroupEditorSourceV3,
  reviewGroupEditorTransactionV3,
  type ZlozGroupEditorStateV3,
  type ZlozGroupEditorSourceV3,
  type ZlozGroupEditorPolicyV3,
  type ZlozGroupEditorResultV3,
  type ZlozGroupEditorTransactionV3,
} from './group-editor-v3';
import { withDescendants } from './group-presentation';
import { historyValueEqual } from './history';
import { expandParents } from './parent-expansion';
import type { JsonValue, Point, Size, ZlozGraph, ZlozNode } from './types';
export type ZlozGroupOperationV3 =
  | Readonly<{
      operation: 'move';
      nodeIds: readonly string[];
      delta: Point;
    }>
  | Readonly<{ operation: 'resize'; id: string; size: Size; position?: Point }>
  | Readonly<{
      operation: 'reparent';
      nodeIds: readonly string[];
      parentId: string | null;
    }>
  | Readonly<{
      operation: 'group';
      nodeIds: readonly string[];
      node: ZlozNode;
    }>
  | Readonly<{ operation: 'ungroup'; id: string }>
  | Readonly<{
      operation: 'delete';
      nodeIds: readonly string[];
      edgeIds: readonly string[];
    }>;
export type ZlozGroupOperationRequestV3 = Readonly<{
  source: ZlozGroupEditorSourceV3;
  operation: ZlozGroupOperationV3;
}>;
export type ZlozGroupOperationResultV3 =
  | ZlozGroupEditorResultV3
  | Readonly<{
      type: 'blocked';
      editor: ZlozGroupEditorStateV3;
      code: 'invalid-edit' | 'constraint' | 'not-found';
      reason: string;
    }>;
export type ZlozGroupOperationPlanV3 =
  | Exclude<ZlozGroupOperationResultV3, { type: 'applied' | 'unchanged' }>
  | Readonly<{ type: 'unchanged'; editor: ZlozGroupEditorStateV3 }>
  | Readonly<{
      type: 'ready';
      editor: ZlozGroupEditorStateV3;
      request: ZlozGroupOperationRequestV3;
      transaction: ZlozGroupEditorTransactionV3;
      changedNodeIds: readonly string[];
      removedNodeIds: readonly string[];
      removedEdgeIds: readonly string[];
    }>;
const identifiers = (value: JsonValue | undefined): value is readonly string[] =>
  Array.isArray(value) && value.every(editIdentifier) && new Set(value).size === value.length;
function validOperation(value: JsonValue): value is JsonValue & ZlozGroupOperationV3 {
  if (!editRecord(value)) return false;
  switch (value.operation) {
    case 'move':
      return (
        editFields(value, ['operation', 'nodeIds', 'delta']) &&
        identifiers(value.nodeIds) &&
        value.nodeIds.length > 0 &&
        editPoint(value.delta)
      );
    case 'resize':
      return (
        editFields(value, ['operation', 'id', 'size'], ['position']) &&
        editIdentifier(value.id) &&
        editSize(value.size) &&
        (!Object.hasOwn(value, 'position') || editPoint(value.position))
      );
    case 'reparent':
      return (
        editFields(value, ['operation', 'nodeIds', 'parentId']) &&
        identifiers(value.nodeIds) &&
        value.nodeIds.length > 0 &&
        (value.parentId === null || editIdentifier(value.parentId))
      );
    case 'group':
      return (
        editFields(value, ['operation', 'nodeIds', 'node']) &&
        identifiers(value.nodeIds) &&
        value.nodeIds.length > 0 &&
        editRecord(value.node) &&
        value.node.kind === 'group' &&
        isGraph({ nodes: [value.node], edges: [] })
      );
    case 'ungroup':
      return editFields(value, ['operation', 'id']) && editIdentifier(value.id);
    case 'delete':
      return (
        editFields(value, ['operation', 'nodeIds', 'edgeIds']) &&
        identifiers(value.nodeIds) &&
        identifiers(value.edgeIds)
      );
    default:
      return false;
  }
}
class GroupOperationError extends ZlozError {
  constructor(
    readonly reasonCode: 'not-found' | 'constraint',
    reason: string,
  ) {
    super('invalid-edit', reason);
  }
}
function requireNode(graph: ZlozGraph, id: string): ZlozNode {
  const node = graph.nodes.find((n) => n.id === id);
  if (!node) throw new GroupOperationError('not-found', `Node ${id} no longer exists.`);
  return node;
}
function reparented(node: ZlozNode, parentId: string | null): ZlozNode {
  if (parentId !== null) return { ...node, parentId };
  const { parentId: _parent, extent: _extent, expandParent: _expand, ...root } = node;
  return root;
}
function selectedRoots(graph: ZlozGraph, ids: readonly string[]): ReadonlySet<string> {
  const selected = new Set(ids);
  function selectedRoot(id: string): boolean {
    let parent = requireNode(graph, id).parentId;
    while (parent !== undefined) {
      if (selected.has(parent)) return false;
      parent = requireNode(graph, parent).parentId;
    }
    return true;
  }
  return new Set(ids.filter(selectedRoot));
}
type GroupGraphEdit = Readonly<{ graph: ZlozGraph; expand: readonly string[] }>;
function editedGraph(graph: ZlozGraph, operation: ZlozGroupOperationV3): GroupGraphEdit {
  if ('nodeIds' in operation) for (const id of operation.nodeIds) requireNode(graph, id);
  switch (operation.operation) {
    case 'move': {
      const moving = withDescendants(graph, operation.nodeIds);
      return {
        graph: {
          ...graph,
          nodes: graph.nodes.map((n) =>
            moving.has(n.id)
              ? {
                  ...n,
                  position: {
                    x: n.position.x + operation.delta.x,
                    y: n.position.y + operation.delta.y,
                  },
                }
              : n,
          ),
        },
        expand: [...moving],
      };
    }
    case 'resize': {
      requireNode(graph, operation.id);
      return {
        graph: {
          ...graph,
          nodes: graph.nodes.map((n) =>
            n.id === operation.id
              ? { ...n, size: operation.size, position: operation.position ?? n.position }
              : n,
          ),
        },
        expand: [operation.id],
      };
    }
    case 'reparent': {
      if (operation.parentId !== null && requireNode(graph, operation.parentId).kind !== 'group')
        throw new GroupOperationError('constraint', 'Only an explicit group can own children.');
      const roots = selectedRoots(graph, operation.nodeIds);
      return {
        graph: {
          ...graph,
          nodes: graph.nodes.map((n) => (roots.has(n.id) ? reparented(n, operation.parentId) : n)),
        },
        expand: [...roots],
      };
    }
    case 'group': {
      if (graph.nodes.some((n) => n.id === operation.node.id))
        throw new GroupOperationError('constraint', 'The group ID is already in use.');
      const roots = selectedRoots(graph, operation.nodeIds);
      return {
        graph: {
          ...graph,
          nodes: [
            ...graph.nodes.map((n) => (roots.has(n.id) ? reparented(n, operation.node.id) : n)),
            operation.node,
          ],
        },
        expand: [...roots, operation.node.id],
      };
    }
    case 'ungroup': {
      const group = requireNode(graph, operation.id);
      if (group.kind !== 'group')
        throw new GroupOperationError('constraint', 'Choose an explicit group to ungroup.');
      if (group.ports.length > 0)
        throw new GroupOperationError(
          'constraint',
          'Handle group ports and incident connections explicitly before ungrouping.',
        );
      const children = graph.nodes.filter((n) => n.parentId === group.id);
      return {
        graph: {
          ...graph,
          nodes: graph.nodes
            .filter((n) => n.id !== group.id)
            .map((n) => (n.parentId === group.id ? reparented(n, group.parentId ?? null) : n)),
        },
        expand: children.map((n) => n.id),
      };
    }
    case 'delete': {
      for (const id of operation.edgeIds)
        if (!graph.edges.some((e) => e.id === id))
          throw new GroupOperationError('not-found', `Connection ${id} no longer exists.`);
      const nodes = withDescendants(graph, operation.nodeIds),
        edges = new Set(operation.edgeIds);
      const target: ZlozGraph = {
        ...graph,
        nodes: graph.nodes.filter((n) => !nodes.has(n.id)),
        edges: graph.edges.filter(
          (e) => !edges.has(e.id) && !nodes.has(e.source.node) && !nodes.has(e.target.node),
        ),
      };
      return { graph: target, expand: [] };
    }
  }
}
/** @internal Shared authored geometry constraints for v3 planners and layout. */
export function assertGroupGeometryConstraintsV3(source: ZlozGraph, target: ZlozGraph): void {
  const changes = graphChanges(source, target),
    changed = new Set(changes.filter((c) => c.entity === 'node').map((c) => c.id));
  const previous = new Map(source.nodes.map((n) => [n.id, n])),
    nodes = new Map(target.nodes.map((n) => [n.id, n]));
  for (const node of target.nodes) {
    const before = previous.get(node.id);
    if (!before || !historyValueEqual(before.size, node.size)) {
      const limits = node.resizeLimits;
      if (
        node.size.width < (limits?.minWidth ?? 0) ||
        node.size.width > (limits?.maxWidth ?? Infinity) ||
        node.size.height < (limits?.minHeight ?? 0) ||
        node.size.height > (limits?.maxHeight ?? Infinity)
      )
        throw new GroupOperationError('constraint', `Node ${node.id} exceeds its resize limits.`);
      if (
        before?.keepAspectRatio &&
        Math.abs(
          Math.log(node.size.width) -
            Math.log(node.size.height) -
            (Math.log(before.size.width) - Math.log(before.size.height)),
        ) > 1e-9
      )
        throw new GroupOperationError('constraint', `Node ${node.id} has locked proportions.`);
    }
    if (
      node.extent === 'parent' &&
      node.parentId !== undefined &&
      (changed.has(node.id) || changed.has(node.parentId))
    ) {
      const parent = nodes.get(node.parentId);
      if (
        parent &&
        (node.position.x < parent.position.x ||
          node.position.y < parent.position.y ||
          node.position.x + node.size.width > parent.position.x + parent.size.width ||
          node.position.y + node.size.height > parent.position.y + parent.size.height)
      )
        throw new GroupOperationError(
          'constraint',
          `Node ${node.id} must remain inside its parent.`,
        );
    }
  }
}
const blocked = (
  editor: ZlozGroupEditorStateV3,
  code: 'invalid-edit' | 'constraint' | 'not-found',
  reason: string,
): Extract<ZlozGroupOperationResultV3, { type: 'blocked' }> => ({
  type: 'blocked',
  editor,
  code,
  reason,
});
function build(
  editor: ZlozGroupEditorStateV3,
  request: ZlozGroupOperationRequestV3,
): Extract<ZlozGroupOperationPlanV3, { type: 'ready' | 'blocked' }> {
  const fresh = reviewGroupEditorTransactionV3(editor, {
    source: request.source,
    document: editor.document,
  });
  if (fresh.type === 'blocked') return fresh;
  // oxlint-disable-next-line linteffect/no-try-catch -- Known geometry/data failures become blocked data; live policies run outside this catch.
  try {
    const operation = ownEditorEdit(request.operation, validOperation, 'v3 group operation'),
      source = captureGroupEditorSourceV3(editor);
    const edited = editedGraph(source.document.graph, operation);
    // Reject cycles/invalid parents before walking any newly authored ancestor chain.
    let graph = captureGroupDocumentV3({ ...source.document, graph: edited.graph }).graph;
    for (const id of edited.expand) graph = expandParents(graph, id);
    const document = captureGroupDocumentV3({ ...source.document, graph });
    assertGroupGeometryConstraintsV3(source.document.graph, document.graph);
    const changes = graphChanges(source.document.graph, document.graph);
    return Object.freeze({
      type: 'ready',
      editor,
      request: Object.freeze({ source, operation }),
      transaction: Object.freeze({ source, document }),
      changedNodeIds: Object.freeze(
        changes.filter((c) => c.entity === 'node' && c.after !== null).map((c) => c.id),
      ),
      removedNodeIds: Object.freeze(
        changes.filter((c) => c.entity === 'node' && c.after === null).map((c) => c.id),
      ),
      removedEdgeIds: Object.freeze(
        changes.filter((c) => c.entity === 'edge' && c.after === null).map((c) => c.id),
      ),
    });
  } catch (error) {
    if (error instanceof ZlozError)
      return blocked(
        editor,
        error instanceof GroupOperationError ? error.reasonCode : 'invalid-edit',
        error.message,
      );
    throw error;
  }
}
/** Complete immutable group effects, including descendants/expanding ancestors, before any publication. */
export function planGroupOperationV3(
  editor: ZlozGroupEditorStateV3,
  request: ZlozGroupOperationRequestV3,
  policy: ZlozGroupEditorPolicyV3 = {},
): ZlozGroupOperationPlanV3 {
  const plan = build(editor, request);
  if (plan.type === 'blocked') return plan;
  const review = reviewGroupEditorTransactionV3(editor, plan.transaction, policy);
  return review.type === 'ready' ? plan : review;
}
/** Recheck the full live plan; all implied edits share one full-document Undo unit. */
export function applyGroupOperationV3(
  editor: ZlozGroupEditorStateV3,
  request: ZlozGroupOperationRequestV3,
  policy: ZlozGroupEditorPolicyV3 = {},
): ZlozGroupOperationResultV3 {
  const plan = build(editor, request);
  return plan.type === 'blocked'
    ? plan
    : applyGroupEditorTransactionV3(editor, plan.transaction, policy);
}
