import type { EventStormingEdgeArchitecture } from './architecture';
import {
  eventStormingRelationshipKey,
  checkedEventStormingRelationshipRules,
  resolveEventStormingRelationship,
  type ZlozEventStormingRelationshipOptions,
  type ZlozEventStormingRelationshipRule,
} from './event-storming-relationships';
import type { EditorEvent, EditorPolicy, EditorState, ZlozEdge } from './types';
export type ZlozEventStormingRelationshipRequest =
  | Readonly<{ type: 'RelationshipSelected'; edgeId: string; key: string | null }>
  | Readonly<{ type: 'InferenceApplied'; edgeId: string }>;
export type ZlozEventStormingRelationshipControlsOptions = Readonly<{
  conventions?: ZlozEventStormingRelationshipOptions;
  /** The same live policy used by updateEditor. Merely rendering controls never enables enforcement. */
  policy?: EditorPolicy;
  blockedReason?: string | null;
  label?: string;
  clearLabel?: string;
  inferenceLabel?: string;
  labelRule?: (rule: ZlozEventStormingRelationshipRule) => string;
}>;
export type ZlozEventStormingRelationshipChoice = Readonly<{
  key: string | null;
  label: string;
  architecture: EventStormingEdgeArchitecture | null;
  reason: string | null;
  compatibilityReason: string | null;
  /** An unfamiliar stored key is displayed faithfully, but cannot be dispatched as a new choice. */
  currentOnly: boolean;
}>;
export type ZlozEventStormingRelationshipInference = Readonly<{
  label: string;
  reason: string | null;
  architecture: EventStormingEdgeArchitecture | null;
  request: Extract<ZlozEventStormingRelationshipRequest, { type: 'InferenceApplied' }> | null;
}>;
export type ZlozEventStormingRelationshipControlsContext = Readonly<{
  edge: ZlozEdge | null;
  value: string | null;
  label: string;
  reason: string | null;
  choices: readonly ZlozEventStormingRelationshipChoice[];
  inference: ZlozEventStormingRelationshipInference;
  statusText: string;
}>;
export type ZlozEventStormingRelationshipEditDecision =
  | Readonly<{ type: 'ready'; event: Extract<EditorEvent, { type: 'EdgeArchitectureChanged' }> }>
  | Readonly<{ type: 'unchanged' }>
  | Readonly<{ type: 'ignored' }>
  | Readonly<{ type: 'blocked'; reason: string }>;
const denial = (reason: string | null | undefined): string | null =>
  reason == null ? null : reason.trim() || 'Relationship editing is unavailable.';
