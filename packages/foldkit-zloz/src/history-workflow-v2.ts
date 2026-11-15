import { captureConnectionDocument } from './connection-document';
import type { ZlozConnectionDocument } from './connection-document';
import {
  createEditionPlayback,
  updateEditionPlayback,
  playbackEditionId,
} from './edition-playback';
import type {
  ZlozEditionPlayback,
  ZlozEditionPlaybackOptions,
  ZlozEditionPlaybackEvent,
} from './edition-playback';
import { restoreGraphPolicyReason } from './edition-restore';
import { commitConnectionGraph } from './editor';
import { historyValueEqual } from './history';
import { captureEditionV2, parseEditionsV2, serializeEditionsV2 } from './model-document-v2';
import type { ZlozEditionV2 } from './model-document-v2';
import { createHistoryReviewV2 } from './model-workflow-v2';
import type { EditorPolicy, EditorState } from './types';

export type ZlozEditionMergeResultV2 =
  | Readonly<{ type: 'merged' | 'unchanged'; editions: readonly ZlozEditionV2[] }>
  | Readonly<{ type: 'blocked'; reason: string; existing: ZlozEditionV2; proposed: ZlozEditionV2 }>;
/** Atomic additive import. Both full collections validate before any conflict decision or publication. */
export function mergeEditionsV2(
  current: readonly ZlozEditionV2[],
  incoming: readonly ZlozEditionV2[],
): ZlozEditionMergeResultV2 {
  const checked = parseEditionsV2(serializeEditionsV2(current));
  const proposed = parseEditionsV2(serializeEditionsV2(incoming));
  const existing = new Map(checked.map((item) => [item.id, item]));
  for (const item of proposed) {
    const previous = existing.get(item.id);
    if (previous && !historyValueEqual(previous, item))
      return Object.freeze({
        type: 'blocked',
        reason: `Conflicting edition ID: ${item.id}`,
        existing: previous,
        proposed: item,
      });
  }
  const additions = proposed.filter((item) => !existing.has(item.id));
  return Object.freeze({
    type: additions.length ? 'merged' : 'unchanged',
    editions: Object.freeze([...checked, ...additions]),
  });
}
export type ZlozEditionRestorePolicyV2 = EditorPolicy &
  Readonly<{
    canRestoreEdition?: (edition: ZlozEditionV2, current: ZlozConnectionDocument) => string | null;
  }>;
export type ZlozEditionRestoreOptionsV2 = Readonly<{
  expectedRevision: number;
  busyReason?: string | null;
  policy?: ZlozEditionRestorePolicyV2;
}>;
export type ZlozEditionRestoreDecisionV2 =
  | Readonly<{ type: 'ready'; edition: ZlozEditionV2 }>
  | Readonly<{ type: 'unchanged' }>
  | Readonly<{ type: 'blocked'; reason: string }>;
export type ZlozEditionRestoreResultV2 =
  | Readonly<{ type: 'restored' | 'unchanged'; editor: EditorState }>
  | Readonly<{ type: 'blocked'; editor: EditorState; reason: string }>;
/** Preview only. Camera remains working navigation and is not part of document Undo. */
export function resolveEditionRestoreV2(
  state: EditorState,
  edition: ZlozEditionV2,
  options: ZlozEditionRestoreOptionsV2,
): ZlozEditionRestoreDecisionV2 {
  const checked = captureEditionV2(edition);
  if (
    !Number.isSafeInteger(options.expectedRevision) ||
    options.expectedRevision < 0 ||
    options.expectedRevision !== state.revision
  )
    return { type: 'blocked', reason: 'The working model changed. Preview the restore again.' };
  if (!state.connectionHistory)
    return {
      type: 'blocked',
      reason: 'Initialize a v2 model session for mode-aware restore and Undo.',
    };
  if (state.readOnly) return { type: 'blocked', reason: 'The working model is read-only.' };
  if (options.busyReason != null)
    return {
      type: 'blocked',
      reason: options.busyReason.trim() || 'Finish active work before restoring.',
    };
  if (state.gesture.type !== 'idle' || state.edgeLabelDraft !== null)
    return { type: 'blocked', reason: 'Finish active edits before restoring.' };
  if (
    state.connectionMode === checked.snapshot.connectionMode &&
    historyValueEqual(state.graph, checked.snapshot.graph)
  )
    return { type: 'unchanged' };
  if (state.historyLimit === 0)
    return { type: 'blocked', reason: 'Enable Undo before restoring an edition.' };
  const current = captureConnectionDocument(state);
  const policy = options.policy ?? {};
  const bulk = policy.canRestoreEdition?.(checked, current) ?? null;
  const reason = bulk ?? restoreGraphPolicyReason(current.graph, checked.snapshot.graph, policy);
  if (reason !== null)
    return { type: 'blocked', reason: reason.trim() || 'Edition restore is protected.' };
  for (const edge of checked.snapshot.graph.edges) {
    const previous = current.graph.edges.find((item) => item.id === edge.id);
    if (!previous) continue;
    const architecture = !historyValueEqual(previous.architecture, edge.architecture)
      ? (policy.canChangeEdgeArchitecture?.(previous, edge, current.graph) ?? null)
      : null;
    const route = !historyValueEqual(previous.waypoints, edge.waypoints)
      ? (policy.canChangeEdgeWaypoints?.(previous, edge, current.graph) ?? null)
      : null;
    const veto = architecture ?? route;
    if (veto !== null)
      return { type: 'blocked', reason: veto.trim() || 'Edge editing is protected.' };
  }
  return { type: 'ready', edition: checked };
}
export function restoreEditionV2(
  state: EditorState,
  edition: ZlozEditionV2,
  options: ZlozEditionRestoreOptionsV2,
): ZlozEditionRestoreResultV2 {
  const decision = resolveEditionRestoreV2(state, edition, options);
  if (decision.type === 'blocked')
    return { type: 'blocked', editor: state, reason: decision.reason };
  if (decision.type === 'unchanged') return { type: 'unchanged', editor: state };
  return {
    type: 'restored',
    editor: {
      ...commitConnectionGraph(
        state,
        decision.edition.snapshot.graph,
        decision.edition.snapshot.connectionMode,
      ),
      notice: `Restored edition: ${decision.edition.name}`,
    },
  };
}
export type ZlozEditionPlaybackV2 = Readonly<{
  editions: readonly ZlozEditionV2[];
  cursor: ZlozEditionPlayback;
}>;
export function createEditionPlaybackV2(
  editions: readonly ZlozEditionV2[],
  options: ZlozEditionPlaybackOptions = {},
): ZlozEditionPlaybackV2 {
  const checked = parseEditionsV2(serializeEditionsV2(editions));
  return Object.freeze({
    editions: checked,
    cursor: Object.freeze(
      createEditionPlayback(
        checked.map((item) => item.id),
        options,
      ),
    ),
  });
}
export function updateEditionPlaybackV2(
  playback: ZlozEditionPlaybackV2,
  event: ZlozEditionPlaybackEvent,
): ZlozEditionPlaybackV2 {
  const cursor = updateEditionPlayback(playback.cursor, event);
  return cursor === playback.cursor
    ? playback
    : Object.freeze({ ...playback, cursor: Object.freeze(cursor) });
}
export function reviewEditionPlaybackV2(playback: ZlozEditionPlaybackV2, present: EditorState) {
  const id = playbackEditionId(playback.cursor);
  const edition = playback.editions.find((item) => item.id === id);
  return edition ? createHistoryReviewV2(edition, present) : null;
}
