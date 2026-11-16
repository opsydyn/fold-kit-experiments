import type { ZlozConnectionMode } from './connection-mode';
import { commitGraph } from './editor';
import { graphChangePolicyReason } from './graph-change-policy';
import {
  dryRunModellingPatch,
  type ZlozModellingPatchOptions,
  type ZlozModellingPatchPreview,
  type ZlozModellingPatchCandidate,
  type ZlozModellingPatch,
} from './modelling-patch';
import type { EditorState, EditorPolicy, ZlozGraph } from './types';
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
/** Internal policy inventory shared by version-fixed patch and editor transactions. */
export function patchPolicyReason(
  candidate: ZlozModellingPatchCandidate<1 | 2>,
  policy: EditorPolicy,
  mode: ZlozConnectionMode = 'strict',
): string | null {
  return graphChangePolicyReason(
    candidate.patch.source.graph,
    candidate.graph,
    candidate.changes,
    policy,
    mode,
  );
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
