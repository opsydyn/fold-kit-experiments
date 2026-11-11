import {
  isDddEdgeArchitecture,
  type DddEdgeArchitecture,
  type DddNodeArchitecture,
} from './architecture';
import { ZlozError } from './graph';
import type { ZlozGraph, ZlozEdge, ZlozNode, EditorPolicy } from './types';
/** Logical identity only. This value does not invent ports or create a drawable edge. */
export type ZlozDddRelationship = Readonly<{
  sourceNodeId: string;
  targetNodeId: string;
  architecture: DddEdgeArchitecture;
}>;
export type ZlozDddRelationshipRule = Readonly<{
  architecture: DddEdgeArchitecture;
  sources: readonly DddNodeArchitecture['role'][];
  targets: readonly DddNodeArchitecture['role'][];
  label: string;
  direction: 'directed' | 'symmetric';
}>;
export type ZlozDddRelationshipOptions = Readonly<{ rules?: readonly ZlozDddRelationshipRule[] }>;
export type ZlozDddRelationshipDecision =
  | Readonly<{
      type: 'allowed';
      architecture: DddEdgeArchitecture;
      rule: ZlozDddRelationshipRule;
      direction: 'directed' | 'symmetric';
    }>
  | Readonly<{
      type: 'blocked';
      code:
        | 'invalid-descriptor'
        | 'missing-node'
        | 'unsupported-role'
        | 'same-context'
        | 'unknown-relationship'
        | 'incompatible-roles';
      reason: string;
    }>;
