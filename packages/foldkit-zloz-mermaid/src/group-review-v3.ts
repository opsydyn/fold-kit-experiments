/* oxlint-disable anti-slop/no-runtime-typeof -- Validate bounded host revision metadata before exact source identity; runtime review state is never deserialized. */
import {
  captureGroupDocumentV3,
  serializeGroupDocumentV3,
  ZlozError,
  type ZlozGroupDocumentV3,
} from '@opsydyn/foldkit-zloz';

import {
  exportGroupMermaidV3,
  type MermaidDirection,
  type MermaidBundleV3,
  type MermaidExportResultV3,
  type MermaidDiagnostic,
} from './export-mermaid';
export type ZlozGroupMermaidReviewStateV3 = Readonly<{
  scope: string;
  generation: number;
  direction: MermaidDirection;
  lossKey: string | null;
  run: number;
  download: Readonly<{ type: 'idle' }> | Readonly<{ type: 'pending'; key: string; run: number }>;
}>;
export type ZlozGroupMermaidReviewContextV3 = Readonly<{
  scope: string;
  sourceRevision: number | string;
  document: ZlozGroupDocumentV3;
  fileName?: string;
  canDownload?: (document: ZlozGroupDocumentV3, bundle: MermaidBundleV3 | null) => string | null;
}>;
export type ZlozGroupMermaidReviewIdentityV3 = Readonly<{
  scope: string;
  generation: number;
  key: string;
}>;
export type ZlozGroupMermaidReviewRequestV3 = ZlozGroupMermaidReviewIdentityV3 &
  (
    | Readonly<{ type: 'MermaidDirectionChanged'; direction: MermaidDirection }>
    | Readonly<{ type: 'MermaidLossAcceptanceChanged'; accepted: boolean }>
    | Readonly<{ type: 'MermaidDownloadRequested' }>
    | Readonly<{ type: 'MermaidDownloadSettled'; run: number; outcome: 'succeeded' | 'failed' }>
  );
export type ZlozGroupMermaidReviewControlsV3 = Readonly<{
  identity: ZlozGroupMermaidReviewIdentityV3;
  direction: MermaidDirection;
  result: MermaidExportResultV3;
  findings: readonly MermaidDiagnostic[];
  hasLosses: boolean;
  accepted: boolean;
  busy: boolean;
  reason: string | null;
  downloadReason: string | null;
  fileName: string;
}>;
export type ZlozGroupMermaidDownloadV3 = ZlozGroupMermaidReviewIdentityV3 &
  Readonly<{
    run: number;
    fileName: string;
    bundle: MermaidBundleV3;
    text: string;
  }>;
export type ZlozGroupMermaidReviewUpdateV3 = Readonly<{
  state: ZlozGroupMermaidReviewStateV3;
  payload: ZlozGroupMermaidDownloadV3 | null;
  notice: string;
}>;
const validDirection = (direction: MermaidDirection) =>
  ['LR', 'RL', 'TB', 'BT'].includes(direction);
