import node from '@astrojs/node';
import foldkit from '@opsydyn/astro-foldkit';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'server',
  devToolbar: { enabled: false },
  integrations: [foldkit()],

  vite: {
    plugins: [vanillaExtractPlugin()],
  },

  adapter: node({
    mode: 'standalone',
  }),
});