const tacticalRoles: readonly DddNodeArchitecture['role'][] = [
  'entity',
  'value-object',
  'aggregate-root',
  'aggregate',
  'domain-event',
  'domain-service',
  'repository',
];
const roles: readonly DddNodeArchitecture['role'][] = [...tacticalRoles, 'bounded-context'];
function rule(
  architecture: DddEdgeArchitecture,
  sources: readonly DddNodeArchitecture['role'][],
  targets: readonly DddNodeArchitecture['role'][],
  label: string,
  direction: 'directed' | 'symmetric' = 'directed',
): ZlozDddRelationshipRule {
  return Object.freeze({
    architecture: Object.freeze(architecture),
    sources: Object.freeze([...sources]),
    targets: Object.freeze([...targets]),
    label,
    direction,
  });
}
/** Explicit toolkit conventions, not inference or executable domain invariants. */
export const dddRelationshipRules: readonly ZlozDddRelationshipRule[] = Object.freeze([
  rule(
    { family: 'ddd', scope: 'tactical', role: 'references' },
    ['entity', 'value-object', 'aggregate-root', 'domain-service'],
    ['entity', 'value-object', 'aggregate-root'],
    'References',
  ),
  rule(
    { family: 'ddd', scope: 'tactical', role: 'contains' },
    ['aggregate', 'aggregate-root', 'entity', 'value-object'],
    ['entity', 'value-object', 'aggregate-root'],
    'Contains',
  ),
  rule(
    { family: 'ddd', scope: 'tactical', role: 'emits' },
    ['aggregate', 'aggregate-root', 'entity', 'domain-service'],
    ['domain-event'],
    'Emits',
  ),
  rule(
    { family: 'ddd', scope: 'tactical', role: 'persists' },
    ['repository'],
    ['entity', 'aggregate-root'],
    'Persists',
  ),
  rule(
    { family: 'ddd', scope: 'tactical', role: 'uses' },
    ['entity', 'aggregate-root', 'domain-service'],
    ['domain-service', 'repository'],
    'Uses',
  ),
  rule(
    { family: 'ddd', scope: 'strategic', role: 'partnership' },
    ['bounded-context'],
    ['bounded-context'],
    'Partnership',
    'symmetric',
  ),
  rule(
    { family: 'ddd', scope: 'strategic', role: 'shared-kernel' },
    ['bounded-context'],
    ['bounded-context'],
    'Shared kernel',
    'symmetric',
  ),
  rule(
    { family: 'ddd', scope: 'strategic', role: 'upstream-downstream' },
    ['bounded-context'],
    ['bounded-context'],
    'Upstream → downstream',
  ),
  rule(
    { family: 'ddd', scope: 'strategic', role: 'customer-supplier' },
    ['bounded-context'],
    ['bounded-context'],
    'Supplier → customer',
  ),
]);
/** Scope prevents tactical and strategic named custom roles from colliding. Side roles/description decorate the same relationship key. */
export function dddRelationshipKey(value: DddEdgeArchitecture): string {
  return `${value.scope}:${value.role}${value.role === 'custom' ? `:${value.name}` : ''}`;
}
function isRuleLabel(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
function checkedRules(options: ZlozDddRelationshipOptions) {
  const rules = options.rules ?? dddRelationshipRules;
  const keys = new Set<string>();
  for (const item of rules) {
    if (
      !isDddEdgeArchitecture(item.architecture) ||
      !isRuleLabel(item.label) ||
      !Array.isArray(item.sources) ||
      !Array.isArray(item.targets) ||
      !item.sources.length ||
      !item.targets.length ||
      [...item.sources, ...item.targets].some((value) => !roles.includes(value)) ||
      (item.direction !== 'directed' && item.direction !== 'symmetric') ||
      keys.has(dddRelationshipKey(item.architecture))
    )
      throw new ZlozError(
        'invalid-edit',
        'DDD rules require unique valid descriptors, participant roles, a label and direction.',
      );
    const strategic = item.architecture.scope === 'strategic';
    if (
      strategic
        ? [...item.sources, ...item.targets].some((role) => role !== 'bounded-context')
        : [...item.sources, ...item.targets].some((role) => role === 'bounded-context')
    )
      throw new ZlozError(
        'invalid-edit',
        'DDD rule participants must match their tactical or strategic scope.',
      );
    const expected =
      item.architecture.role === 'partnership' || item.architecture.role === 'shared-kernel'
        ? 'symmetric'
        : 'directed';
    if (item.architecture.role !== 'custom' && item.direction !== expected)
      throw new ZlozError(
        'invalid-edit',
        'Built-in DDD relationships retain their declared direction.',
      );
    keys.add(dddRelationshipKey(item.architecture));
  }
  return rules;
}
/** Pure logical validation. Structural graph validity, ports, policy and editing lifecycle are separate boundaries. */
export function resolveDddRelationship(
  graph: ZlozGraph,
  relationship: ZlozDddRelationship,
  options: ZlozDddRelationshipOptions = {},
): ZlozDddRelationshipDecision {
  const rules = checkedRules(options),
    architecture = relationship.architecture;
  if (!isDddEdgeArchitecture(architecture))
    return {
      type: 'blocked',
      code: 'invalid-descriptor',
      reason: 'The DDD relationship descriptor is invalid.',
    };
  const source = graph.nodes.find((node) => node.id === relationship.sourceNodeId),
    target = graph.nodes.find((node) => node.id === relationship.targetNodeId);
  if (!source || !target)
    return {
      type: 'blocked',
      code: 'missing-node',
      reason: 'Both DDD participants must exist in the current graph.',
    };
  const from = source.architecture?.family === 'ddd' ? source.architecture.role : null,
    to = target.architecture?.family === 'ddd' ? target.architecture.role : null;
  if (!from || !to)
    return {
      type: 'blocked',
      code: 'unsupported-role',
      reason: 'Both participants require explicit DDD node roles.',
    };
  if (architecture.scope === 'strategic' && source.id === target.id)
    return {
      type: 'blocked',
      code: 'same-context',
      reason: 'A strategic relationship requires two distinct bounded contexts.',
    };
  const selected = rules.find(
    (item) => dddRelationshipKey(item.architecture) === dddRelationshipKey(architecture),
  );
  if (!selected)
    return {
      type: 'blocked',
      code: 'unknown-relationship',
      reason: 'This DDD relationship is outside the current convention.',
    };
  const forward = selected.sources.includes(from) && selected.targets.includes(to);
  const reverse =
    selected.direction === 'symmetric' &&
    selected.sources.includes(to) &&
    selected.targets.includes(from);
  if (!forward && !reverse)
    return {
      type: 'blocked',
      code: 'incompatible-roles',
      reason: `This convention does not allow ${dddRelationshipKey(architecture)} from ${from} to ${to}.`,
    };
  return { type: 'allowed', architecture, rule: selected, direction: selected.direction };
}
const denial = (reason: string | null | undefined): string | null =>
  reason == null ? null : reason.trim() || 'DDD relationship editing is unavailable.';
function relationshipReason(
  graph: ZlozGraph,
  edge: ZlozEdge,
  options: ZlozDddRelationshipOptions,
): string | null {
  if (edge.architecture?.family !== 'ddd') return null;
  const result = resolveDddRelationship(
    graph,
    {
      sourceNodeId: edge.source.node,
      targetNodeId: edge.target.node,
      architecture: edge.architecture,
    },
    options,
  );
  return result.type === 'blocked' ? result.reason : null;
}
function incidentReason(
  graph: ZlozGraph,
  node: ZlozNode,
  next: ZlozNode,
  options: ZlozDddRelationshipOptions,
): string | null {
  const candidate = {
    ...graph,
    nodes: graph.nodes.map((item) => (item.id === node.id ? next : item)),
  };
  for (const edge of graph.edges) {
    if (edge.source.node !== node.id && edge.target.node !== node.id) continue;
    const reason = relationshipReason(candidate, edge, options);
    if (reason) return `${edge.label || edge.id}: ${reason}`;
  }
  return null;
}
/** Opt-in family-aware composition. No inference; existing host vetoes and editor structural checks retain precedence. */
export function dddRelationshipPolicy(
  options: ZlozDddRelationshipOptions = {},
  base: EditorPolicy = {},
): EditorPolicy {
  checkedRules(options);
  return {
    ...base,
    canConnect: (edge, graph) =>
      denial(base.canConnect?.(edge, graph)) ?? relationshipReason(graph, edge, options),
    canChangeEdgeArchitecture: (edge, next, graph) =>
      denial(base.canChangeEdgeArchitecture?.(edge, next, graph)) ??
      relationshipReason(graph, next, options),
    canChangeNodeArchitecture: (node, next, graph) =>
      denial(base.canChangeNodeArchitecture?.(node, next, graph)) ??
      incidentReason(graph, node, next, options),
  };
}
