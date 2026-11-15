import type { ZlozModelIdentity } from './model-document';
import {
  captureModelDocumentV2,
  type ZlozEditionV2,
  type ZlozModelDocumentV2,
} from './model-document-v2';

export type ZlozEditionForkPolicyV2 = Readonly<{
  /** Fresh check against the detached source, its owned edition and the proposed target identity. */
  canForkEdition?: (
    source: ZlozModelDocumentV2,
    edition: ZlozEditionV2,
    target: ZlozModelIdentity,
  ) => string | null;
}>;
export type ZlozEditionForkResultV2 =
  | Readonly<{ type: 'forked'; document: ZlozModelDocumentV2 }>
  | Readonly<{ type: 'blocked'; reason: string }>;

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Fork only a source-owned v2 edition, retaining its mode/camera and pinning the immediate parent. */
export function forkEditionV2(
  source: ZlozModelDocumentV2,
  editionId: string,
  target: ZlozModelIdentity,
  policy: ZlozEditionForkPolicyV2 = {},
): ZlozEditionForkResultV2 {
  const checked = captureModelDocumentV2(source);
  if (!nonempty(target.id) || !nonempty(target.name) || target.id === checked.id)
    return { type: 'blocked', reason: 'Choose a nonempty, distinct model identity and name.' };
  const identity = Object.freeze({ id: target.id, name: target.name });
  const edition = checked.editions.find((item) => item.id === editionId);
  if (!edition)
    return { type: 'blocked', reason: 'The source edition is unavailable in this model.' };
  const reason = policy.canForkEdition?.(checked, edition, identity) ?? null;
  if (reason !== null)
    return { type: 'blocked', reason: reason.trim() || 'Edition forking is protected.' };
  return {
    type: 'forked',
    document: captureModelDocumentV2({
      id: identity.id,
      name: identity.name,
      snapshot: edition.snapshot,
      editions: [],
      origin: { modelId: checked.id, modelName: checked.name, edition },
    }),
  };
}