function candidate(edge: ZlozEdge, architecture: EventStormingEdgeArchitecture | null): ZlozEdge {
  const { architecture: _architecture, ...without } = edge;
  return architecture === null ? without : { ...edge, architecture };
}
function editReason(
  state: EditorState,
  edge: ZlozEdge,
  architecture: EventStormingEdgeArchitecture | null,
  reason: string | null,
  options: ZlozEventStormingRelationshipControlsOptions,
): string | null {
  return (
    reason ??
    denial(
      options.policy?.canChangeEdgeArchitecture?.(edge, candidate(edge, architecture), state.graph),
    )
  );
}
/** Derive controls from current graph truth. Compatibility diagnostics do not silently turn on validation. */
export function resolveEventStormingRelationshipControls(
  state: EditorState,
  edgeId: string | null,
  options: ZlozEventStormingRelationshipControlsOptions = {},
): ZlozEventStormingRelationshipControlsContext {
  const edge = state.graph.edges.find((item) => item.id === edgeId) ?? null;
  const reason =
    denial(options.blockedReason) ??
    (state.readOnly
      ? 'This diagram is read-only.'
      : state.gesture.type !== 'idle'
        ? 'Finish the current gesture before editing relationships.'
        : !edge
          ? 'Select a connection to edit its relationship.'
          : null);
  const value = edge?.architecture ? eventStormingRelationshipKey(edge.architecture) : null;
  const conventions = options.conventions ?? {};
  const rules = checkedEventStormingRelationshipRules(conventions);
  function choice(
    architecture: EventStormingEdgeArchitecture | null,
    label: string,
    currentOnly = false,
  ): ZlozEventStormingRelationshipChoice {
    const decision = edge
      ? resolveEventStormingRelationship(state.graph, candidate(edge, architecture), conventions)
      : null;
    return {
      key: architecture ? eventStormingRelationshipKey(architecture) : null,
      label,
      architecture,
      currentOnly,
      reason: currentOnly
        ? (reason ?? 'This stored relationship is outside the current catalogue.')
        : edge
          ? editReason(state, edge, architecture, reason, options)
          : reason,
      compatibilityReason: decision?.type === 'blocked' ? decision.reason : null,
    };
  }
  const choices = edge
    ? [
        choice(null, options.clearLabel?.trim() || 'Untyped / inferred'),
        ...rules.map((rule) =>
          choice(
            value === eventStormingRelationshipKey(rule.architecture)
              ? (edge.architecture ?? rule.architecture)
              : rule.architecture,
            options.labelRule?.(rule).trim() || rule.label,
          ),
        ),
      ]
    : [];
  if (edge?.architecture && !choices.some((item) => item.key === value))
    choices.push(choice(edge.architecture, `Stored relationship: ${value}`, true));
  const inferred = edge
    ? resolveEventStormingRelationship(state.graph, candidate(edge, null), conventions)
    : null;
  const inferredArchitecture = inferred?.type === 'allowed' ? inferred.architecture : null;
  const inferenceReason =
    reason ??
    (inferred?.type === 'blocked'
      ? inferred.reason
      : !inferredArchitecture
        ? 'These nodes have no causal meaning to infer.'
        : value === eventStormingRelationshipKey(inferredArchitecture)
          ? 'This relationship already has explicit meaning.'
          : edge
            ? editReason(state, edge, inferredArchitecture, null, options)
            : 'Select a connection to infer its relationship.');
  const current = edge ? resolveEventStormingRelationship(state.graph, edge, conventions) : null;
  return {
    edge,
    value,
    label: options.label?.trim() || 'Causal relationship type',
    reason,
    choices,
    inference: {
      label: options.inferenceLabel?.trim() || 'Apply inferred relationship',
      reason: inferenceReason,
      architecture: inferredArchitecture,
      request: edge ? { type: 'InferenceApplied', edgeId: edge.id } : null,
    },
    statusText:
      current?.type === 'allowed'
        ? `${current.inferred ? 'Inferred' : 'Typed'}: ${current.rule.label}.`
        : current?.type === 'blocked'
          ? `Unresolved: ${current.reason}`
          : edge
            ? 'This connection has no event-storming meaning.'
            : 'No relationship selected.',
  };
}
/** Fresh inspector identity, catalogue and policy decide the event; ready is not a lasting permission grant. */
export function resolveEventStormingRelationshipRequest(
  state: EditorState,
  edgeId: string | null,
  request: ZlozEventStormingRelationshipRequest,
  options: ZlozEventStormingRelationshipControlsOptions = {},
): ZlozEventStormingRelationshipEditDecision {
  if (edgeId !== request.edgeId || !state.graph.edges.some((edge) => edge.id === request.edgeId))
    return { type: 'ignored' };
  const context = resolveEventStormingRelationshipControls(state, edgeId, options);
  if (request.type === 'InferenceApplied')
    return context.inference.reason
      ? { type: 'blocked', reason: context.inference.reason }
      : context.inference.architecture
        ? {
            type: 'ready',
            event: {
              type: 'EdgeArchitectureChanged',
              id: request.edgeId,
              architecture: context.inference.architecture,
            },
          }
        : { type: 'ignored' };
  const selected = context.choices.find(
    (choice) => choice.key === request.key && !choice.currentOnly,
  );
  if (!selected) return { type: 'ignored' };
  if (selected.reason) return { type: 'blocked', reason: selected.reason };
  return request.key === context.value
    ? { type: 'unchanged' }
    : {
        type: 'ready',
        event: {
          type: 'EdgeArchitectureChanged',
          id: request.edgeId,
          architecture: selected.architecture,
        },
      };
}
