/**
 * Lightweight eligibility checks without loading the force engine.
 * @module ForceEligibility
 */
import type { FlowGraph } from '@opsydyn/foldkit-flow';

/** Supports non-empty flat graphs of at most 100 nodes; groups require another layout adapter. */
export function supportsForceLayout(graph: FlowGraph): boolean {
  return (
    graph.nodes.length > 0 &&
    graph.nodes.length <= 100 &&
    graph.nodes.every((node) => node.kind !== 'group')
  );
}
