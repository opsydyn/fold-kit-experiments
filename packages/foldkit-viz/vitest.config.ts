import { testTags } from '@opsydyn/testing/tags';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    tags: testTags,
    name: 'foldkit-viz',
    include: ['test/cartesian-scales.test.ts'],
  },
});
