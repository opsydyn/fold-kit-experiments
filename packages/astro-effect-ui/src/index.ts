import { fileURLToPath } from 'node:url';

import type { AstroIntegration } from 'astro';

export type EffectUiOptions = { readonly interaction?: boolean };

const extension = import.meta.url.endsWith('.ts') ? 'ts' : 'mjs';

function entrypoint(name: 'client' | 'server' | 'directive-interaction'): string {
  return fileURLToPath(new URL(`./${name}.${extension}`, import.meta.url));
}

export default function effectUi({ interaction = true }: EffectUiOptions = {}): AstroIntegration {
  return {
    name: 'astro-effect-ui',
    hooks: {
      'astro:config:setup': ({ addClientDirective, addRenderer }) => {
        if (interaction) {
          addClientDirective({
            name: 'interaction',
            entrypoint: entrypoint('directive-interaction'),
          });
        }
        addRenderer({
          name: 'astro-effect-ui',
          serverEntrypoint: entrypoint('server'),
          clientEntrypoint: entrypoint('client'),
        });
      },
    },
  };
}
