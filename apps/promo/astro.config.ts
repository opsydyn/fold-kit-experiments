import foldkit from '@opsydyn/astro-foldkit';
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  site: process.env.PROMO_SITE_URL ?? 'https://opsydyn.github.io',
  base: process.env.PROMO_BASE_PATH ?? '/',
  integrations: [foldkit()],
  // Astro 7 creates a separate prerender environment; keep FoldKit bundled there too.
  vite: {
    plugins: [
      {
        name: 'promo:foldkit-environment',
        configEnvironment: () => ({
          resolve: { noExternal: ['foldkit', '@foldkit/ui', '@foldkit/devtools'] },
        }),
      },
    ],
  },
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
