import foldkit from '@opsydyn/astro-foldkit';
import { defineConfig } from 'astro/config';

// No adapter: Alchemy supplies Cloudflare's when it builds the site (see the plan,
// docs/superpowers/plans/2026-10-28-tech-radar-app.md).
export default defineConfig({
  integrations: [foldkit()],
  trailingSlash: 'always',
  server: { port: 4326 },
  devToolbar: { enabled: false },
});
