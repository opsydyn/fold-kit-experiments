import {
  copyEdgeArchitecture,
  sameEdgeArchitecture,
  type DddEdgeArchitecture,
} from './architecture';
import {
  checkedDddRelationshipRules,
  dddRelationshipKey,
  resolveDddRelationship,
  type ZlozDddRelationshipOptions,
  type ZlozDddRelationshipRule,
} from './ddd-relationships';
import type { EditorEvent, EditorPolicy, EditorState, ZlozEdge } from './types';
type Directional = Extract<
  DddEdgeArchitecture,
  { role: 'upstream-downstream' | 'customer-supplier' }
>;
export type ZlozDddUpstreamRole = NonNullable<Directional['upstream']>[number];
export type ZlozDddDownstreamRole = NonNullable<Directional['downstream']>;
type Scope = Readonly<{ edgeId: string; revision: number }>;
export type ZlozDddRelationshipRequest = Scope &
  (
    | Readonly<{ type: 'PatternSelected'; key: string | null }>
    | Readonly<{ type: 'UpstreamRoleChanged'; role: ZlozDddUpstreamRole; enabled: boolean }>
    | Readonly<{ type: 'DownstreamRoleSelected'; role: ZlozDddDownstreamRole | null }>
  );
export type ZlozDddRelationshipChoice = Readonly<{
  key: string | null;
  label: string;
  architecture: DddEdgeArchitecture | null;
  currentOnly: boolean;
  reason: string | null;
  compatibilityReason: string | null;
}>;
export type ZlozDddUpstreamControl = Readonly<{
  role: ZlozDddUpstreamRole;
  label: string;
  checked: boolean;
  reason: string | null;
}>;
export type ZlozDddDownstreamChoice = Readonly<{
  value: ZlozDddDownstreamRole | null;
  label: string;
  reason: string | null;
}>;
export type ZlozDddRelationshipControlsContext = Readonly<{
  edge: ZlozEdge | null;
  revision: number;
  reason: string | null;
  pattern: Readonly<{
    label: string;
    value: string | null;
    choices: readonly ZlozDddRelationshipChoice[];
    reason: string | null;
  }>;
  upstream: readonly ZlozDddUpstreamControl[];
  downstream: Readonly<{
    label: string;
    value: ZlozDddDownstreamRole | null;
    choices: readonly ZlozDddDownstreamChoice[];
    reason: string | null;
  }> | null;
  statusText: string;
}>;
export type ZlozDddRelationshipControlsOptions = Readonly<{
  conventions?: ZlozDddRelationshipOptions;
  policy?: EditorPolicy;
  blockedReason?: string | null;
  patternLabel?: string;
  clearLabel?: string;
  downstreamLabel?: string;
  noDownstreamLabel?: string;
  labelRule?: (rule: ZlozDddRelationshipRule) => string;
  upstreamLabels?: Partial<Readonly<Record<ZlozDddUpstreamRole, string>>>;
  downstreamLabels?: Partial<Readonly<Record<ZlozDddDownstreamRole, string>>>;
}>;
export type ZlozDddRelationshipEditDecision =
  | Readonly<{ type: 'ready'; event: Extract<EditorEvent, { type: 'EdgeArchitectureChanged' }> }>
  | Readonly<{ type: 'blocked'; reason: string }>
  | Readonly<{ type: 'unchanged' }>
  | Readonly<{ type: 'ignored' }>;
const upstreamRoles: readonly ZlozDddUpstreamRole[] = ['open-host-service', 'published-language'];
const downstreamRoles: readonly ZlozDddDownstreamRole[] = ['conformist', 'anti-corruption-layer'];
const denial = (reason: string | null | undefined): string | null =>
  reason == null ? null : reason.trim() || 'DDD relationship editing is unavailable.';
