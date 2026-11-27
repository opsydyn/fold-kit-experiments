import { testTags } from '@opsydyn/testing/tags';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    tags: testTags,
    name: 'astro-effect-ui',
    environment: 'happy-dom',
    include: ['test/client.test.ts'],
  },
});
