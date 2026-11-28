import { testTags } from '@opsydyn/testing/tags';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    tags: testTags,
    name: 'foldkit-dash',
    include: ['test/csv.test.ts'],
  },
});
