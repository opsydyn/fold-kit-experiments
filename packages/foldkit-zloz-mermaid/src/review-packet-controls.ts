import type { ZlozModelDocument } from '@opsydyn/foldkit-zloz';

import {
  createReviewPacket,
  type ZlozReviewPacket,
  type ZlozReviewPacketDiagnostic,
  type ZlozReviewPacketOptions,
} from './review-packet';

export type ZlozReviewPacketSelection = Readonly<{
  baselineId: string | null;
  selectedId: string | null;
}>;
export type ZlozReviewPacketExportState = Readonly<{ consentKey: string | null }>;
export type ZlozReviewPacketRequest =
  | Readonly<{ type: 'ConsentChanged'; key: string; accepted: boolean }>
  | Readonly<{ type: 'DownloadClicked'; key: string }>;
export type ZlozReviewPacketControlsOptions = Omit<ZlozReviewPacketOptions, 'lossPolicy'> &
  Readonly<{ blockedReason?: string | null }>;
export type ZlozReviewPacketControlsContext = Readonly<{
  /** Opaque exact-content identity, not a credential or DOM attribute. Do not persist. */
  key: string | null;
  packet: ZlozReviewPacket | null;
  scopeText: string;
  diagnostics: readonly ZlozReviewPacketDiagnostic[];
  requiresConsent: boolean;
  consented: boolean;
  reason: string | null;
  downloadReason: string | null;
}>;
export type ZlozReviewPacketDecision =
  | Readonly<{ type: 'ready'; state: ZlozReviewPacketExportState }>
  | Readonly<{ type: 'blocked'; reason: string }>
  | Readonly<{ type: 'download'; packet: ZlozReviewPacket }>;
/** Pure preview only: report mode never authorizes I/O. Invalid documents/rule catalogues retain the builder's validation boundary. */
export function resolveReviewPacketControls(
  document: ZlozModelDocument,
  selection: ZlozReviewPacketSelection,
  state: ZlozReviewPacketExportState,
  options: ZlozReviewPacketControlsOptions = {},
): ZlozReviewPacketControlsContext {
  const { blockedReason, ...projectionOptions } = options;
  const result =
    selection.baselineId === null
      ? null
      : createReviewPacket(
          document,
          selection.selectedId === null
            ? { baselineId: selection.baselineId }
            : { baselineId: selection.baselineId, selectedId: selection.selectedId },
          { ...projectionOptions, lossPolicy: 'report' },
        );
  const packet = result?.status === 'created' ? result.value : null;
  const diagnostics = result?.diagnostics ?? [];
  const key = packet === null ? null : JSON.stringify(packet);
  const requiresConsent = diagnostics.some((item) => item.severity === 'loss');
  const consented = key !== null && state.consentKey === key;
  const reason =
    blockedReason ??
    (result === null
      ? 'Choose an audit baseline before exporting.'
      : packet === null
        ? 'The chosen snapshots cannot be exported. Review the diagnostics.'
        : null);
  return {
    key,
    packet,
    diagnostics,
    requiresConsent,
    consented,
    reason,
    scopeText:
      packet === null
        ? 'Choose owned snapshots to preview a review packet.'
        : `${packet.model.name}: ${packet.baseline.source.name} → ${packet.selected.source.kind === 'current' ? 'Current graph' : packet.selected.source.name}. Includes both full snapshots, audit findings, convention rules and Mermaid projections. Other editions, origin and Undo are excluded. Authored data and any camera in the selected snapshots are included.`,
    downloadReason:
      reason ??
      (requiresConsent && !consented
        ? 'Explicit consent to the reported projection losses is required.'
        : null),
  };
}
/** Rebuild immediately before handling a request; never trust cached payloads, consent or availability. The host owns session guards and download Commands. */
export function resolveReviewPacketRequest(
  document: ZlozModelDocument,
  selection: ZlozReviewPacketSelection,
  state: ZlozReviewPacketExportState,
  request: ZlozReviewPacketRequest,
  options: ZlozReviewPacketControlsOptions = {},
): ZlozReviewPacketDecision {
  const context = resolveReviewPacketControls(document, selection, state, options);
  if (context.reason !== null) return { type: 'blocked', reason: context.reason };
  if (context.key === null || request.key !== context.key)
    return {
      type: 'blocked',
      reason: 'The review packet changed. Review its scope and losses again.',
    };
  if (request.type === 'ConsentChanged')
    return { type: 'ready', state: { consentKey: request.accepted ? context.key : null } };
  if (context.downloadReason !== null) return { type: 'blocked', reason: context.downloadReason };
  return context.packet === null
    ? { type: 'blocked', reason: 'The review packet is unavailable.' }
    : { type: 'download', packet: context.packet };
}
