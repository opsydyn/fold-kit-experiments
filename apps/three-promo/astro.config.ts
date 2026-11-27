import effectUi from '@opsydyn/astro-effect-ui';
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  site: process.env.THREE_PROMO_SITE_URL ?? 'https://opsydyn.github.io',
  base: process.env.THREE_PROMO_BASE_PATH ?? '/',
  integrations: [effectUi()],
  trailingSlash: 'always',
  server: {
    port: 4323,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
  devToolbar: { enabled: false },
});
