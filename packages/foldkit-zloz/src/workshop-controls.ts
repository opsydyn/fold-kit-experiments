import {
  architectureNodePresets,
  validNodeArchitectureFields,
  type EventStormingNodeArchitecture,
} from './architecture';
import { presentEditorGroups } from './group-presentation';
import type { EditorEvent, EditorPolicy, EditorState, ZlozNode } from './types';
export type ZlozWorkshopScope = Readonly<{ nodeId: string; revision: number; descriptor: string }>;
export type ZlozWorkshopRequest = ZlozWorkshopScope &
  (
    | Readonly<{ type: 'RoleSelected'; key: string }>
    | Readonly<{ type: 'StatusSelected'; value: string }>
  );
export type ZlozWorkshopChoice = Readonly<{
  key: string;
  label: string;
  architecture: EventStormingNodeArchitecture;
  reason: string | null;
}>;
export type ZlozWorkshopSelect = Readonly<{
  label: string;
  value: string;
  choices: readonly ZlozWorkshopChoice[];
  reason: string | null;
}>;
export type ZlozWorkshopControlsContext = Readonly<{
  scope: ZlozWorkshopScope | null;
  role: ZlozWorkshopSelect;
  status: ZlozWorkshopSelect | null;
  reason: string | null;
  statusText: string;
}>;
export type ZlozWorkshopControlsOptions = Readonly<{
  policy?: EditorPolicy;
  blockedReason?: string | null;
  roleLabel?: string;
  statusLabel?: string;
  labelRole?: (role: EventStormingNodeArchitecture['role']) => string;
  statusLabels?: Partial<Record<'open' | 'resolved', string>>;
}>;
export type ZlozWorkshopDecision =
  | Readonly<{ type: 'ready'; event: Extract<EditorEvent, { type: 'NodeArchitectureChanged' }> }>
  | Readonly<{ type: 'blocked'; reason: string }>
  | Readonly<{ type: 'ignored' | 'unchanged' }>;
const denial = (reason: string | null | undefined) =>
  reason == null ? null : reason.trim() || 'Workshop editing is unavailable.';
function restriction(
  state: EditorState,
  node: ZlozNode,
  next: EventStormingNodeArchitecture,
  reason: string | null,
  options: ZlozWorkshopControlsOptions,
): string | null {
  if (reason) return reason;
  if (next.role === 'lane' && node.kind !== 'group')
    return 'A lane requires a group; changing meaning never changes node kind.';
  if (node.kind === 'group' && next.role !== 'lane')
    return 'This group can only carry lane meaning in the workshop family.';
  if (next.role === 'hotspot' && node.ports.length > 0)
    return 'Remove ports before assigning hotspot annotation meaning.';
  const candidate = { ...node, architecture: next };
  if (!validNodeArchitectureFields(candidate))
    return 'This role is incompatible with the current node kind or ports.';
  return denial(options.policy?.canChangeNodeArchitecture?.(node, candidate, state.graph));
}
const allRestricted = (choices: readonly ZlozWorkshopChoice[], fallback: string) =>
  choices.some((c) => c.reason === null)
    ? null
    : (choices.find((c) => c.reason !== null)?.reason ?? fallback);
/** ADR 0082: pure presentation of current compatible choices; no kind, port, selection or graph mutation. */
export function resolveEventStormingWorkshopControls(
  state: EditorState,
  nodeId: string | null,
  options: ZlozWorkshopControlsOptions = {},
): ZlozWorkshopControlsContext {
  const node = state.graph.nodes.find((n) => n.id === nodeId);
  const current = node?.architecture?.family === 'event-storming' ? node.architecture : null;
  const reason =
    denial(options.blockedReason) ??
    (state.readOnly
      ? 'This diagram is read-only.'
      : state.gesture.type !== 'idle'
        ? 'Finish the current gesture before editing workshop meaning.'
        : !node || !current
          ? 'Select a workshop node.'
          : !state.selectedNodes.includes(node.id)
            ? 'Select this workshop node before editing.'
            : !presentEditorGroups(state).nodes.some((n) => n.id === node.id)
              ? 'This workshop node is hidden.'
              : null);
  const scope =
    node && current
      ? { nodeId: node.id, revision: state.revision, descriptor: JSON.stringify(current) }
      : null;
  function choice(
    architecture: EventStormingNodeArchitecture,
    label: string,
    key: string,
  ): ZlozWorkshopChoice {
    return {
      key,
      label,
      architecture,
      reason: node ? restriction(state, node, architecture, reason, options) : reason,
    };
  }
  const choices = architectureNodePresets.flatMap((p) => {
    const architecture = p.architecture;
    if (architecture.family !== 'event-storming') return [];
    let next = current?.role === architecture.role ? current : architecture;
    if (current?.description !== undefined) next = { ...next, description: current.description };
    return [
      choice(next, options.labelRole?.(architecture.role).trim() || p.label, architecture.role),
    ];
  });
  const statusChoices =
    current?.role === 'hotspot'
      ? (['open', 'resolved'] as const).map((status) =>
          choice(
            { ...current, status },
            options.statusLabels?.[status]?.trim() ||
              (status === 'open' ? 'Open question' : 'Resolved'),
            status,
          ),
        )
      : null;
  return {
    scope,
    reason,
    role: {
      label: options.roleLabel?.trim() || 'Workshop role',
      value: current?.role ?? '',
      choices,
      reason: reason ?? allRestricted(choices, 'No compatible workshop roles.'),
    },
    status:
      statusChoices && current?.role === 'hotspot'
        ? {
            label: options.statusLabel?.trim() || 'Hotspot status',
            value: current.status,
            choices: statusChoices,
            reason: reason ?? allRestricted(statusChoices, 'Hotspot status is protected.'),
          }
        : null,
    statusText:
      current?.role === 'hotspot'
        ? current.status === 'open'
          ? 'Open workshop question.'
          : 'Resolved workshop annotation.'
        : current?.role === 'lane'
          ? 'Organizational lane; membership does not infer ownership.'
          : current?.role === 'external-system'
            ? 'External participant under the selected convention.'
            : 'Workshop meaning is authored.',
  };
}
/** Re-resolve against live state/policy. Apply ready events immediately through updateEditor with that policy. */
export function resolveEventStormingWorkshopRequest(
  state: EditorState,
  nodeId: string | null,
  request: ZlozWorkshopRequest,
  options: ZlozWorkshopControlsOptions = {},
): ZlozWorkshopDecision {
  const context = resolveEventStormingWorkshopControls(state, nodeId, options),
    scope = context.scope;
  if (
    !scope ||
    request.nodeId !== scope.nodeId ||
    request.revision !== scope.revision ||
    request.descriptor !== scope.descriptor
  )
    return { type: 'ignored' };
  if (context.reason) return { type: 'blocked', reason: context.reason };
  const control = request.type === 'RoleSelected' ? context.role : context.status;
  if (!control) return { type: 'ignored' };
  const value = request.type === 'RoleSelected' ? request.key : request.value;
  const selected = control.choices.find((c) => c.key === value);
  if (!selected) return { type: 'ignored' };
  if (selected.reason) return { type: 'blocked', reason: selected.reason };
  if (control.value === value) return { type: 'unchanged' };
  return {
    type: 'ready',
    event: {
      type: 'NodeArchitectureChanged',
      id: scope.nodeId,
      architecture: { ...selected.architecture },
    },
  };
}
