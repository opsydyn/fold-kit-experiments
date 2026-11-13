import type { DddEdgeArchitecture } from './architecture';
import type { ZlozGraph } from './types';
/** A logical authored dependency. No ports, event filters or runtime effects are implied. */
export type ZlozDeclaredConsumption = Readonly<{ sourceNodeId: string; consumerNodeId: string }>;
/** Source → read model, intentionally distinct from strategic influence or runtime delivery. */
export const declaredConsumptionArchitecture: Extract<DddEdgeArchitecture, { role: 'feeds' }> =
  Object.freeze({ family: 'ddd', scope: 'tactical', role: 'feeds' });
export const declaredConsumptionSourceRoles = Object.freeze([
  'aggregate',
  'aggregate-root',
  'domain-event',
  'read-model',
] as const);
export type ZlozDeclaredConsumptionSourceRole = (typeof declaredConsumptionSourceRoles)[number];
export type ZlozDeclaredConsumptionDecision =
  | Readonly<{
      type: 'allowed';
      declaration: ZlozDeclaredConsumption;
      sourceRole: ZlozDeclaredConsumptionSourceRole;
      relationship: Readonly<{
        sourceNodeId: string;
        targetNodeId: string;
        architecture: typeof declaredConsumptionArchitecture;
      }>;
    }>
  | Readonly<{
      type: 'blocked';
      code: 'invalid-descriptor' | 'missing-node' | 'unsupported-role' | 'incompatible-roles';
      reason: string;
    }>;
/** Strict logical descriptor syntax. Graph/role compatibility is resolved separately. */
export function isDeclaredConsumption(value: unknown): value is ZlozDeclaredConsumption {
  return (
    typeof value === 'object' &&
    value !== null &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null) &&
    Object.keys(value).every((key) => key === 'sourceNodeId' || key === 'consumerNodeId') &&
    'sourceNodeId' in value &&
    typeof value.sourceNodeId === 'string' &&
    value.sourceNodeId.trim().length > 0 &&
    'consumerNodeId' in value &&
    typeof value.consumerNodeId === 'string' &&
    value.consumerNodeId.trim().length > 0
  );
}
function sourceRole(value: unknown): value is ZlozDeclaredConsumptionSourceRole {
  return declaredConsumptionSourceRoles.some((role) => role === value);
}
/** Read-only declaration resolution; never inference, execution or permission to mutate an editor. */
export function resolveDeclaredConsumption(
  graph: ZlozGraph,
  declaration: ZlozDeclaredConsumption,
): ZlozDeclaredConsumptionDecision {
  if (!isDeclaredConsumption(declaration))
    return {
      type: 'blocked',
      code: 'invalid-descriptor',
      reason: 'Declared consumption requires only nonblank sourceNodeId and consumerNodeId.',
    };
  const source = graph.nodes.find((node) => node.id === declaration.sourceNodeId),
    consumer = graph.nodes.find((node) => node.id === declaration.consumerNodeId);
  if (!source || !consumer)
    return {
      type: 'blocked',
      code: 'missing-node',
      reason: 'Both declarations must exist in the current graph.',
    };
  if (source.architecture?.family !== 'ddd' || consumer.architecture?.family !== 'ddd')
    return {
      type: 'blocked',
      code: 'unsupported-role',
      reason: 'Declared read-model consumption requires explicit DDD participant roles.',
    };
  if (!sourceRole(source.architecture.role) || consumer.architecture.role !== 'read-model')
    return {
      type: 'blocked',
      code: 'incompatible-roles',
      reason: 'An aggregate, event type or read model must feed a read model in this convention.',
    };
  return Object.freeze({
    type: 'allowed',
    declaration: Object.freeze({
      sourceNodeId: declaration.sourceNodeId,
      consumerNodeId: declaration.consumerNodeId,
    }),
    sourceRole: source.architecture.role,
    relationship: Object.freeze({
      sourceNodeId: source.id,
      targetNodeId: consumer.id,
      architecture: declaredConsumptionArchitecture,
    }),
  });
}
