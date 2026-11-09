import { isEdgeArchitecture, type EventStormingEdgeArchitecture } from './architecture';
import { ZlozError } from './graph';
import type { EditorPolicy, ZlozEdge, ZlozGraph, ZlozNode } from './types';
export type EventStormingParticipantRole =
  | 'actor'
  | 'command'
  | 'aggregate'
  | 'domain-event'
  | 'policy';
export type ZlozEventStormingRelationshipRule = Readonly<{
  architecture: EventStormingEdgeArchitecture;
  sources: readonly EventStormingParticipantRole[];
  targets: readonly EventStormingParticipantRole[];
  label: string;
}>;
export type ZlozEventStormingRelationshipOptions = Readonly<{
  /** Complete replacement catalogue; ambiguous untyped matches require an explicit descriptor. */
  rules?: readonly ZlozEventStormingRelationshipRule[];
  roleOf?: (node: ZlozNode) => EventStormingParticipantRole | null;
}>;
export type ZlozEventStormingRelationshipDecision =
  | Readonly<{
      type: 'allowed';
      architecture: EventStormingEdgeArchitecture;
      rule: ZlozEventStormingRelationshipRule;
      inferred: boolean;
    }>
  | Readonly<{ type: 'unrelated' }>
  | Readonly<{
      type: 'blocked';
      code:
        | 'missing-node'
        | 'unsupported-role'
        | 'unknown-relationship'
        | 'incompatible-roles'
        | 'ambiguous-relationship';
      reason: string;
    }>;
function rule(
  role: Exclude<EventStormingEdgeArchitecture['role'], 'custom'>,
  source: EventStormingParticipantRole,
  target: EventStormingParticipantRole,
  label: string,
): ZlozEventStormingRelationshipRule {
  return Object.freeze({
    architecture: Object.freeze({ family: 'event-storming', role }),
    sources: Object.freeze([source]),
    targets: Object.freeze([target]),
    label,
  });
}
/** Zloz process conventions, not executable rules or a universal EventStorming grammar. */
export const eventStormingRelationshipRules: readonly ZlozEventStormingRelationshipRule[] =
  Object.freeze([
    rule('issues', 'actor', 'command', 'Issues'),
    rule('handles', 'command', 'aggregate', 'Handled by'),
    rule('emits', 'aggregate', 'domain-event', 'Emits'),
    rule('produces', 'command', 'domain-event', 'Produces'),
    rule('activates', 'domain-event', 'policy', 'Activates'),
    rule('triggers', 'policy', 'command', 'Triggers'),
  ]);
export function eventStormingParticipantRole(node: ZlozNode): EventStormingParticipantRole | null {
  const value = node.architecture;
  return value?.family === 'event-storming'
    ? value.role
    : value?.family === 'ddd' && (value.role === 'aggregate' || value.role === 'aggregate-root')
      ? 'aggregate'
      : value?.family === 'ddd' && value.role === 'domain-event'
        ? 'domain-event'
        : null;
}
export function eventStormingRelationshipKey(value: EventStormingEdgeArchitecture): string {
  return value.role === 'custom' ? `custom:${value.name}` : value.role;
}
/** @internal Shared catalogue validation for core contexts and policy composition. */
export function checkedEventStormingRelationshipRules(
  options: ZlozEventStormingRelationshipOptions,
) {
  const rules = options.rules ?? eventStormingRelationshipRules;
  const ids = new Set<string>();
  for (const item of rules) {
    if (
      !isEdgeArchitecture(item.architecture) ||
      !item.label.trim() ||
      !item.sources.length ||
      !item.targets.length ||
      [...item.sources, ...item.targets].some(
        (role) => !['actor', 'command', 'aggregate', 'domain-event', 'policy'].includes(role),
      ) ||
      ids.has(eventStormingRelationshipKey(item.architecture))
    )
      throw new ZlozError(
        'invalid-edit',
        'Relationship rules require unique descriptors, nonempty labels and supported participant roles.',
      );
    ids.add(eventStormingRelationshipKey(item.architecture));
  }
  return rules;
}
/** Pure semantic resolution. Port direction, duplicates, permissions and editing lifecycle stay with the editor. */
export function resolveEventStormingRelationship(
  graph: ZlozGraph,
  edge: ZlozEdge,
  options: ZlozEventStormingRelationshipOptions = {},
): ZlozEventStormingRelationshipDecision {
  const rules = checkedEventStormingRelationshipRules(options);
  const source = graph.nodes.find((node) => node.id === edge.source.node),
    target = graph.nodes.find((node) => node.id === edge.target.node);
  if (!source || !target)
    return {
      type: 'blocked',
      code: 'missing-node',
      reason: 'Relationship endpoints must exist in the current graph.',
    };
  const roleOf = options.roleOf ?? eventStormingParticipantRole;
  const from = roleOf(source),
    to = roleOf(target);
  if (!edge.architecture && !from && !to) return { type: 'unrelated' };
  if (!from || !to)
    return {
      type: 'blocked',
      code: 'unsupported-role',
      reason: 'This relationship needs recognised event-storming participant roles at both ends.',
    };
  const architecture = edge.architecture;
  const candidates = architecture
    ? rules.filter(
        (item) =>
          eventStormingRelationshipKey(item.architecture) ===
          eventStormingRelationshipKey(architecture),
      )
    : rules;
  if (!candidates.length && edge.architecture)
    return {
      type: 'blocked',
      code: 'unknown-relationship',
      reason: 'The selected relationship is not available in this convention.',
    };
  const compatible = candidates.filter(
    (item) => item.sources.includes(from) && item.targets.includes(to),
  );
  if (!compatible.length)
    return {
      type: 'blocked',
      code: 'incompatible-roles',
      reason: `This convention does not allow ${edge.architecture ? eventStormingRelationshipKey(edge.architecture) : 'a causal relationship'} from ${from} to ${to}.`,
    };
  if (compatible.length > 1)
    return {
      type: 'blocked',
      code: 'ambiguous-relationship',
      reason: 'Several relationships fit these roles. Choose an explicit relationship.',
    };
  const selected = compatible[0];
  if (!selected) throw new ZlozError('invalid-edit', 'Missing relationship rule.');
  return {
    type: 'allowed',
    architecture: edge.architecture ?? selected.architecture,
    rule: selected,
    inferred: edge.architecture === undefined,
  };
}
const denial = (reason: string | null | undefined): string | null =>
  reason == null ? null : reason.trim() || 'Relationship editing is unavailable.';
function relationshipReason(
  graph: ZlozGraph,
  edge: ZlozEdge,
  options: ZlozEventStormingRelationshipOptions,
): string | null {
  const result = resolveEventStormingRelationship(graph, edge, options);
  return result.type === 'blocked' ? result.reason : null;
}
/** Opt-in composition: host vetoes retain precedence; editor port/permission checks are never replaced. */
export function eventStormingRelationshipPolicy(
  options: ZlozEventStormingRelationshipOptions = {},
  base: EditorPolicy = {},
): EditorPolicy {
  checkedEventStormingRelationshipRules(options);
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
function incidentReason(
  graph: ZlozGraph,
  node: ZlozNode,
  next: ZlozNode,
  options: ZlozEventStormingRelationshipOptions,
): string | null {
  const candidate = {
    ...graph,
    nodes: graph.nodes.map((value) => (value.id === node.id ? next : value)),
  };
  for (const edge of graph.edges) {
    if (edge.source.node !== node.id && edge.target.node !== node.id) continue;
    const reason = relationshipReason(candidate, edge, options);
    if (reason) return `${edge.label || edge.id}: ${reason}`;
  }
  return null;
}
