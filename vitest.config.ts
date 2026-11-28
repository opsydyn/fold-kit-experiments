import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'apps/web/vitest.config.ts',
      'apps/zloz-demo/vitest.config.ts',
      'packages/astro-effect-ui/vitest.config.ts',
      'packages/foldkit-dash/vitest.config.ts',
      'packages/foldkit-viz/vitest.config.ts',
    ],
  },
});
