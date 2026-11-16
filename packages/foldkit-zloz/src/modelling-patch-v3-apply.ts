import { editRecord } from './edit-data';
import { ZlozError } from './graph';
/* oxlint-disable anti-slop/no-runtime-typeof, anti-slop/no-unknown-parameters -- Strict bounded native proposal/receipt boundaries; no runtime editor is deserialized. */
import { captureGroupDocumentV3, type ZlozGroupDocumentV3 } from './group-document-v3';
import {
  captureGroupEditorSourceV3,
  reviewGroupEditorTransactionV3,
  applyGroupEditorTransactionV3,
  type ZlozGroupEditorStateV3,
  type ZlozGroupEditorPolicyV3,
} from './group-editor-v3';
import { historyValueEqual } from './history';
import {
  captureModellingPatchV3,
  dryRunModellingPatchV3,
  patchGroupDocumentV3,
  ownedData,
  type ZlozModellingPatchV3,
  type ZlozModellingPatchSourceV3,
  type ZlozModellingPatchPreviewV3,
  type ZlozModellingPatchOptionsV3,
} from './modelling-patch';
import type { ZlozModellingPatchConsent } from './modelling-patch-apply';
import { readPortableEvidenceJson } from './parse-modelling-patch';
export type ZlozModellingPatchApplyOptionsV3 = Readonly<{
  consent: ZlozModellingPatchConsent | null;
  blockedReason?: string | null;
  policy?: ZlozGroupEditorPolicyV3;
  review?: ZlozModellingPatchOptionsV3;
}>;
export type ZlozModellingPatchReceiptV3 = Readonly<{
  format: 'foldkit-zloz-patch-receipt';
  version: 3;
  patch: ZlozModellingPatchV3;
  snapshot: ZlozGroupDocumentV3;
  revision: number;
  reviewed: true;
  lossesAccepted: true;
}>;
export type ZlozModellingPatchReviewV3 = Readonly<{
  preview: ZlozModellingPatchPreviewV3;
  key: string | null;
  reason: string | null;
  acknowledged: boolean;
  canApply: boolean;
}>;
export type ZlozModellingPatchApplyResultV3 = Readonly<{ editor: ZlozGroupEditorStateV3 }> &
  (
    | Readonly<{ type: 'applied'; receipt: ZlozModellingPatchReceiptV3 }>
    | Readonly<{ type: 'unchanged' }>
    | Readonly<{ type: 'blocked'; reason: string }>
  );