function scopeValue(scope: string): string {
  if (!scope.trim() || scope.length > 1024)
    throw new ZlozError(
      'invalid-edit',
      'Provide a nonblank Mermaid scope of at most 1024 characters.',
    );
  return scope;
}
function increment(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value === Number.MAX_SAFE_INTEGER)
    throw new ZlozError('invalid-edit', 'Mermaid review counter is exhausted.');
  return value + 1;
}
/** Trusted model state only. Never deserialize this record as consent or download authority. */
export function createGroupMermaidReviewV3(
  scope: string,
  direction: MermaidDirection = 'LR',
): ZlozGroupMermaidReviewStateV3 {
  if (!validDirection(direction)) throw new ZlozError('invalid-edit', 'Choose LR, RL, TB or BT.');
  return Object.freeze({
    scope: scopeValue(scope),
    generation: 0,
    direction,
    lossKey: null,
    run: 0,
    download: Object.freeze({ type: 'idle' }),
  });
}
/** Reset authority when switching working/edition scopes; direction is a preference only. */
export function groupMermaidReviewForScopeV3(
  state: ZlozGroupMermaidReviewStateV3,
  scope: string,
): ZlozGroupMermaidReviewStateV3 {
  return state.scope === scope ? state : createGroupMermaidReviewV3(scope, state.direction);
}
/** Pure full-document preview; report mode exposes losses without authorizing IO. Exact keys must not be persisted or used as DOM attributes. */
export function resolveGroupMermaidReviewV3(
  state: ZlozGroupMermaidReviewStateV3,
  context: ZlozGroupMermaidReviewContextV3,
): ZlozGroupMermaidReviewControlsV3 {
  scopeValue(context.scope);
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Host revision is a bounded scalar, not a deserialized runtime session.
  if (
    typeof context.sourceRevision === 'number'
      ? !Number.isSafeInteger(context.sourceRevision) || context.sourceRevision < 0
      : !context.sourceRevision.trim() || context.sourceRevision.length > 1024
  )
    throw new ZlozError('invalid-edit', 'Provide a valid current Mermaid source revision.');
  const document = captureGroupDocumentV3(context.document),
    result = exportGroupMermaidV3(document, { direction: state.direction, lossPolicy: 'report' }),
    bundle = result.status === 'converted' ? result.value : null;
  const fileName = context.fileName ?? 'zloz-native-v3.mermaid.json';
  if (!fileName.trim() || fileName.length > 240 || /[\\/\u0000-\u001f\u007f]/.test(fileName))
    throw new ZlozError(
      'invalid-edit',
      'Use a bounded Mermaid download file name without paths or controls.',
    );
  const identity = Object.freeze({
    scope: context.scope,
    generation: state.generation,
    key: JSON.stringify([
      context.scope,
      context.sourceRevision,
      serializeGroupDocumentV3(document),
      state.direction,
      fileName,
      result,
    ]),
  });
  const accepted = state.scope === context.scope && state.lossKey === identity.key;
  const busy =
    state.scope === context.scope &&
    state.download.type === 'pending' &&
    state.download.key === identity.key;
  const denial = context.canDownload?.(document, bundle),
    reason =
      denial == null
        ? bundle === null
          ? 'This native document cannot be projected. Review the Mermaid findings.'
          : null
        : denial.trim() || 'Mermaid export is protected.';
  const hasLosses = result.diagnostics.some((d) => d.severity === 'loss');
  return {
    identity,
    direction: state.direction,
    result,
    findings: result.diagnostics,
    hasLosses,
    accepted,
    busy,
    reason,
    fileName,
    downloadReason:
      reason ??
      (busy
        ? 'A Mermaid download is in progress.'
        : hasLosses && !accepted
          ? 'Accept the reported Mermaid losses for this exact output before downloading.'
          : null),
  };
}
/** Recompute source/output/policy immediately before each request. Host Commands consume only returned detached payloads. */
export function updateGroupMermaidReviewV3(
  state: ZlozGroupMermaidReviewStateV3,
  context: ZlozGroupMermaidReviewContextV3,
  request: ZlozGroupMermaidReviewRequestV3,
): ZlozGroupMermaidReviewUpdateV3 {
  const controls = resolveGroupMermaidReviewV3(state, context),
    same =
      request.scope === state.scope &&
      request.scope === context.scope &&
      request.generation === state.generation &&
      request.key === controls.identity.key;
  const unchanged = (notice = ''): ZlozGroupMermaidReviewUpdateV3 => ({
    state,
    payload: null,
    notice,
  });
  if (!same)
    return unchanged(
      request.type === 'MermaidDownloadSettled'
        ? ''
        : 'The native source or output changed. Review the Mermaid losses again.',
    );
  switch (request.type) {
    case 'MermaidDirectionChanged':
      if (!validDirection(request.direction)) return unchanged('Choose LR, RL, TB or BT.');
      return request.direction === state.direction
        ? unchanged()
        : {
            state: Object.freeze({
              ...state,
              direction: request.direction,
              generation: increment(state.generation),
              lossKey: null,
              download: Object.freeze({ type: 'idle' }),
            }),
            payload: null,
            notice: 'Mermaid direction changed. Review the output and losses again.',
          };
    case 'MermaidLossAcceptanceChanged':
      if (controls.reason) return unchanged(controls.reason);
      return {
        state: Object.freeze({
          ...state,
          lossKey: request.accepted ? controls.identity.key : null,
        }),
        payload: null,
        notice: request.accepted
          ? 'Mermaid losses accepted for this exact output.'
          : 'Mermaid loss acceptance removed.',
      };
    case 'MermaidDownloadRequested': {
      if (controls.downloadReason) return unchanged(controls.downloadReason);
      if (controls.result.status !== 'converted')
        return unchanged('The Mermaid projection is unavailable.');
      const run = increment(state.run),
        bundle = controls.result.value;
      return {
        state: Object.freeze({
          ...state,
          run,
          download: Object.freeze({ type: 'pending', key: controls.identity.key, run }),
        }),
        payload: Object.freeze({
          ...controls.identity,
          run,
          fileName: controls.fileName,
          bundle,
          text: JSON.stringify(bundle, null, 2) + '\n',
        }),
        notice: 'Mermaid bundle prepared for download.',
      };
    }
    case 'MermaidDownloadSettled':
      if (
        state.download.type !== 'pending' ||
        request.run !== state.download.run ||
        request.key !== state.download.key
      )
        return unchanged();
      return {
        state: Object.freeze({ ...state, download: Object.freeze({ type: 'idle' }) }),
        payload: null,
        notice:
          request.outcome === 'succeeded'
            ? 'Reviewed Mermaid bundle downloaded.'
            : 'Mermaid download failed. The model is unchanged; retry is available.',
      };
  }
}
