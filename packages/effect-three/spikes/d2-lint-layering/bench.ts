import { bench, run, summary } from 'mitata';

import { diffEffect } from './effectStyle.ts';
import { diffKernel } from './kernel.ts';
import { makeNodes } from './model.ts';

const a = makeNodes(1000, 0);
const same = a;
const oneChange = a.map((n, i) => (i === 500 ? { ...n, color: n.color + 1 } : n));
const allChange = makeNodes(1000, 3);

for (const [k, e] of [[diffKernel(a, oneChange), diffEffect(a, oneChange)]]) {
  if (JSON.stringify(k) !== JSON.stringify(e)) throw new Error('implementations disagree');
}
summary(() => {
  bench('kernel   noop 1k', () => diffKernel(a, same));
  bench('effect   noop 1k', () => diffEffect(a, same));
});
summary(() => {
  bench('kernel   1 change 1k', () => diffKernel(a, oneChange));
  bench('effect   1 change 1k', () => diffEffect(a, oneChange));
});
summary(() => {
  bench('kernel   all change 1k', () => diffKernel(a, allChange));
  bench('effect   all change 1k', () => diffEffect(a, allChange));
});
await run();
