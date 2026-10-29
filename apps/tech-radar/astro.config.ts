import foldkit from '@opsydyn/astro-foldkit';
import { defineConfig } from 'astro/config';

// No adapter: Alchemy supplies Cloudflare's when it builds the site (see the plan,
// docs/superpowers/plans/2026-10-28-tech-radar-app.md).
export default defineConfig({
  // Where the radar is published: link previews, the feed and the sitemap give full
  // addresses on it. Preview stages link back to production, which is what a share wants.
  site: 'https://tech-radar-techradar-prod-p2g6lgx4bmhwwuk5.opsydyn.workers.dev',
  integrations: [foldkit()],
  // Fetch a page when a link to it is hovered or focused, so moving between pages is quick.
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  trailingSlash: 'always',
  server: { port: 4326 },
  devToolbar: { enabled: false },
});
