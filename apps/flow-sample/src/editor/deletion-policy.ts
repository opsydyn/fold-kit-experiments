import type { EditorPolicy } from '@opsydyn/foldkit-flow';
import { Schema } from 'effect';

const isProtected = Schema.is(Schema.Struct({ deletionProtected: Schema.Literal(true) }));

export const requiredItemPolicy = {
  canDelete: (candidate) => {
    const node = candidate.nodes.find(({ data }) => isProtected(data));
    if (node) return `${node.label} is required.`;
    return candidate.edges.some(({ data }) => isProtected(data))
      ? 'This connection is required.'
      : null;
  },
} satisfies EditorPolicy;
