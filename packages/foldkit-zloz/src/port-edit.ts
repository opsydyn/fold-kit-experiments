import type { EditorPolicy, ZlozGraph, PortEditCandidate } from './types';

/** Shared capability reason for host controls and reducer enforcement, with a usable fallback for blank denials. */
export function portEditReason(
  candidate: PortEditCandidate,
  graph: ZlozGraph,
  canEditPort?: EditorPolicy['canEditPort'],
): string | null {
  const reason = canEditPort?.(candidate, graph) ?? null;
  if (reason !== null) return reason.trim() || 'This port edit is protected.';
  if (candidate.operation === 'add' && candidate.node.kind === 'group')
    return 'Groups are portless frames.';
  if (
    candidate.operation === 'add' &&
    candidate.node.architecture?.family === 'event-storming' &&
    candidate.node.architecture.role === 'hotspot'
  )
    return 'Hotspots are portless annotations.';
  return null;
}
