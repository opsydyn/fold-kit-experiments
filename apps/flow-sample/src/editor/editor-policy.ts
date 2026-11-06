import type { EditorPolicy } from '@opsydyn/foldkit-flow';
import { Schema } from 'effect';

import type { Model } from './model';

const isProtected = Schema.is(Schema.Struct({ deletionProtected: Schema.Literal(true) }));

const requiredItemPolicy = {
  canDelete: (candidate) => {
    const node = candidate.nodes.find(({ data }) => isProtected(data));
    if (node) return `${node.label} is required.`;
    return candidate.edges.some(({ data }) => isProtected(data))
      ? 'This connection is required.'
      : null;
  },
} satisfies EditorPolicy;

export function workbenchPolicy({
  protectDeletions,
  reconnectLock,
}: Pick<Model, 'protectDeletions' | 'reconnectLock'>): EditorPolicy &
  Required<Pick<EditorPolicy, 'canReconnect'>> {
  const canReconnect: NonNullable<EditorPolicy['canReconnect']> = (edge, end) =>
    edge.id === 'draft-review' && (reconnectLock === end || reconnectLock === 'both')
      ? end === 'source'
        ? 'Source reconnection is locked.'
        : 'Target reconnection is locked.'
      : null;
  return protectDeletions ? { ...requiredItemPolicy, canReconnect } : { canReconnect };
}
