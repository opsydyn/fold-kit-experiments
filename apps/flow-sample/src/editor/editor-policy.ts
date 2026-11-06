import type { EditorPolicy, FlowNode } from '@opsydyn/foldkit-flow';
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
  portLocks,
  lockKeyNodes,
  lockNodeSizes,
  excludeSelection,
}: Pick<
  Model,
  | 'protectDeletions'
  | 'reconnectLock'
  | 'lockKeyNodes'
  | 'lockNodeSizes'
  | 'excludeSelection'
  | 'portLocks'
>): EditorPolicy & Required<Pick<EditorPolicy, 'canReconnect'>> {
  const canReconnect: NonNullable<EditorPolicy['canReconnect']> = (edge, end) =>
    edge.id === 'draft-review' && (reconnectLock === end || reconnectLock === 'both')
      ? end === 'source'
        ? 'Source reconnection is locked.'
        : 'Target reconnection is locked.'
      : null;
  const canConnectPort: NonNullable<EditorPolicy['canConnectPort']> = ({ node, port }) => {
    if (portLocks.draftOutput && node === 'source' && port === 'out')
      return 'Draft output is closed to new connections.';
    return portLocks.publishInput && node === 'publish' && port === 'in'
      ? 'Publish input is closed to new connections.'
      : null;
  };
  const connections = { canReconnect, canConnectPort };
  const policy = protectDeletions ? { ...requiredItemPolicy, ...connections } : connections;
  const movementPolicy = lockKeyNodes
    ? {
        ...policy,
        canMoveNode: (node: FlowNode) =>
          node.id === 'review' || node.id === 'domain' ? `${node.label} is locked in place.` : null,
      }
    : policy;
  const resizePolicy: EditorPolicy & Required<Pick<EditorPolicy, 'canReconnect'>> = lockNodeSizes
    ? {
        ...movementPolicy,
        canResizeNode: (node) =>
          node.id === 'review' || node.id === 'core'
            ? `${node.label} dimensions are locked.`
            : null,
      }
    : movementPolicy;
  return excludeSelection
    ? {
        ...resizePolicy,
        canSelectNode: (node) =>
          node.id === 'review' ? 'Review is excluded from selection.' : null,
        canSelectEdge: (edge) =>
          edge.id === 'draft-review' ? 'Draft → Review is excluded from selection.' : null,
      }
    : resizePolicy;
}
