import { fileURLToPath } from 'node:url';

import effectUi from '@opsydyn/astro-effect-ui';
import { defineConfig } from 'astro/config';

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
