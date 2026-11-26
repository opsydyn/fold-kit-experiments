import { serializeEventStormingC4Conversion } from '@opsydyn/foldkit-zloz';
import { Option } from 'effect';

import { DownloadC4Receipt } from './command';
import { editionArchiveByteLimit } from './history';
import type { Message } from './message';
import type { Model } from './model';
import type { Return } from './transition';

type DownloadScope = Readonly<{ modelId: string; epoch: number; index: number }>;
function matches(model: Model, scope: DownloadScope): boolean {
  return (
    scope.modelId === model.modelIdentity.id &&
    scope.epoch === model.modelEpoch &&
    Number.isSafeInteger(scope.index) &&
    scope.index >= 0 &&
    model.c4Conversions[scope.index] !== undefined
  );
}
export function downloadC4Receipt(model: Model, scope: DownloadScope): Return<Model, Message> {
  if (model.sidebarSection !== 'c4mapping' || model.sidebarCollapsed || !matches(model, scope))
    return { model };
  const conversion = model.c4Conversions[scope.index];
  if (!conversion) return { model };
  const encoded = Option.liftThrowable(serializeEventStormingC4Conversion)(conversion);
  if (Option.isNone(encoded)) {
    const notice =
      'Receipt could not be validated. The retained record and working model are unchanged.';
    return { model: { ...model, c4ApplyNotice: notice, notice } };
  }
  if (new TextEncoder().encode(encoded.value).byteLength > editionArchiveByteLimit) {
    const notice =
      'Receipt exceeds the 5 MiB reopening limit. Download was not started; provenance remains retained.';
    return { model: { ...model, c4ApplyNotice: notice, notice } };
  }
  return { model, commands: [DownloadC4Receipt.make({ ...scope, json: encoded.value })] };
}
export function c4ReceiptDownloadFeedback(
  model: Model,
  scope: DownloadScope,
  succeeded: boolean,
): Model {
  if (!matches(model, scope)) return model;
  const notice = succeeded
    ? 'C4 receipt download started. Provenance remains retained in this tab.'
    : 'C4 receipt download failed. Provenance remains retained; try again.';
  return { ...model, c4ApplyNotice: notice, notice };
}
