import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vanillaExtractPlugin()],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    // Vitest 5 caches transformed modules on disk between runs by default. A cached
    // `.css.ts` skips vanilla-extract's compiler, so a second run fails with "No CSS for
    // file"; the cache stays off until vanilla-extract works with it.
    fsModuleCache: false,
  },
});
