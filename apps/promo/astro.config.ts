import effectUi from '@opsydyn/astro-effect-ui';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  site: process.env.PROMO_SITE_URL ?? 'https://opsydyn.github.io',
  base: process.env.PROMO_BASE_PATH ?? '/',
  integrations: [effectUi({ interaction: false })],
  // The DuckDB and million-point examples reuse the web app's islands, styled with vanilla-extract.
  vite: { plugins: [vanillaExtractPlugin()] },
  trailingSlash: 'always',
  server: {
    port: 4322,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
  devToolbar: { enabled: false },
});