function directional(value: DddEdgeArchitecture | null): value is Directional {
  return (
    value?.scope === 'strategic' &&
    (value.role === 'upstream-downstream' || value.role === 'customer-supplier')
  );
}
function candidate(edge: ZlozEdge, architecture: DddEdgeArchitecture | null): ZlozEdge {
  const { architecture: _previous, ...rest } = edge;
  return architecture === null ? rest : { ...rest, architecture };
}
function editReason(
  state: EditorState,
  edge: ZlozEdge,
  next: DddEdgeArchitecture | null,
  reason: string | null,
  options: ZlozDddRelationshipControlsOptions,
) {
  return (
    reason ??
    denial(options.policy?.canChangeEdgeArchitecture?.(edge, candidate(edge, next), state.graph))
  );
}
function patternValue(
  current: DddEdgeArchitecture | null,
  rule: ZlozDddRelationshipRule,
): DddEdgeArchitecture {
  if (current && dddRelationshipKey(current) === dddRelationshipKey(rule.architecture))
    return current;
  let next = rule.architecture;
  if (current?.description !== undefined) next = { ...next, description: current.description };
  if (directional(current) && directional(next)) {
    const { upstream: _defaultUpstream, downstream: _defaultDownstream, ...withoutSides } = next;
    next = withoutSides;
    if (current.upstream !== undefined) next = { ...next, upstream: [...current.upstream] };
    if (current.downstream !== undefined) next = { ...next, downstream: current.downstream };
  }
  return next;
}
function upstreamValue(
  current: Directional,
  role: ZlozDddUpstreamRole,
  enabled: boolean,
): Directional {
  const previous = current.upstream ?? [];
  const roles = enabled
    ? previous.includes(role)
      ? previous
      : [...previous, role]
    : previous.filter((item) => item !== role);
  const { upstream: _previous, ...without } = current;
  return roles.length ? { ...without, upstream: roles } : without;
}
function downstreamValue(current: Directional, role: ZlozDddDownstreamRole | null): Directional {
  const { downstream: _previous, ...without } = current;
  return role === null ? without : { ...without, downstream: role };
}
function allRestricted<T extends { reason: string | null }>(
  choices: readonly T[],
  fallback: string,
): string | null {
  return choices.some((choice) => choice.reason === null)
    ? null
    : (choices.find((choice) => choice.reason !== null)?.reason ?? fallback);
}
/** Current graph truth only. Compatibility diagnostics never enable enforcement or mutate authored meaning. */
export function resolveDddRelationshipControls(
  state: EditorState,
  edgeId: string | null,
  options: ZlozDddRelationshipControlsOptions = {},
): ZlozDddRelationshipControlsContext {
  const rules = checkedDddRelationshipRules(options.conventions ?? {});
  const edge = state.graph.edges.find((edge) => edge.id === edgeId) ?? null;
  const current = edge?.architecture?.family === 'ddd' ? edge.architecture : null;
  const foreign = edge?.architecture !== undefined && current === null;
  const reason =
    denial(options.blockedReason) ??
    (state.readOnly
      ? 'This diagram is read-only.'
      : state.gesture.type !== 'idle'
        ? 'Finish the current gesture before editing DDD meaning.'
        : !edge
          ? 'Select a connection to edit DDD meaning.'
          : foreign
            ? 'Stored EventStorming meaning is protected. Use its own controls before assigning DDD meaning.'
            : null);
  const value = current ? dddRelationshipKey(current) : foreign ? 'foreign:event-storming' : null;
  function choice(
    architecture: DddEdgeArchitecture | null,
    label: string,
    currentOnly = false,
  ): ZlozDddRelationshipChoice {
    const result =
      edge && architecture
        ? resolveDddRelationship(
            state.graph,
            { sourceNodeId: edge.source.node, targetNodeId: edge.target.node, architecture },
            options.conventions,
          )
        : null;
    return {
      key: architecture ? dddRelationshipKey(architecture) : null,
      label,
      architecture,
      currentOnly,
      reason: currentOnly
        ? 'This stored pattern is outside the current catalogue.'
        : edge
          ? editReason(state, edge, architecture, reason, options)
          : reason,
      compatibilityReason: result?.type === 'blocked' ? result.reason : null,
    };
  }
  const choices: ZlozDddRelationshipChoice[] = foreign
    ? [
        {
          key: value,
          label: 'EventStorming meaning (preserved)',
          architecture: null,
          currentOnly: true,
          reason,
          compatibilityReason: null,
        },
      ]
    : edge
      ? [
          choice(null, options.clearLabel?.trim() || 'No DDD meaning'),
          ...rules.map((rule) =>
            choice(
              patternValue(current, rule),
              options.labelRule?.(rule).trim() || `${rule.label} · ${rule.architecture.scope}`,
            ),
          ),
        ]
      : [];
  if (current && !choices.some((choice) => choice.key === value))
    choices.push(choice(current, `Stored custom pattern: ${value}`, true));
  const upstream =
    directional(current) && edge
      ? upstreamRoles.map((role) => ({
          role,
          label:
            options.upstreamLabels?.[role]?.trim() ||
            (role === 'open-host-service' ? 'Open host service' : 'Published language'),
          checked: current.upstream?.includes(role) ?? false,
          reason: editReason(
            state,
            edge,
            upstreamValue(current, role, !(current.upstream?.includes(role) ?? false)),
            reason,
            options,
          ),
        }))
      : [];
  const downstreamChoices: ZlozDddDownstreamChoice[] =
    directional(current) && edge
      ? [
          {
            value: null,
            label: options.noDownstreamLabel?.trim() || 'None',
            reason: editReason(state, edge, downstreamValue(current, null), reason, options),
          },
          ...downstreamRoles.map((role) => ({
            value: role,
            label:
              options.downstreamLabels?.[role]?.trim() ||
              (role === 'conformist' ? 'Conformist' : 'Anti-corruption layer'),
            reason: editReason(state, edge, downstreamValue(current, role), reason, options),
          })),
        ]
      : [];
  const result =
    current && edge
      ? resolveDddRelationship(
          state.graph,
          { sourceNodeId: edge.source.node, targetNodeId: edge.target.node, architecture: current },
          options.conventions,
        )
      : null;
  return {
    edge,
    revision: state.revision,
    reason,
    pattern: {
      label: options.patternLabel?.trim() || 'DDD relationship pattern',
      value,
      choices,
      reason:
        reason ??
        allRestricted(
          choices.filter((choice) => !choice.currentOnly && choice.key !== value),
          'No pattern change is available.',
        ),
    },
    upstream,
    downstream: directional(current)
      ? {
          label: options.downstreamLabel?.trim() || 'Downstream role',
          value: current.downstream ?? null,
          choices: downstreamChoices,
          reason:
            reason ??
            allRestricted(
              downstreamChoices.filter((choice) => choice.value !== (current.downstream ?? null)),
              'No downstream role change is available.',
            ),
        }
      : null,
    statusText: foreign
      ? 'This connection carries EventStorming meaning.'
      : result?.type === 'allowed'
        ? `DDD: ${result.rule.label}.`
        : result?.type === 'blocked'
          ? `Unresolved: ${result.reason}`
          : edge
            ? 'No DDD meaning is assigned.'
            : 'No connection selected.',
  };
}
/** Recheck inspector, revision, current conventions and host policy. Apply ready events immediately through updateEditor with the same policy. */
export function resolveDddRelationshipRequest(
  state: EditorState,
  edgeId: string | null,
  request: ZlozDddRelationshipRequest,
  options: ZlozDddRelationshipControlsOptions = {},
): ZlozDddRelationshipEditDecision {
  if (request.edgeId !== edgeId || request.revision !== state.revision) return { type: 'ignored' };
  const context = resolveDddRelationshipControls(state, edgeId, options),
    edge = context.edge;
  if (!edge) return { type: 'ignored' };
  if (context.reason !== null) return { type: 'blocked', reason: context.reason };
  const current = edge.architecture?.family === 'ddd' ? edge.architecture : null;
  function result(next: DddEdgeArchitecture | null): ZlozDddRelationshipEditDecision {
    if (sameEdgeArchitecture(edge?.architecture, next ?? undefined)) return { type: 'unchanged' };
    if (!edge) return { type: 'ignored' };
    const reason = editReason(state, edge, next, context.reason, options);
    return reason === null
      ? {
          type: 'ready',
          event: {
            type: 'EdgeArchitectureChanged',
            id: edge.id,
            architecture: next === null ? null : copyEdgeArchitecture(next),
          },
        }
      : { type: 'blocked', reason };
  }
  switch (request.type) {
    case 'PatternSelected': {
      const choice = context.pattern.choices.find(
        (choice) => choice.key === request.key && !choice.currentOnly,
      );
      return choice ? result(choice.architecture) : { type: 'ignored' };
    }
    case 'UpstreamRoleChanged': {
      if (
        !directional(current) ||
        !context.upstream.some((control) => control.role === request.role) ||
        (request.enabled !== true && request.enabled !== false)
      )
        return { type: 'ignored' };
      return result(upstreamValue(current, request.role, request.enabled));
    }
    case 'DownstreamRoleSelected': {
      if (
        !directional(current) ||
        !context.downstream?.choices.some((choice) => choice.value === request.role)
      )
        return { type: 'ignored' };
      return result(downstreamValue(current, request.role));
    }
    default:
      return { type: 'ignored' };
  }
}
