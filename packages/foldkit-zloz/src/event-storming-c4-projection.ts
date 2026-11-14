import type {
  ZlozEventStormingC4MembershipState,
  ZlozEventStormingC4ConversionChanges,
} from './event-storming-c4-conversion-plan';
import type { ZlozNode, ZlozGraph } from './types';

function place(node: ZlozNode, after: ZlozEventStormingC4MembershipState): ZlozNode {
  const { parentId: _parentId, extent: _extent, expandParent: _expandParent, ...unparented } = node;
  let next: ZlozNode =
    after.parentId === null ? unparented : { ...unparented, parentId: after.parentId };
  if (after.extent !== null) next = { ...next, extent: after.extent };
  if (after.expandParent !== null) next = { ...next, expandParent: after.expandParent };
  return next;
}
/** Internal shared projection: plan validation and Apply must publish identical graph values. */
export function projectEventStormingC4Graph(
  graph: ZlozGraph,
  changes: ZlozEventStormingC4ConversionChanges,
): ZlozGraph {
  const nodes = new Map(changes.nodes.map((n) => [n.nodeId, n]));
  const edges = new Map(changes.edges.map((e) => [e.edgeId, e]));
  const placements = new Map(changes.memberships.map((m) => [m.nodeId, m.after]));
  return {
    nodes: graph.nodes.map((node) => {
      const proposal = nodes.get(node.id),
        after = placements.get(node.id);
      const next = proposal
        ? { ...node, architecture: proposal.architecture, label: proposal.label }
        : node;
      return after ? place(next, after) : next;
    }),
    edges: graph.edges.map((edge) => {
      const proposal = edges.get(edge.id);
      if (!proposal) return edge;
      const { architecture: _architecture, ...plain } = edge;
      return { ...plain, label: proposal.relationship.label };
    }),
  };
}
