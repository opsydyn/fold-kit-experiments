import { fileURLToPath } from 'node:url';

import type { AstroIntegration } from 'astro';

type EffectUiOptions = { readonly interaction?: boolean };

export default function effectUi({ interaction = true }: EffectUiOptions = {}): AstroIntegration {
  return {
    name: 'astro-effect-ui',
    hooks: {
      'astro:config:setup': ({ addClientDirective, addRenderer }) => {
        if (interaction) {
          addClientDirective({
            name: 'interaction',
            entrypoint: fileURLToPath(new URL('./directive-interaction.ts', import.meta.url)),
          });
        }
        addRenderer({
          name: 'astro-effect-ui',
          serverEntrypoint: fileURLToPath(new URL('./server.ts', import.meta.url)),
          clientEntrypoint: fileURLToPath(new URL('./client.ts', import.meta.url)),
        });
      },
    },
  };
}
