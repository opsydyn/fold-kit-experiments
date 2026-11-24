import {
  resolveEventStormingRelationship,
  type ZlozGraph,
  type ZlozGraphOperation,
} from '@opsydyn/foldkit-zloz';

/** Validate a newly authored workshop link against the authoritative endpoints. */
export function workshopLinkDenial(operation: ZlozGraphOperation, graph: ZlozGraph) {
  if (operation.type !== 'Connect') return null;
  const { architecture } = operation.edge;
  if (
    architecture?.family !== 'event-storming' ||
    (architecture.role !== 'produces' &&
      architecture.role !== 'activates' &&
      architecture.role !== 'triggers')
  )
    return null;
  const decision = resolveEventStormingRelationship(graph, operation.edge);
  return decision.type === 'blocked' ? decision.reason : null;
}
