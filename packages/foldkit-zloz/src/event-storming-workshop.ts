import {
  validNodeArchitectureFields,
  type EventStormingParticipantArchitecture,
  type EventStormingHotspotArchitecture,
} from './architecture';
import { ZlozError } from './graph';
import type { ZlozNode } from './types';
/** Meaning only; ports, geometry, membership and runtime ownership are not inferred. */
export type ZlozEventStormingNodeSemantics =
  | Readonly<{ kind: 'participant'; role: EventStormingParticipantArchitecture['role'] }>
  | Readonly<{
      kind: 'annotation';
      role: 'hotspot';
      status: EventStormingHotspotArchitecture['status'];
    }>
  | Readonly<{ kind: 'frame'; role: 'lane' }>;
/** ADR 0081: classify a typed node without rewriting its authored descriptor or group membership.
 * Checks reserved architecture/kind/port constraints, not the enclosing graph or external references.
 */
export function resolveEventStormingNodeSemantics(
  node: ZlozNode,
): ZlozEventStormingNodeSemantics | null {
  const architecture = node.architecture;
  if (architecture?.family !== 'event-storming') return null;
  if (
    !validNodeArchitectureFields(node) ||
    (architecture.role === 'lane' && node.ports.length !== 0)
  )
    throw new ZlozError(
      'invalid-graph',
      'Invalid workshop descriptor, node kind or port contract.',
    );
  switch (architecture.role) {
    case 'hotspot':
      return { kind: 'annotation', role: 'hotspot', status: architecture.status };
    case 'lane':
      return { kind: 'frame', role: 'lane' };
    default:
      return { kind: 'participant', role: architecture.role };
  }
}
