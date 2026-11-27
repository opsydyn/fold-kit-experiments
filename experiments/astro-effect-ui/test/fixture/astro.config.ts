import { fileURLToPath } from 'node:url';

import { defineConfig } from 'astro/config';

import effectUi from '../../../../packages/astro-effect-ui/src/index';

export default defineConfig({
  integrations: [effectUi()],
  adapter: {
    name: 'request-fixture',
    hooks: {
      'astro:config:done': ({ setAdapter }) => {
        setAdapter({
          name: 'request-fixture',
          entrypointResolution: 'auto',
          serverEntrypoint: fileURLToPath(new URL('./src/fetch.ts', import.meta.url)),
          supportedAstroFeatures: {},
        });
      },
    },
  },
});
