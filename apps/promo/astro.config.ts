import foldkit from '@opsydyn/astro-foldkit';
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  integrations: [foldkit()],
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
