/* oxlint-disable anti-slop/no-shape-in-symbol-names -- Geometric node shapes are domain concepts here, not structural placeholder names. */
import { architectureNodePresets, type FlowNodeArchitecture } from './architecture';
import { copyGraph, validateGraph } from './graph';
import type { FlowNode } from './types';

/** Standalone node input. Group membership is assembled and validated with the complete graph. */
export type ArchitectureNodeInput = Omit<
  FlowNode,
  'architecture' | 'parentId' | 'extent' | 'expandParent'
> &
  Readonly<{ architecture: FlowNodeArchitecture }>;

/** Validates and detaches a standalone node, choosing a catalogue outline unless overridden. */
export function createArchitectureNode(input: ArchitectureNodeInput): FlowNode {
  validateGraph({ nodes: [input], edges: [] });
  const preset = architectureNodePresets.find(
    ({ architecture }) =>
      architecture.family === input.architecture.family &&
      architecture.role === input.architecture.role,
  );
  const node = {
    ...input,
    appearance: input.appearance ?? {
      shape: input.kind === 'group' ? 'rectangle' : (preset?.shape ?? 'rectangle'),
    },
  };
  return copyGraph({ nodes: [node], edges: [] }).nodes[0]!;
}
