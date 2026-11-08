/**
 * Lightweight eligibility checks without loading the force engine.
 * @module ForceEligibility
 */
import type { ZlozGraph } from '@opsydyn/foldkit-zloz';

/** Supports non-empty flat graphs of at most 100 nodes; groups require another layout adapter. */
export function supportsForceLayout(graph: ZlozGraph): boolean {
  return (
    graph.nodes.length > 0 &&
    graph.nodes.length <= 100 &&
    graph.nodes.every((node) => node.kind !== 'group')
  );
}
