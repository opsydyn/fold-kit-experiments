import { testTags } from '@opsydyn/testing/tags';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    tags: testTags,
    name: 'astro-foldkit',
    include: ['test/unit/client-helpers.test.ts'],
  },
});
