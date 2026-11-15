import { parseConnectionDocument, type ZlozConnectionDocument } from './connection-document';
import { commitGraph } from './editor';
import { ZlozError } from './graph';
import { historyValueEqual } from './history';
import {
  captureModellingPatchV2,
  dryRunModellingPatchV2,
  ownedData,
  type ZlozModellingPatchV2,
  type ZlozModellingPatchPreviewV2,
  type ZlozModellingPatchOptionsV2,
} from './modelling-patch';
import {
  patchPolicyReason,
  type ZlozModellingPatchIdentity,
  type ZlozModellingPatchConsent,
} from './modelling-patch-apply';
import { readPortableEvidenceJson } from './parse-modelling-patch';
import type { EditorState, EditorPolicy, JsonValue, JsonObject } from './types';
export type ZlozModellingPatchApplyOptionsV2 = Readonly<{
  consent: ZlozModellingPatchConsent | null;
  blockedReason?: string | null;
  policy?: EditorPolicy;
  review?: ZlozModellingPatchOptionsV2;
}>;
export type ZlozModellingPatchReceiptV2 = Readonly<{
  format: 'foldkit-zloz-patch-receipt';
  version: 2;
  patch: ZlozModellingPatchV2;
  snapshot: ZlozConnectionDocument;
  revision: number;
  reviewed: true;
  lossesAccepted: true;
}>;
export type ZlozModellingPatchReviewV2 = Readonly<{
  preview: ZlozModellingPatchPreviewV2;
  key: string | null;
  reason: string | null;
  acknowledged: boolean;
  canApply: boolean;
}>;
export type ZlozModellingPatchApplyResultV2 = Readonly<{ editor: EditorState }> &
  (
    | Readonly<{ type: 'applied'; receipt: ZlozModellingPatchReceiptV2 }>
    | Readonly<{ type: 'unchanged' }>
    | Readonly<{ type: 'blocked'; reason: string }>
  );
const denial = (value: string | null | undefined) =>
  value == null ? null : value.trim() || 'Patch application is protected.';
export function resolveModellingPatchReviewV2(
  editor: EditorState,
  identity: ZlozModellingPatchIdentity,
  input: ZlozModellingPatchV2,
  options: ZlozModellingPatchApplyOptionsV2 = { consent: null },
): ZlozModellingPatchReviewV2 {
  const preview = dryRunModellingPatchV2(
    {
      ...identity,
      revision: editor.revision,
      connectionMode: editor.connectionMode ?? 'strict',
      graph: editor.graph,
    },
    input,
    options.review,
  );
  if (preview.type === 'rejected')
    return {
      preview,
      key: null,
      reason: preview.findings[0]?.message ?? 'Invalid patch.',
      acknowledged: false,
      canApply: false,
    };
  const key = JSON.stringify({
    patch: preview.patch,
    graph: preview.graph,
    connectionMode: preview.patch.source.connectionMode,
  });
  const acknowledged =
    options.consent?.key === key &&
    options.consent.reviewed === true &&
    options.consent.lossesAccepted === true;
  const reason =
    preview.type === 'blocked'
      ? (preview.findings.find((f) => f.severity === 'error')?.message ?? 'Review blocked.')
      : !editor.connectionHistory
        ? 'Initialize a v2 model session before Apply.'
        : editor.readOnly
          ? 'The working model is read-only.'
          : editor.gesture.type !== 'idle' ||
              editor.connection !== null ||
              editor.edgeLabelDraft !== null ||
              editor.fitViewTransition.type !== 'idle'
            ? 'Finish active editor work.'
            : (denial(options.blockedReason) ??
              (preview.changes.length === 0
                ? 'Patch has no authored changes.'
                : editor.historyLimit === 0
                  ? 'Enable Undo before applying a patch.'
                  : editor.revision >= Number.MAX_SAFE_INTEGER
                    ? 'Editor revision counter is exhausted.'
                    : patchPolicyReason(
                        preview,
                        options.policy ?? {},
                        preview.patch.source.connectionMode,
                      )));
  return { preview, key, reason, acknowledged, canApply: reason === null && acknowledged };
}
export function applyModellingPatchV2(
  editor: EditorState,
  identity: ZlozModellingPatchIdentity,
  input: ZlozModellingPatchV2,
  options: ZlozModellingPatchApplyOptionsV2,
): ZlozModellingPatchApplyResultV2 {
  const review = resolveModellingPatchReviewV2(editor, identity, input, options);
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
      reason: review.reason ?? 'Review and acknowledge this exact proposal and its losses.',
    };
  const next = commitGraph(editor, review.preview.graph);
  const receipt = captureReceipt({
    format: 'foldkit-zloz-patch-receipt',
    version: 2,
    patch: review.preview.patch,
    snapshot: { version: 2, connectionMode: next.connectionMode ?? 'strict', graph: next.graph },
    revision: next.revision,
    reviewed: true,
    lossesAccepted: true,
  });
  readPortableEvidenceJson(JSON.stringify(receipt));
  return { type: 'applied', editor: next, receipt };
}
function isRecord(value: JsonValue): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function invalid(): never {
  throw new ZlozError('invalid-edit', 'Invalid or inconsistent v2 modelling patch receipt.');
}
/** Data-only evidence validation; recorded acknowledgement never authorizes live Apply. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- Untrusted receipt object is checked after bounded ownership.
function captureReceipt(input: unknown): ZlozModellingPatchReceiptV2 {
  const value = ownedData(input);
  if (
    !isRecord(value) ||
    Object.keys(value).sort().join(',') !==
      ['format', 'version', 'patch', 'snapshot', 'revision', 'reviewed', 'lossesAccepted']
        .sort()
        .join(',') ||
    value.format !== 'foldkit-zloz-patch-receipt' ||
    value.version !== 2 ||
    value.reviewed !== true ||
    value.lossesAccepted !== true
  )
    return invalid();
  const patch = captureModellingPatchV2(value.patch);
  const preview = dryRunModellingPatchV2(patch.source, patch);
  const snapshot = parseConnectionDocument(JSON.stringify(value.snapshot));
  if (
    preview.type !== 'reviewable' ||
    preview.changes.length === 0 ||
    value.revision !== patch.source.revision + 1 ||
    !Number.isSafeInteger(value.revision) ||
    snapshot.connectionMode !== patch.source.connectionMode ||
    'viewport' in snapshot ||
    !historyValueEqual(snapshot.graph, preview.graph)
  )
    return invalid();
  return Object.freeze({
    format: 'foldkit-zloz-patch-receipt',
    version: 2,
    patch,
    snapshot,
    revision: value.revision,
    reviewed: true,
    lossesAccepted: true,
  });
}
export function serializeModellingPatchReceiptV2(receipt: ZlozModellingPatchReceiptV2): string {
  const text = JSON.stringify(captureReceipt(receipt));
  readPortableEvidenceJson(text);
  return text;
}
export function parseModellingPatchReceiptV2(text: string): ZlozModellingPatchReceiptV2 {
  return captureReceipt(readPortableEvidenceJson(text));
}
