import {
  eventStormingParticipantRole,
  resolveEventStormingEndpoints,
} from './event-storming-relationships';
import type { ZlozEdge, ZlozGraph, ZlozNode } from './types';

/** One modeled relationship, retaining its identity even when labels repeat. */
export type ZlozAggregateLink = Readonly<{
  edgeId: string;
  nodeId: string;
  label: string;
  evidence: 'typed' | 'inferred';
}>;
export type ZlozAggregateProjection = Readonly<{
  id: string;
  label: string;
  commands: readonly ZlozAggregateLink[];
  events: readonly (ZlozAggregateLink & { readonly policies: readonly ZlozAggregateLink[] })[];
}>;

/** Project the built-in causal convention in graph edge order. Selection is host-owned. */
export function projectAggregate(
  graph: ZlozGraph,
  selectedId: string | null,
): ZlozAggregateProjection | null {
  const aggregate = graph.nodes.find((node) => node.id === selectedId);
  if (!aggregate || eventStormingParticipantRole(aggregate) !== 'aggregate') return null;

  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  function link(
    edge: ZlozEdge,
    role: 'handles' | 'emits' | 'activates',
    node: ZlozNode | undefined,
  ): ZlozAggregateLink | undefined {
    if (!node) return undefined;
    const meaning = resolveEventStormingEndpoints(
      edge,
      nodes.get(edge.source.node),
      nodes.get(edge.target.node),
    );
    if (meaning.type !== 'allowed' || meaning.architecture.role !== role) return undefined;
    return {
      edgeId: edge.id,
      nodeId: node.id,
      label: node.label,
      evidence: meaning.inferred ? 'inferred' : 'typed',
    };
  }

  const commands: ZlozAggregateLink[] = [];
  const events: ZlozAggregateLink[] = [];
  const policies = new Map<string, ZlozAggregateLink[]>();
  for (const edge of graph.edges) {
    if (edge.target.node === aggregate.id) {
      const command = link(edge, 'handles', nodes.get(edge.source.node));
      if (command) commands.push(command);
    }
    if (edge.source.node === aggregate.id) {
      const event = link(edge, 'emits', nodes.get(edge.target.node));
      if (event) {
        events.push(event);
        policies.set(event.nodeId, []);
      }
    }
  }
  for (const edge of graph.edges) {
    const activated = policies.get(edge.source.node);
    if (!activated) continue;
    const policy = link(edge, 'activates', nodes.get(edge.target.node));
    if (policy) activated.push(policy);
  }
  return {
    id: aggregate.id,
    label: aggregate.label,
    commands,
    events: events.map((event) => ({ ...event, policies: policies.get(event.nodeId) ?? [] })),
  };
}
