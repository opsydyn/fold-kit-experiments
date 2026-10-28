import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import { defineConfig } from 'vitest/config';

// The 2D radar's tests, as apps/web runs them. The 3D radar's run under `bun test ./test`.
export default defineConfig({
  plugins: [vanillaExtractPlugin()],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
