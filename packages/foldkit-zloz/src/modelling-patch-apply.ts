import type { ZlozConnectionMode } from './connection-mode';
import { connectionReason } from './connection-validation';
import { commitGraph } from './editor';
import { historyValueEqual } from './history';
import {
  dryRunModellingPatch,
  type ZlozModellingPatchOptions,
  type ZlozModellingPatchPreview,
  type ZlozModellingPatchCandidate,
  type ZlozModellingPatch,
} from './modelling-patch';
import type { EditorState, EditorPolicy, ZlozGraph, ZlozNode, Port } from './types';
export type ZlozModellingPatchIdentity = Readonly<{ modelId: string; sessionId: string }>;
export type ZlozModellingPatchConsent = Readonly<{
  key: string;
  reviewed: true;
  lossesAccepted: true;
}>;
export type ZlozModellingPatchApplyOptions = Readonly<{
  consent: ZlozModellingPatchConsent | null;
  blockedReason?: string | null;
  policy?: EditorPolicy;
  review?: ZlozModellingPatchOptions;
}>;
export type ZlozModellingPatchReceipt = Readonly<{
  format: 'foldkit-zloz-patch-receipt';
  version: 1;
  patch: ZlozModellingPatch;
  graph: ZlozGraph;
  revision: number;
  reviewed: true;
  lossesAccepted: true;
}>;
export type ZlozModellingPatchReview = Readonly<{
  preview: ZlozModellingPatchPreview;
  key: string | null;
  reason: string | null;
  canApply: boolean;
  acknowledged: boolean;
}>;
export type ZlozModellingPatchReviewRequest = Readonly<{ key: string }> &
  (
    | Readonly<{ type: 'AcknowledgementChanged'; accepted: boolean }>
    | Readonly<{ type: 'ApplyClicked' }>
  );
export type ZlozModellingPatchApplyResult = Readonly<{ editor: EditorState }> &
  (
    | Readonly<{ type: 'applied'; receipt: ZlozModellingPatchReceipt }>
    | Readonly<{ type: 'unchanged' }>
    | Readonly<{ type: 'blocked'; reason: string }>
  );
const denial = (reason: string | null | undefined) =>
  reason == null ? null : reason.trim() || 'Patch application is protected.';
