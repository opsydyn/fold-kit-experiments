import { historyValueEqual } from './history';
import { captureEditionV2, parseEditionsV2, serializeEditionsV2 } from './model-document-v2';
import type { ZlozEditionV2 } from './model-document-v2';

export type ZlozEditionAppendResultV2 =
  | Readonly<{ type: 'appended'; editions: readonly ZlozEditionV2[] }>
  | Readonly<{
      type: 'blocked';
      code: 'duplicate-edition' | 'edition-conflict';
      reason: string;
      /** Detached immutable pins for read-only comparison, never a replacement archive. */
      existing: ZlozEditionV2;
      proposed: ZlozEditionV2;
    }>;

/** Validate/detach the whole archive and candidate; reused IDs never overwrite, rename or append. */
export function appendEditionV2(
  editions: readonly ZlozEditionV2[],
  edition: ZlozEditionV2,
): ZlozEditionAppendResultV2 {
  const checked = parseEditionsV2(serializeEditionsV2(editions));
  const proposed = captureEditionV2(edition);
  const existing = checked.find((item) => item.id === proposed.id);
  if (existing) {
    const identical = historyValueEqual(existing, proposed);
    return Object.freeze({
      type: 'blocked',
      code: identical ? 'duplicate-edition' : 'edition-conflict',
      reason: identical
        ? `Edition ID "${proposed.id}" already exists with the same checkpoint.`
        : `Edition ID "${proposed.id}" conflicts with a different checkpoint. Choose a new ID.`,
      existing,
      proposed,
    });
  }
  return Object.freeze({ type: 'appended', editions: Object.freeze([...checked, proposed]) });
}
