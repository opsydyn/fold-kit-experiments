import { ZlozError } from './graph';
import type { ZlozEdition } from './history';

export type ZlozHistoryGhostPart = 'enabled' | 'nodes' | 'edges' | 'movements';
export type ZlozHistoryGhostVisibility = Readonly<Record<ZlozHistoryGhostPart, boolean>>;
export type ZlozComparisonEdition = Readonly<Pick<ZlozEdition, 'id' | 'name'>>;
export type ZlozHistoryComparisonControlsState = Readonly<{
  baselineId: string | null;
  ghosts: ZlozHistoryGhostVisibility;
}>;
export type ZlozHistoryComparisonRequest =
  | Readonly<{ type: 'BaselineSelected'; editionId: string | null }>
  | Readonly<{ type: 'GhostVisibilityToggled'; part: ZlozHistoryGhostPart }>
  | Readonly<{ type: 'GhostVisibilityChanged'; part: ZlozHistoryGhostPart; value: boolean }>;
export type ZlozHistoryComparisonControlsOptions = Readonly<{
  blockedReason?: string | null;
  baselineReason?: string | null;
  ghostReasons?: Readonly<Partial<Record<ZlozHistoryGhostPart, string | null>>>;
  minimalMode?: boolean;
  labels?: Partial<Record<ZlozHistoryGhostPart, string>>;
  labelEdition?: (edition: ZlozComparisonEdition) => string;
  baselineLabel?: string;
  noneLabel?: string;
}>;
export type ZlozHistoryComparisonDecision =
  | Readonly<{ type: 'ready'; state: ZlozHistoryComparisonControlsState }>
  | Readonly<{ type: 'unchanged' | 'ignored' }>
  | Readonly<{ type: 'blocked'; reason: string }>;
export type ZlozComparisonChoice = Readonly<{ editionId: string; label: string }>;
export type ZlozHistoryBaselineControl = Readonly<{
  value: string | null;
  current: ZlozComparisonChoice | null;
  choices: readonly ZlozComparisonChoice[];
  label: string;
  noneLabel: string;
  reason: string | null;
}>;
export type ZlozHistoryGhostControl = Readonly<{
  part: ZlozHistoryGhostPart;
  label: string;
  checked: boolean;
  reason: string | null;
  request: Extract<ZlozHistoryComparisonRequest, { type: 'GhostVisibilityToggled' }>;
}>;
export type ZlozHistoryComparisonControlsContext = Readonly<{
  current: ZlozComparisonChoice | null;
  state: ZlozHistoryComparisonControlsState;
  baseline: ZlozHistoryBaselineControl;
  ghosts: Readonly<Record<ZlozHistoryGhostPart, ZlozHistoryGhostControl>>;
  effectiveGhosts: ZlozHistoryGhostVisibility;
  statusText: string;
  reasons: readonly string[];
}>;
const labels = {
  enabled: 'Show comparison ghosts',
  nodes: 'Node ghosts',
  edges: 'Edge ghosts',
  movements: 'Movement connectors',
} as const;
const denial = (reason: string | null | undefined): string | null =>
  reason == null ? null : reason.trim() || 'Comparison settings are unavailable.';
