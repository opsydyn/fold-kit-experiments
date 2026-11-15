import { expect, test } from 'bun:test';

import { createEditor } from '../src/index';
import { renderPngExport } from '../src/png-browser';
const input = {
  snapshot: createEditor({ nodes: [], edges: [] }),
  svg: {
    title: 'SSR',
    background: { type: 'transparent' as const },
    font: { family: 'sans-serif', size: 14, weight: 400 },
    region: { type: 'model', padding: 0 } as const,
    theme: { colorScheme: 'light' as const },
    renderers: { nodes: 'built-in' as const, edges: 'built-in' as const },
  },
};
test('optional browser entry imports without DOM, reports unsupported SSR and respects pre-abort', async () => {
  expect(await renderPngExport(input)).toMatchObject({ type: 'failed', code: 'unsupported' });
  const controller = new AbortController();
  controller.abort();
  expect(await renderPngExport(input, { signal: controller.signal })).toMatchObject({
    type: 'failed',
    code: 'aborted',
  });
  await expect(renderPngExport(input, { timeoutMs: 0 })).rejects.toThrow();
});
