import { expect, test } from 'bun:test';

import { captureGroupDocumentV3, type ZlozGroupPngExportInputV3 } from '../src/index';
import { renderGroupPngExportV3, renderPngExport } from '../src/png-browser';
import wire from './fixtures/group-document-v3-ported.json';
const input: ZlozGroupPngExportInputV3 = {
  document: captureGroupDocumentV3(wire),
  svg: {
    title: 'SSR native v3',
    region: { type: 'model', padding: 40 },
    theme: { colorScheme: 'light' },
    background: { type: 'theme' },
    font: { family: 'sans-serif', size: 14, weight: 400 },
    renderers: { nodes: 'built-in', edges: 'built-in' },
  },
  writing: { allowLosses: true },
};
test('native browser entry stays SSR-safe and recognizes pre-abort without allocating a browser resource', async () => {
  expect(await renderGroupPngExportV3(input)).toMatchObject({
    type: 'failed',
    code: 'unsupported',
  });
  const controller = new AbortController();
  controller.abort();
  expect(await renderGroupPngExportV3(input, { signal: controller.signal })).toMatchObject({
    type: 'failed',
    code: 'aborted',
  });
  await expect(renderGroupPngExportV3(input, { timeoutMs: 0 })).rejects.toThrow();
  expect(
    await renderPngExport({
      snapshot: { graph: { nodes: [], edges: [] } },
      svg: input.svg,
      writing: { allowLosses: true },
    }),
  ).toMatchObject({ type: 'failed', code: 'unsupported' });
});