/** Pure display context. Hidden layers retain their preferences; editions retain their stable IDs. */
export function resolveHistoryComparisonControls(
  editions: readonly ZlozComparisonEdition[],
  currentEditionId: string | null,
  state: ZlozHistoryComparisonControlsState,
  options: ZlozHistoryComparisonControlsOptions = {},
): ZlozHistoryComparisonControlsContext {
  const ids = new Set<string>();
  function choice(edition: ZlozComparisonEdition): ZlozComparisonChoice {
    if (!edition.id.trim() || !edition.name.trim() || ids.has(edition.id))
      throw new ZlozError(
        'invalid-edit',
        'Comparison editions require unique nonempty IDs and nonempty names.',
      );
    ids.add(edition.id);
    return { editionId: edition.id, label: options.labelEdition?.(edition).trim() || edition.name };
  }
  const choices = editions.map(choice);
  const current = choices.find((choice) => choice.editionId === currentEditionId) ?? null;
  const candidates = current
    ? choices.filter((choice) => choice.editionId !== current.editionId)
    : [];
  const baseline = candidates.find((choice) => choice.editionId === state.baselineId) ?? null;
  const globalReason = denial(options.blockedReason);
  const baselineReason =
    globalReason ??
    denial(options.baselineReason) ??
    (!current
      ? 'Open an edition to compare.'
      : candidates.length === 0
        ? 'Capture another edition to compare.'
        : null);
  const control = (part: ZlozHistoryGhostPart): ZlozHistoryGhostControl => ({
    part,
    label: options.labels?.[part]?.trim() || labels[part],
    checked: state.ghosts[part],
    reason: globalReason ?? denial(options.ghostReasons?.[part]),
    request: { type: 'GhostVisibilityToggled', part },
  });
  const ghosts = {
    enabled: control('enabled'),
    nodes: control('nodes'),
    edges: control('edges'),
    movements: control('movements'),
  };
  const visibilityReason = options.minimalMode
    ? 'Minimal mode hides ghosts while retaining your choices.'
    : !baseline
      ? 'Select a comparison baseline to show ghosts.'
      : !state.ghosts.enabled
        ? 'Ghosts are hidden; layer choices are retained.'
        : !state.ghosts.nodes && !state.ghosts.edges && !state.ghosts.movements
          ? 'All ghost layers are hidden.'
          : null;
  return {
    current,
    state,
    baseline: {
      value: baseline?.editionId ?? null,
      current: baseline,
      choices: candidates,
      label: options.baselineLabel?.trim() || 'History comparison baseline',
      noneLabel: options.noneLabel?.trim() || 'No comparison',
      reason: baselineReason,
    },
    ghosts,
    effectiveGhosts: {
      ...state.ghosts,
      enabled: !!baseline && state.ghosts.enabled && !options.minimalMode,
    },
    statusText:
      current && baseline
        ? `${current.label} compared with ${baseline.label}.`
        : 'No comparison baseline selected.',
    reasons: [
      ...new Set(
        [
          baselineReason,
          ...Object.values(ghosts).map((item) => item.reason),
          visibilityReason,
        ].filter((reason): reason is string => reason !== null),
      ),
    ],
  };
}
/** Re-resolve requests against fresh host state. This never mutates graph, Undo or playback. */
export function resolveHistoryComparisonRequest(
  editions: readonly ZlozComparisonEdition[],
  currentEditionId: string | null,
  state: ZlozHistoryComparisonControlsState,
  request: ZlozHistoryComparisonRequest,
  options: ZlozHistoryComparisonControlsOptions = {},
): ZlozHistoryComparisonDecision {
  const context = resolveHistoryComparisonControls(editions, currentEditionId, state, options);
  if (request.type === 'BaselineSelected') {
    const reason = denial(options.blockedReason) ?? denial(options.baselineReason);
    if (reason) return { type: 'blocked', reason };
    if (
      request.editionId !== null &&
      !context.baseline.choices.some((choice) => choice.editionId === request.editionId)
    )
      return { type: 'ignored' };
    return request.editionId === state.baselineId
      ? { type: 'unchanged' }
      : { type: 'ready', state: { ...state, baselineId: request.editionId } };
  }
  const control = context.ghosts[request.part];
  if (control.reason) return { type: 'blocked', reason: control.reason };
  const value =
    request.type === 'GhostVisibilityChanged' ? request.value : !state.ghosts[request.part];
  return value === state.ghosts[request.part]
    ? { type: 'unchanged' }
    : { type: 'ready', state: { ...state, ghosts: { ...state.ghosts, [request.part]: value } } };
}
