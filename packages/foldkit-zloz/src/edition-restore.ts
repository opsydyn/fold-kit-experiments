import { commitGraph } from './editor';
import { captureEdition, historyValueEqual, type ZlozEdition } from './history';
import { portEditReason } from './port-edit';
import type { EditorPolicy, EditorState, Port, ZlozGraph, ZlozNode } from './types';

export type ZlozEditionRestorePolicy = EditorPolicy &
  Readonly<{
    /** Whole-transaction veto, including fields with no granular editing hook. */
    canRestoreEdition?: (edition: ZlozEdition, current: ZlozGraph) => string | null;
  }>;
export type ZlozEditionRestoreOptions = Readonly<{
  /** Required working-document freshness token captured when the user previews the restore. */
  expectedRevision: number;
  policy?: ZlozEditionRestorePolicy;
}>;
export type ZlozEditionRestoreDecision =
  | Readonly<{ type: 'ready'; edition: ZlozEdition; expectedRevision: number }>
  | Readonly<{ type: 'unchanged' }>
  | Readonly<{ type: 'blocked'; reason: string }>;
export type ZlozEditionRestoreResult =
  | Readonly<{ type: 'restored' | 'unchanged'; editor: EditorState }>
  | Readonly<{ type: 'blocked'; editor: EditorState; reason: string }>;

function position(port: Port) {
  const { id: _id, kind: _kind, label: _label, ...location } = port;
  return location;
}
function portReason(
  before: ZlozNode,
  after: ZlozNode,
  graph: ZlozGraph,
  policy: EditorPolicy,
): string | null {
  for (const port of before.ports) {
    const next = after.ports.find((item) => item.id === port.id);
    if (!next || next.kind !== port.kind) {
      const reason = portEditReason(
        { operation: 'remove', node: before, port },
        graph,
        policy.canEditPort,
      );
      if (reason !== null) return reason;
    } else {
      if (next.label !== port.label) {
        const reason = portEditReason(
          { operation: 'label', node: before, port },
          graph,
          policy.canEditPort,
        );
        if (reason !== null) return reason;
      }
      if (!historyValueEqual(position(port), position(next))) {
        const reason = portEditReason(
          { operation: 'position', node: before, port },
          graph,
          policy.canEditPort,
        );
        if (reason !== null) return reason;
      }
    }
  }
  for (const port of after.ports) {
    const previous = before.ports.find((item) => item.id === port.id);
    if (!previous || previous.kind !== port.kind) {
      const reason = portEditReason(
        { operation: 'add', node: before, port },
        graph,
        policy.canEditPort,
      );
      if (reason !== null) return reason;
    }
  }
  return null;
}
function policyReason(
  before: ZlozGraph,
  edition: ZlozEdition,
  policy: ZlozEditionRestorePolicy,
): string | null {
  const after = edition.snapshot.graph;
  const bulk = policy.canRestoreEdition?.(edition, before) ?? null;
  if (bulk !== null) return bulk.trim() || 'Edition restore is protected.';
  const deleted = {
    nodes: before.nodes.filter((node) => !after.nodes.some((item) => item.id === node.id)),
    edges: before.edges.filter((edge) => !after.edges.some((item) => item.id === edge.id)),
  };
  if (deleted.nodes.length || deleted.edges.length) {
    const reason = policy.canDelete?.(deleted, before) ?? null;
    if (reason !== null) return reason.trim() || 'Deletion is protected.';
  }
  for (const node of before.nodes) {
    const next = after.nodes.find((item) => item.id === node.id);
    if (!next) continue;
    const checks: readonly (string | null)[] = [
      !historyValueEqual(node.position, next.position) || node.parentId !== next.parentId
        ? (policy.canMoveNode?.(node, before) ?? null)
        : null,
      !historyValueEqual(node.size, next.size)
        ? (policy.canResizeNode?.(node, before) ?? null)
        : null,
      !historyValueEqual(node.architecture, next.architecture)
        ? (policy.canChangeNodeArchitecture?.(node, next, before) ?? null)
        : null,
      !historyValueEqual(node.appearance, next.appearance)
        ? (policy.canChangeNodeAppearance?.(node, next, before) ?? null)
        : null,
      portReason(node, next, before, policy),
    ];
    const reason = checks.find((item) => item !== null);
    if (reason !== undefined) return reason.trim() || 'Node editing is protected.';
  }
  for (const edge of after.edges) {
    const previous = before.edges.find((item) => item.id === edge.id);
    const sourceChanged = !previous || !historyValueEqual(previous.source, edge.source);
    const targetChanged = !previous || !historyValueEqual(previous.target, edge.target);
    if (!sourceChanged && !targetChanged) continue;
    if (previous)
      for (const end of ['source', 'target'] as const) {
        if (end === 'source' ? !sourceChanged : !targetChanged) continue;
        const reason = policy.canReconnect?.(previous, end, before) ?? null;
        if (reason !== null) return reason.trim() || 'Reconnection is protected.';
      }
    const candidate = { ...after, edges: after.edges.filter((item) => item.id !== edge.id) };
    const source = sourceChanged ? (policy.canConnectPort?.(edge.source, candidate) ?? null) : null;
    if (source !== null) return source.trim() || 'Source port is protected.';
    const target = targetChanged ? (policy.canConnectPort?.(edge.target, candidate) ?? null) : null;
    if (target !== null) return target.trim() || 'Target port is protected.';
    const reason = policy.canConnect?.(edge, candidate) ?? null;
    if (reason !== null) return reason.trim() || 'Connection is protected.';
  }
  return null;
}
/** Preview graph-only restore. Invalid editions throw through the canonical codec before any mutation. */
export function resolveEditionRestore(
  state: EditorState,
  edition: ZlozEdition,
  options: ZlozEditionRestoreOptions,
): ZlozEditionRestoreDecision {
  if (
    !Number.isSafeInteger(options.expectedRevision) ||
    options.expectedRevision < 0 ||
    options.expectedRevision !== state.revision
  )
    return { type: 'blocked', reason: 'The working model changed. Preview the restore again.' };
  if (state.readOnly) return { type: 'blocked', reason: 'The working model is read-only.' };
  if (state.gesture.type !== 'idle')
    return { type: 'blocked', reason: 'Finish the current gesture before restoring.' };
  const checked = captureEdition(edition);
  if (historyValueEqual(state.graph, checked.snapshot.graph)) return { type: 'unchanged' };
  if (state.historyLimit === 0)
    return { type: 'blocked', reason: 'Enable graph Undo before restoring an edition.' };
  const reason = policyReason(state.graph, checked, options.policy ?? {});
  return reason !== null
    ? { type: 'blocked', reason }
    : { type: 'ready', edition: checked, expectedRevision: options.expectedRevision };
}
/** Revalidate freshness and current policies, then publish exactly one graph Undo step. Camera and editions stay unchanged. */
export function restoreEdition(
  state: EditorState,
  edition: ZlozEdition,
  options: ZlozEditionRestoreOptions,
): ZlozEditionRestoreResult {
  const decision = resolveEditionRestore(state, edition, options);
  if (decision.type === 'blocked')
    return { type: 'blocked', editor: state, reason: decision.reason };
  if (decision.type === 'unchanged') return { type: 'unchanged', editor: state };
  return {
    type: 'restored',
    editor: {
      ...commitGraph(state, decision.edition.snapshot.graph),
      notice: `Restored edition: ${decision.edition.name}`,
    },
  };
}
