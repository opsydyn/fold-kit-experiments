import type { ZlozConnectionMode } from './connection-mode';
import { connectionReason } from './connection-validation';
import { historyValueEqual } from './history';
import type { EditorPolicy, ZlozGraph, ZlozNode, ZlozEdge, Port } from './types';

/** Internal complete entity changes; wire patch operations are a separate concern. */
export type GraphChange =
  | Readonly<{ entity: 'node'; id: string; before: ZlozNode | null; after: ZlozNode | null }>
  | Readonly<{ entity: 'edge'; id: string; before: ZlozEdge | null; after: ZlozEdge | null }>;
const denial = (reason: string | null | undefined, fallback: string) =>
  reason == null ? null : reason.trim() || fallback;

/** Preserve source order for removals/changes and target order for additions. */
export function graphChanges(source: ZlozGraph, target: ZlozGraph): readonly GraphChange[] {
  function changes<T extends ZlozNode | ZlozEdge>(before: readonly T[], after: readonly T[]) {
    const previous = new Map(before.map((value) => [value.id, value]));
    const next = new Map(after.map((value) => [value.id, value]));
    return [
      ...before.flatMap((value) =>
        historyValueEqual(value, next.get(value.id))
          ? []
          : [{ id: value.id, before: value, after: next.get(value.id) ?? null }],
      ),
      ...after
        .filter((value) => !previous.has(value.id))
        .map((value) => ({ id: value.id, before: null, after: value })),
    ];
  }
  return Object.freeze([
    ...changes(source.nodes, target.nodes).map((change) =>
      Object.freeze({ ...change, entity: 'node' as const }),
    ),
    ...changes(source.edges, target.edges).map((change) =>
      Object.freeze({ ...change, entity: 'edge' as const }),
    ),
  ]);
}

function portReasons(
  before: ZlozNode | null,
  after: ZlozNode | null,
  source: ZlozGraph,
  target: ZlozGraph,
  policy: EditorPolicy,
  fallback: string,
): string | null {
  const old = before?.ports ?? [],
    next = after?.ports ?? [];
  const check = (
    operation: 'add' | 'remove' | 'label' | 'position',
    node: ZlozNode,
    port: Port,
    graph: ZlozGraph,
  ) => denial(policy.canEditPort?.(Object.freeze({ operation, node, port }), graph), fallback);
  for (const port of old) {
    const replacement = next.find((p) => p.id === port.id);
    if (!replacement || replacement.kind !== port.kind) {
      if (before) {
        const reason = check('remove', before, port, source);
        if (reason !== null) return reason;
      }
    } else if (before) {
      if (port.label !== replacement.label) {
        const reason = check('label', before, port, source);
        if (reason !== null) return reason;
      }
      const { label: _a, ...a } = port,
        { label: _b, ...b } = replacement;
      if (!historyValueEqual(a, b) || old.indexOf(port) !== next.indexOf(replacement)) {
        const reason = check('position', before, port, source);
        if (reason !== null) return reason;
      }
    }
  }
  for (const port of next)
    if (!old.some((p) => p.id === port.id && p.kind === port.kind) && after) {
      const reason = check('add', after, port, target);
      if (reason !== null) return reason;
    }
  return null;
}
/** Internal policy inventory for a complete validated candidate; never mutates source or target. */
export function graphChangePolicyReason(
  source: ZlozGraph,
  target: ZlozGraph,
  changes: readonly GraphChange[],
  policy: EditorPolicy,
  mode: ZlozConnectionMode,
  fallback = 'Patch application is protected.',
): string | null {
  const removed = {
    nodes: changes.flatMap((c) =>
      c.entity === 'node' && c.before && c.after === null ? [c.before] : [],
    ),
    edges: changes.flatMap((c) =>
      c.entity === 'edge' && c.before && c.after === null ? [c.before] : [],
    ),
  };
  if (removed.nodes.length || removed.edges.length) {
    const reason = denial(
      policy.canDelete?.(
        Object.freeze({ nodes: Object.freeze(removed.nodes), edges: Object.freeze(removed.edges) }),
        source,
      ),
      fallback,
    );
    if (reason !== null) return reason;
  }
  for (const c of changes) {
    if (c.entity === 'node') {
      const before = c.before,
        after = c.after;
      if (before && after) {
        const reasons = [
          () =>
            !historyValueEqual(before.position, after.position) ||
            before.parentId !== after.parentId
              ? policy.canMoveNode?.(before, source)
              : null,
          () =>
            !historyValueEqual(before.size, after.size)
              ? policy.canResizeNode?.(before, source)
              : null,
          () =>
            !historyValueEqual(before.architecture, after.architecture)
              ? policy.canChangeNodeArchitecture?.(before, after, source)
              : null,
          () =>
            !historyValueEqual(before.appearance, after.appearance)
              ? policy.canChangeNodeAppearance?.(before, after, source)
              : null,
        ];
        for (const check of reasons) {
          const reason = denial(check(), fallback);
          if (reason !== null) return reason;
        }
      }
      const port = portReasons(before, after, source, target, policy, fallback);
      if (port !== null) return port;
    } else {
      const before = c.before,
        after = c.after;
      if (before && after) {
        if (!historyValueEqual(before.architecture, after.architecture)) {
          const reason = denial(
            policy.canChangeEdgeArchitecture?.(before, after, source),
            fallback,
          );
          if (reason !== null) return reason;
        }
        if (!historyValueEqual(before.waypoints, after.waypoints)) {
          const reason = denial(policy.canChangeEdgeWaypoints?.(before, after, source), fallback);
          if (reason !== null) return reason;
        }
        for (const end of ['source', 'target'] as const)
          if (!historyValueEqual(before[end], after[end])) {
            const reason = denial(policy.canReconnect?.(before, end, source), fallback);
            if (reason !== null) return reason;
          }
      }
      if (
        after &&
        (!before ||
          !historyValueEqual(before.source, after.source) ||
          !historyValueEqual(before.target, after.target))
      ) {
        // The validated target contains new ports/nodes; exclude this edge itself for duplicate/custom checks.
        const remaining = Object.freeze({
          ...target,
          edges: Object.freeze(target.edges.filter((e) => e.id !== after.id)),
        });
        const sourceChanged = before !== null && !historyValueEqual(before.source, after.source);
        const targetChanged = before !== null && !historyValueEqual(before.target, after.target);
        const replacement =
          before && sourceChanged !== targetChanged
            ? { id: after.id, end: sourceChanged ? ('source' as const) : ('target' as const) }
            : undefined;
        const checkedPolicy: EditorPolicy = {
          ...policy,
          canConnect: (edge, graph) =>
            policy.canConnect?.(
              edge,
              Object.freeze({ ...graph, edges: Object.freeze([...graph.edges]) }),
            ) ?? null,
        };
        const reason = denial(
          connectionReason(remaining, after, checkedPolicy, replacement, mode),
          fallback,
        );
        if (reason !== null) return reason;
      }
    }
  }
  return null;
}