export function captureModellingPatchSourceV3(
  editor: ZlozGroupEditorStateV3,
  modelId: string,
): ZlozModellingPatchSourceV3 {
  const source = captureGroupEditorSourceV3(editor);
  if (!modelId.trim()) throw new ZlozError('invalid-edit', 'Provide the current model identity.');
  return Object.freeze({
    ...source.document,
    modelId,
    sessionId: source.sessionId,
    revision: source.revision,
  });
}
export function resolveModellingPatchReviewV3(
  editor: ZlozGroupEditorStateV3,
  modelId: string,
  input: ZlozModellingPatchV3,
  options: ZlozModellingPatchApplyOptionsV3 = { consent: null },
): ZlozModellingPatchReviewV3 {
  const preview = dryRunModellingPatchV3(
    captureModellingPatchSourceV3(editor, modelId),
    input,
    options.review,
  );
  if (preview.type === 'rejected')
    return {
      preview,
      key: null,
      reason: preview.findings[0]?.message ?? 'Invalid native proposal.',
      acknowledged: false,
      canApply: false,
    };
  const document = captureGroupDocumentV3({ ...editor.document, graph: preview.graph }),
    key = JSON.stringify({ patch: preview.patch, document });
  const reviewed = reviewGroupEditorTransactionV3(
    editor,
    { source: captureGroupEditorSourceV3(editor), document },
    options.policy,
  );
  const hostReason =
    options.blockedReason == null
      ? null
      : options.blockedReason.trim() || 'Native patch application is protected.';
  const reason =
    preview.type === 'blocked'
      ? (preview.findings.find((f) => f.severity === 'error')?.message ??
        'Native proposal is blocked.')
      : (hostReason ??
        (reviewed.type === 'blocked'
          ? reviewed.reason
          : preview.changes.length === 0
            ? 'Patch has no authored changes.'
            : null));
  const acknowledged =
    options.consent?.key === key &&
    options.consent.reviewed === true &&
    options.consent.lossesAccepted === true;
  return { preview, key, reason, acknowledged, canApply: reason === null && acknowledged };
}
export function applyModellingPatchV3(
  editor: ZlozGroupEditorStateV3,
  modelId: string,
  input: ZlozModellingPatchV3,
  options: ZlozModellingPatchApplyOptionsV3,
): ZlozModellingPatchApplyResultV3 {
  const review = resolveModellingPatchReviewV3(editor, modelId, input, options);
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
      reason: review.reason ?? 'Review and acknowledge this exact native proposal and its losses.',
    };
  const result = applyGroupEditorTransactionV3(
    editor,
    {
      source: captureGroupEditorSourceV3(editor),
      document: { ...editor.document, graph: review.preview.graph },
    },
    options.policy,
  );
  if (result.type === 'blocked') return { type: 'blocked', editor, reason: result.reason };
  if (result.type === 'unchanged') return { type: 'unchanged', editor };
  // oxlint-disable-next-line linteffect/no-try-catch -- Known receipt/budget failures return the original immutable editor; host publication happens only after this preflight.
  try {
    const receipt = captureReceipt({
      format: 'foldkit-zloz-patch-receipt',
      version: 3,
      patch: review.preview.patch,
      snapshot: result.editor.document,
      revision: result.editor.revision,
      reviewed: true,
      lossesAccepted: true,
    });
    readPortableEvidenceJson(JSON.stringify(receipt));
    return { type: 'applied', editor: result.editor, receipt };
  } catch (error) {
    if (error instanceof ZlozError) return { type: 'blocked', editor, reason: error.message };
    throw error;
  }
}
function captureReceipt(input: unknown): ZlozModellingPatchReceiptV3 {
  const value = ownedData(input);
  if (
    !editRecord(value) ||
    Object.keys(value).sort().join(',') !==
      ['format', 'version', 'patch', 'snapshot', 'revision', 'reviewed', 'lossesAccepted']
        .sort()
        .join(',') ||
    value.format !== 'foldkit-zloz-patch-receipt' ||
    value.version !== 3 ||
    value.reviewed !== true ||
    value.lossesAccepted !== true
  )
    throw new ZlozError('invalid-edit', 'Invalid native patch receipt.');
  const patch = captureModellingPatchV3(value.patch),
    preview = dryRunModellingPatchV3(patch.source, patch),
    snapshot = captureGroupDocumentV3(value.snapshot);
  if (
    preview.type !== 'reviewable' ||
    preview.changes.length === 0 ||
    value.revision !== patch.source.revision + 1 ||
    typeof value.revision !== 'number' ||
    !Number.isSafeInteger(value.revision) ||
    !historyValueEqual(
      snapshot,
      captureGroupDocumentV3({ ...patchGroupDocumentV3(patch.source), graph: preview.graph }),
    )
  )
    throw new ZlozError('invalid-edit', 'Inconsistent native patch receipt.');
  return Object.freeze({
    format: 'foldkit-zloz-patch-receipt',
    version: 3,
    patch,
    snapshot,
    revision: value.revision,
    reviewed: true,
    lossesAccepted: true,
  });
}
export function serializeModellingPatchReceiptV3(receipt: ZlozModellingPatchReceiptV3): string {
  const text = JSON.stringify(captureReceipt(receipt));
  readPortableEvidenceJson(text);
  return text;
}
export function parseModellingPatchReceiptV3(text: string): ZlozModellingPatchReceiptV3 {
  return captureReceipt(readPortableEvidenceJson(text));
}
