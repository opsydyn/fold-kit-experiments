import type { DddEdgeArchitecture } from './architecture';
import { createArchitectureNode } from './architecture-node';
import {
  dddRelationshipKey,
  dddRelationshipRules,
  resolveDddRelationship,
  type ZlozDddRelationshipOptions,
} from './ddd-relationships';
import { validateGraph } from './graph';
import type { ZlozEdge, ZlozGraph } from './types';
export type ZlozContextMapBadge = Readonly<{ text: string; description: string }>;
export type ZlozContextMapParticipant = Readonly<{
  id: string;
  name: string;
  badges: readonly ZlozContextMapBadge[];
}>;
export type ZlozContextMapRelationship = Readonly<{
  edge: ZlozEdge;
  architecture: DddEdgeArchitecture & Readonly<{ scope: 'strategic' }>;
  key: string;
  pattern: string;
  direction: 'directed' | 'symmetric' | null;
  source: ZlozContextMapParticipant;
  target: ZlozContextMapParticipant;
  reason: string | null;
}>;
const badge = (text: string, description = text): ZlozContextMapBadge => ({ text, description });
/** Read-only presentation of authored strategic intent; restrictions remain visible rather than rewriting the graph. */
export function resolveContextMapRelationship(
  graph: ZlozGraph,
  edge: ZlozEdge,
  options: ZlozDddRelationshipOptions = {},
): ZlozContextMapRelationship | null {
  const architecture = edge.architecture;
  if (architecture?.family !== 'ddd' || architecture.scope !== 'strategic') return null;
  const decision = resolveDddRelationship(
    graph,
    { sourceNodeId: edge.source.node, targetNodeId: edge.target.node, architecture },
    options,
  );
  const key = dddRelationshipKey(architecture);
  const rule =
    (options.rules ?? dddRelationshipRules).find(
      (item) => dddRelationshipKey(item.architecture) === key,
    ) ?? dddRelationshipRules.find((item) => dddRelationshipKey(item.architecture) === key);
  const directional =
    architecture.role === 'upstream-downstream' || architecture.role === 'customer-supplier';
  const customer = architecture.role === 'customer-supplier';
  const sourceBadges = directional
    ? [
        badge(customer ? 'Supplier' : 'Upstream', customer ? 'Supplier (upstream)' : 'Upstream'),
        ...(architecture.upstream ?? []).map((role) =>
          role === 'open-host-service'
            ? badge('OHS', 'Open host service')
            : badge('PL', 'Published language'),
        ),
      ]
    : [];
  const targetBadges = directional
    ? [
        badge(
          customer ? 'Customer' : 'Downstream',
          customer ? 'Customer (downstream)' : 'Downstream',
        ),
        ...(architecture.downstream
          ? [
              architecture.downstream === 'conformist'
                ? badge('CF', 'Conformist')
                : badge('ACL', 'Anti-corruption layer'),
            ]
          : []),
      ]
    : [];
  const participant = (
    id: string,
    badges: readonly ZlozContextMapBadge[],
  ): ZlozContextMapParticipant => ({
    id,
    name: graph.nodes.find((node) => node.id === id)?.label ?? id,
    badges,
  });
  return {
    edge,
    architecture: { ...architecture, scope: 'strategic' },
    key,
    pattern:
      rule?.label ?? (architecture.role === 'custom' ? architecture.name : architecture.role),
    direction: rule?.direction ?? null,
    source: participant(edge.source.node, sourceBadges),
    target: participant(edge.target.node, targetBadges),
    reason: decision.type === 'blocked' ? decision.reason : null,
  };
}
/** Detached, ordinary ported cards. Influence direction does not prescribe transport or message flow. */
export function createContextMapPattern(): ZlozGraph {
  const graph: ZlozGraph = {
    nodes: [
      {
        id: 'orders',
        label: 'Orders',
        position: { x: 80, y: 60 },
        subdomain: 'core' as const,
        description: 'Owns order intent and lifecycle.',
      },
      {
        id: 'billing',
        label: 'Billing',
        position: { x: 850, y: 60 },
        subdomain: 'supporting' as const,
        description: 'Translates order facts into billing decisions.',
      },
      {
        id: 'catalog',
        label: 'Catalog',
        position: { x: 80, y: 590 },
        subdomain: 'core' as const,
        description: 'Co-owns the product identifier vocabulary.',
      },
      {
        id: 'inventory',
        label: 'Inventory',
        position: { x: 850, y: 590 },
        subdomain: 'supporting' as const,
        description: 'Coordinates availability and fulfilment.',
      },
    ].map((item) =>
      createArchitectureNode({
        id: item.id,
        label: item.label,
        position: item.position,
        size: { width: 240, height: 150 },
        architecture: {
          family: 'ddd',
          role: 'bounded-context',
          subdomain: item.subdomain,
          description: item.description,
        },
        ports: [
          { id: 'in-left', kind: 'input', side: 'left', offset: 0.5 },
          { id: 'out-right', kind: 'output', side: 'right', offset: 0.5 },
          { id: 'in-top', kind: 'input', side: 'top', offset: 0.5 },
          { id: 'out-bottom', kind: 'output', side: 'bottom', offset: 0.5 },
        ],
      }),
    ),
    edges: [
      {
        id: 'orders-billing',
        label: 'Order facts',
        source: { node: 'orders', port: 'out-right' },
        target: { node: 'billing', port: 'in-left' },
        architecture: {
          family: 'ddd',
          scope: 'strategic',
          role: 'upstream-downstream',
          upstream: ['open-host-service', 'published-language'],
          downstream: 'anti-corruption-layer',
        },
      },
      {
        id: 'billing-inventory',
        label: 'Fulfilment agreement',
        source: { node: 'billing', port: 'out-bottom' },
        target: { node: 'inventory', port: 'in-top' },
        architecture: { family: 'ddd', scope: 'strategic', role: 'customer-supplier' },
      },
      {
        id: 'orders-catalog',
        label: 'Product identifiers',
        source: { node: 'orders', port: 'out-bottom' },
        target: { node: 'catalog', port: 'in-top' },
        architecture: { family: 'ddd', scope: 'strategic', role: 'shared-kernel' },
      },
      {
        id: 'catalog-inventory',
        label: 'Availability planning',
        source: { node: 'catalog', port: 'out-right' },
        target: { node: 'inventory', port: 'in-left' },
        architecture: { family: 'ddd', scope: 'strategic', role: 'partnership' },
      },
    ],
  };
  validateGraph(graph);
  return graph;
}
