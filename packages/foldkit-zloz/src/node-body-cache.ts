import { createLazy, type Html } from 'foldkit/html';

import type { ZlozNode } from './types';

/** Per-canvas body memoization for built-in or explicitly composed custom shells.
 * Keep controls and port authorization outside retained artwork. */
export type ZlozNodeBodyCache = <Args extends readonly unknown[]>(
  node: ZlozNode,
  view: (...args: Args) => Html,
  args: Args,
) => Html;

/**
 * Create once per canvas. Weak node identities avoid retaining an ever-growing
 * registry of deleted IDs. Slots retain view artifacts, never policy decisions.
 */
export function createZlozNodeBodyCache(): ZlozNodeBodyCache {
  const slots = new WeakMap<ZlozNode, ReturnType<typeof createLazy>>();
  return (node, view, args) => {
    const slot = slots.get(node) ?? createLazy();
    slots.set(node, slot);
    return slot(view, args);
  };
}
