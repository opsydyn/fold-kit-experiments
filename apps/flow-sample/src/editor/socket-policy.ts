import type { Endpoint, FlowGraph } from '@opsydyn/foldkit-flow';
import { Schema } from 'effect';

const guardedData = Schema.is(
  Schema.Struct({
    socketPolicies: Schema.Array(Schema.Struct({ port: Schema.String, reason: Schema.String })),
  }),
);
const endpointKey = ({ node, port }: Endpoint) => JSON.stringify([node, port]);

/** Example metadata becomes a fresh lookup per policy resolution, never a permission cache. */
export function fixtureSocketPolicy(graph: FlowGraph) {
  const reasons = new Map<string, string>();
  for (const node of graph.nodes) {
    if (!guardedData(node.data)) continue;
    for (const guard of node.data.socketPolicies) {
      if (guard.reason.trim() && node.ports.some(({ id }) => id === guard.port))
        reasons.set(endpointKey({ node: node.id, port: guard.port }), guard.reason);
    }
  }
  return (endpoint: Endpoint) => reasons.get(endpointKey(endpoint)) ?? null;
}
