import {
  resolveReviewPacketControls,
  resolveReviewPacketRequest,
  type ZlozReviewPacketRequest,
} from '@opsydyn/foldkit-zloz-mermaid';

import { ExportReviewPacket } from './command';
import { workbenchRelationshipOptions } from './event-storming-relationships';
import type { Model } from './model';
import { workbenchDocument } from './model-sessions';
import { playbackInspectionReason, pauseHistoryPlayback } from './playback';
function options(model: Model) {
  return { ...workbenchRelationshipOptions(model), blockedReason: playbackInspectionReason(model) };
}
export function workbenchPacketContext(model: Model) {
  return resolveReviewPacketControls(
    workbenchDocument(model),
    model.auditComparison,
    { consentKey: model.reviewPacketConsentKey },
    options(model),
  );
}
export function updateWorkbenchPacket(
  model: Model,
  request: ZlozReviewPacketRequest,
  modelId: string,
  epoch: number,
) {
  if (
    modelId !== model.modelIdentity.id ||
    epoch !== model.modelEpoch ||
    model.sidebarSection !== 'history'
  )
    return { model };
  const result = resolveReviewPacketRequest(
    workbenchDocument(model),
    model.auditComparison,
    { consentKey: model.reviewPacketConsentKey },
    request,
    options(model),
  );
  if (result.type === 'blocked') return { model: { ...model, notice: result.reason } };
  if (result.type === 'ready')
    return {
      model: { ...pauseHistoryPlayback(model), reviewPacketConsentKey: result.state.consentKey },
    };
  return {
    model: pauseHistoryPlayback(model),
    commands: [ExportReviewPacket({ json: JSON.stringify(result.packet, null, 2) })],
  };
}
