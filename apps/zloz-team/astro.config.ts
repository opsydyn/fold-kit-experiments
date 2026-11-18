import foldkit from '@opsydyn/astro-foldkit';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import { defineConfig } from 'astro/config';

// Alchemy supplies the Cloudflare SSR adapter and private Service Binding.
export default defineConfig({
  output: 'server',
  integrations: [foldkit()],
  server: { port: 4331 },
  vite: {
    plugins: [vanillaExtractPlugin()],
    server: {
      // Native SQLite, bundles and logs are runtime state, never HMR source.
      watch: {
        ignored: ['**/.alchemy', '**/.alchemy/**', '**/.wrangler', '**/.wrangler/**'],
      },
    },
  },
  devToolbar: { enabled: false },
});
