import { expect, test } from 'bun:test';

import { drawsWithWebGpu } from '../src/renderer';

const at = (search: string) => ({ location: { search } });

test('WebGPU is used when the address asks for it, labels or not', () => {
  expect(drawsWithWebGpu(at('?renderer=webgpu'))).toBe(true);
  expect(drawsWithWebGpu(at('?renderer=webgl'))).toBe(false);
  expect(drawsWithWebGpu(at(''))).toBe(false);
});
