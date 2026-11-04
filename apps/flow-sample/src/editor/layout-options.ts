import type { FlowGraph } from '@opsydyn/foldkit-flow';

export function supportsForceLayout(graph: FlowGraph): boolean {
  return (
    graph.nodes.length > 0 &&
    graph.nodes.length <= 100 &&
    graph.nodes.every((node) => node.kind !== 'group')
  );
}
