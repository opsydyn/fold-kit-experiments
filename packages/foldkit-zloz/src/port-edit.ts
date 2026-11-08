import type { EditorPolicy, ZlozGraph, PortEditCandidate } from './types';

/** Shared capability reason for host controls and reducer enforcement, with a usable fallback for blank denials. */
export function portEditReason(
  candidate: PortEditCandidate,
  graph: ZlozGraph,
  canEditPort?: EditorPolicy['canEditPort'],
): string | null {
  const reason = canEditPort?.(candidate, graph) ?? null;
  return reason === null ? null : reason.trim() || 'This port edit is protected.';
}
