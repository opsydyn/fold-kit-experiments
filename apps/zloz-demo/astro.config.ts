import foldkit from '@opsydyn/astro-foldkit';
import { defineConfig } from 'astro/config';

export default defineConfig({
  integrations: [foldkit()],
  vite: { build: { sourcemap: process.env.FLOW_BENCHMARK_SOURCEMAPS === '1' } },
  server: { port: 4327 },
  devToolbar: { enabled: false },
});
