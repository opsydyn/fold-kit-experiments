import { createLazy, type Html } from 'foldkit/html';

import type { FlowNode } from './types';

/** Per-canvas body memoization for built-in or explicitly composed custom shells.
 * Keep controls and port authorization outside retained artwork. */
export type FlowNodeBodyCache = <Args extends readonly unknown[]>(
  node: FlowNode,
  view: (...args: Args) => Html,
  args: Args,
) => Html;

/**
 * Create once per canvas. Weak node identities avoid retaining an ever-growing
 * registry of deleted IDs. Slots retain view artifacts, never policy decisions.
 */
export function createFlowNodeBodyCache(): FlowNodeBodyCache {
  const slots = new WeakMap<FlowNode, ReturnType<typeof createLazy>>();
  return (node, view, args) => {
    const slot = slots.get(node) ?? createLazy();
    slots.set(node, slot);
    return slot(view, args);
  };
}
