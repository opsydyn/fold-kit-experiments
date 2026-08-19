import cloudflare from '@astrojs/cloudflare';
import foldkit from '@opsydyn/astro-foldkit';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import { defineConfig } from 'astro/config';

const isDevCommand = process.argv.includes('dev');

export default defineConfig({
  output: 'server',
  devToolbar: { enabled: false },
  integrations: [foldkit({ server: { buildId: process.env.FOLDKIT_BUILD_ID ?? 'development' } })],

  vite: {
    plugins: [vanillaExtractPlugin()],
  },

  adapter: isDevCommand ? undefined : cloudflare(),
});
