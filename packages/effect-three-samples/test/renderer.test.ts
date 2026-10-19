import { expect, test } from 'bun:test';

import { drawsWithWebGpu, rendererNotice } from '../src/renderer';

const at = (search: string) => ({ location: { search } });

test('WebGPU is used when asked for, unless the sample draws labels', () => {
  expect(drawsWithWebGpu(at('?renderer=webgpu'), { labels: false })).toBe(true);
  expect(drawsWithWebGpu(at('?renderer=webgpu'), { labels: true })).toBe(false);
  expect(drawsWithWebGpu(at(''), { labels: false })).toBe(false);
});

test('a sample that falls back says why, and only then', () => {
  expect(rendererNotice(at('?renderer=webgpu'), { labels: true })).toContain('WebGL');
  expect(rendererNotice(at('?renderer=webgpu'), { labels: false })).toBeNull();
  expect(rendererNotice(at(''), { labels: true })).toBeNull();
});
