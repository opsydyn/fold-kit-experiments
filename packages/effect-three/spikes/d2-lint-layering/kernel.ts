// Kernel style: no `effect` import, plain control flow.
import type { Node, Op } from './model.ts';

export const diffKernel = (prev: ReadonlyArray<Node>, next: ReadonlyArray<Node>): Array<Op> => {
  const ops: Array<Op> = [];
  const prevByKey = new Map<string, Node>();
  for (const p of prev) prevByKey.set(p.key, p);
  const seen = new Set<string>();
  for (const n of next) {
    seen.add(n.key);
    const p = prevByKey.get(n.key);
    if (p === undefined) {
      ops.push({ _tag: 'Create', node: n });
      continue;
    }
    if (p === n) continue;
    const color = p.color === n.color ? undefined : n.color;
    const x = p.x === n.x ? undefined : n.x;
    if (color !== undefined || x !== undefined) ops.push({ _tag: 'Update', key: n.key, color, x });
  }
  for (const p of prev) if (!seen.has(p.key)) ops.push({ _tag: 'Remove', key: p.key });
  return ops;
};