function portReasons(
  before: ZlozNode | null,
  after: ZlozNode | null,
  source: ZlozGraph,
  target: ZlozGraph,
  policy: EditorPolicy,
): string | null {
  const old = before?.ports ?? [],
    next = after?.ports ?? [];
  const check = (
    operation: 'add' | 'remove' | 'label' | 'position',
    node: ZlozNode,
    port: Port,
    graph: ZlozGraph,
  ) => denial(policy.canEditPort?.(Object.freeze({ operation, node, port }), graph));
  for (const port of old) {
    const replacement = next.find((p) => p.id === port.id);
    if (!replacement || replacement.kind !== port.kind) {
      if (before) {
        const reason = check('remove', before, port, source);
        if (reason !== null) return reason;
      }
    } else if (before) {
      if (port.label !== replacement.label) {
        const reason = check('label', before, port, source);
        if (reason !== null) return reason;
      }
      const { label: _a, ...a } = port,
        { label: _b, ...b } = replacement;
      if (!historyValueEqual(a, b) || old.indexOf(port) !== next.indexOf(replacement)) {
        const reason = check('position', before, port, source);
        if (reason !== null) return reason;
      }
    }
  }
  for (const port of next)
    if (!old.some((p) => p.id === port.id && p.kind === port.kind) && after) {
      const reason = check('add', after, port, target);
      if (reason !== null) return reason;
    }
  return null;
}
/** Internal policy inventory for a complete validated candidate; never mutates source or target. */
export function patchPolicyReason(
  candidate: ZlozModellingPatchCandidate<1 | 2>,
  policy: EditorPolicy,
  mode: ZlozConnectionMode = 'strict',
): string | null {
  const source = candidate.patch.source.graph,
    target = candidate.graph;
  const removed = {
    nodes: candidate.changes.flatMap((c) =>
      c.entity === 'node' && c.before && c.after === null ? [c.before] : [],
    ),
    edges: candidate.changes.flatMap((c) =>
      c.entity === 'edge' && c.before && c.after === null ? [c.before] : [],
    ),
  };
  if (removed.nodes.length || removed.edges.length) {
    const reason = denial(
      policy.canDelete?.(
        Object.freeze({ nodes: Object.freeze(removed.nodes), edges: Object.freeze(removed.edges) }),
        source,
      ),
    );
    if (reason !== null) return reason;
  }
  for (const c of candidate.changes) {
    if (c.entity === 'node') {
      const before = c.before,
        after = c.after;
      if (before && after) {
        const reasons = [
          () =>
            !historyValueEqual(before.position, after.position) ||
            before.parentId !== after.parentId
              ? policy.canMoveNode?.(before, source)
              : null,
          () =>
            !historyValueEqual(before.size, after.size)
              ? policy.canResizeNode?.(before, source)
              : null,
          () =>
            !historyValueEqual(before.architecture, after.architecture)
              ? policy.canChangeNodeArchitecture?.(before, after, source)
              : null,
          () =>
            !historyValueEqual(before.appearance, after.appearance)
              ? policy.canChangeNodeAppearance?.(before, after, source)
              : null,
        ];
        for (const check of reasons) {
          const reason = denial(check());
          if (reason !== null) return reason;
        }
      }
      const port = portReasons(before, after, source, target, policy);
      if (port !== null) return port;
    } else {
      const before = c.before,
        after = c.after;
      if (before && after) {
        if (!historyValueEqual(before.architecture, after.architecture)) {
          const reason = denial(policy.canChangeEdgeArchitecture?.(before, after, source));
          if (reason !== null) return reason;
        }
        if (!historyValueEqual(before.waypoints, after.waypoints)) {
          const reason = denial(policy.canChangeEdgeWaypoints?.(before, after, source));
          if (reason !== null) return reason;
        }
        for (const end of ['source', 'target'] as const)
          if (!historyValueEqual(before[end], after[end])) {
            const reason = denial(policy.canReconnect?.(before, end, source));
            if (reason !== null) return reason;
          }
      }
      if (
        after &&
        (!before ||
          !historyValueEqual(before.source, after.source) ||
          !historyValueEqual(before.target, after.target))
      ) {
        // The validated target contains new ports/nodes; exclude this edge itself for duplicate/custom checks.
        const remaining = Object.freeze({
          ...target,
          edges: Object.freeze(target.edges.filter((e) => e.id !== after.id)),
        });
        const sourceChanged = before !== null && !historyValueEqual(before.source, after.source);
        const targetChanged = before !== null && !historyValueEqual(before.target, after.target);
        const replacement =
          before && sourceChanged !== targetChanged
            ? { id: after.id, end: sourceChanged ? ('source' as const) : ('target' as const) }
            : undefined;
        const checkedPolicy: EditorPolicy = {
          ...policy,
          canConnect: (edge, graph) =>
            policy.canConnect?.(
              edge,
              Object.freeze({ ...graph, edges: Object.freeze([...graph.edges]) }),
            ) ?? null,
        };
        const reason = denial(connectionReason(remaining, after, checkedPolicy, replacement, mode));
        if (reason !== null) return reason;
      }
    }
  }
  return null;
}
/** Rebuild current source and protections. A content key is review freshness, never authority. */
export function resolveModellingPatchReview(
  editor: EditorState,
  identity: ZlozModellingPatchIdentity,
  input: ZlozModellingPatch,
  options: ZlozModellingPatchApplyOptions = { consent: null },
): ZlozModellingPatchReview {
  const preview = dryRunModellingPatch(
    { ...identity, revision: editor.revision, graph: editor.graph },
    input,
    options.review,
  );
  if (preview.type === 'rejected')
    return {
      preview,
      key: null,
      reason: preview.findings[0]?.message ?? 'Invalid patch.',
      canApply: false,
      acknowledged: false,
    };
  const key = JSON.stringify({ patch: preview.patch, graph: preview.graph });
  const acknowledged =
    options.consent?.key === key &&
    options.consent.reviewed === true &&
    options.consent.lossesAccepted === true;
  const reason =
    preview.type === 'blocked'
      ? (preview.findings.find((f) => f.severity === 'error')?.message ?? 'Review is blocked.')
      : editor.readOnly
        ? 'The working model is read-only.'
        : editor.gesture.type !== 'idle' ||
            editor.connection !== null ||
            editor.edgeLabelDraft !== null ||
            editor.fitViewTransition.type !== 'idle'
          ? 'Finish the active editor gesture, connection, draft or fit.'
          : (denial(options.blockedReason) ??
            (preview.changes.length === 0
              ? 'Patch has no authored changes.'
              : editor.historyLimit === 0
                ? 'Enable Undo before applying a patch.'
                : editor.revision >= Number.MAX_SAFE_INTEGER
                  ? 'Editor revision counter is exhausted.'
                  : patchPolicyReason(preview, options.policy ?? {})));
  return { preview, key, reason, acknowledged, canApply: reason === null && acknowledged };
}
export function resolveModellingPatchAcknowledgement(
  review: ZlozModellingPatchReview,
  request: ZlozModellingPatchReviewRequest,
): ZlozModellingPatchConsent | null {
  return request.type === 'AcknowledgementChanged' &&
    request.accepted &&
    request.key === review.key &&
    review.reason === null
    ? Object.freeze({ key: request.key, reviewed: true, lossesAccepted: true })
    : null;
}
/** Synchronous atomic Apply. Publish editor and receipt together; cached previews/receipts are not authority. */
export function applyModellingPatch(
  editor: EditorState,
  identity: ZlozModellingPatchIdentity,
  input: ZlozModellingPatch,
  options: ZlozModellingPatchApplyOptions,
): ZlozModellingPatchApplyResult {
  const review = resolveModellingPatchReview(editor, identity, input, options);
  if (
    review.preview.type !== 'rejected' &&
    review.preview.changes.length === 0 &&
    review.reason === 'Patch has no authored changes.'
  )
    return { type: 'unchanged', editor };
  if (!review.canApply || review.preview.type === 'rejected')
    return {
      type: 'blocked',
      editor,
      reason:
        review.reason ??
        'Review and acknowledge the exact proposed changes and losses before Apply.',
    };
  const next = commitGraph(editor, review.preview.graph);
  const receipt: ZlozModellingPatchReceipt = Object.freeze({
    format: 'foldkit-zloz-patch-receipt',
    version: 1,
    patch: review.preview.patch,
    graph: review.preview.graph,
    revision: next.revision,
    reviewed: true,
    lossesAccepted: true,
  });
  return { type: 'applied', editor: next, receipt };
}
