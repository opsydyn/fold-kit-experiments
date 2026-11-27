import effectUi from '@opsydyn/astro-effect-ui';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import { defineConfig } from 'astro/config';

// Alchemy supplies the Cloudflare SSR adapter and private Service Binding.
export default defineConfig({
  output: 'server',
  integrations: [effectUi()],
  server: { port: 4331 },
  vite: {
    plugins: [vanillaExtractPlugin()],
    // Prebundle the lazy layout and generator dependencies before a board joins.
    optimizeDeps: {
      include: ['likec4/generators/likec4', '@opsydyn/foldkit-zloz-elk > elkjs/lib/elk.bundled.js'],
    },
    server: {
      // Native SQLite, bundles and logs are runtime state, never HMR source.
      watch: {
        ignored: ['**/.alchemy', '**/.alchemy/**', '**/.wrangler', '**/.wrangler/**'],
      },
    },
  },
  devToolbar: { enabled: false },
});
