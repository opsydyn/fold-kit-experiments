import effectUi from '@opsydyn/astro-effect-ui';
import { defineConfig } from 'astro/config';

export default defineConfig({
  integrations: [effectUi()],
  vite: { build: { sourcemap: process.env.FLOW_BENCHMARK_SOURCEMAPS === '1' } },
  server: { port: 4327 },
  devToolbar: { enabled: false },
});
