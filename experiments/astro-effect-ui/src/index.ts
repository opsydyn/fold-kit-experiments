import { fileURLToPath } from 'node:url';

import type { AstroIntegration } from 'astro';

export default function effectUi(): AstroIntegration {
  return {
    name: 'astro-effect-ui',
    hooks: {
      'astro:config:setup': ({ addRenderer }) => {
        addRenderer({
          name: 'astro-effect-ui',
          serverEntrypoint: fileURLToPath(new URL('./server.ts', import.meta.url)),
          clientEntrypoint: fileURLToPath(new URL('./client.ts', import.meta.url)),
        });
      },
    },
  };
}
