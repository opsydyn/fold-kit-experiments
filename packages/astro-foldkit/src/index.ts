import { fileURLToPath } from 'node:url';
import { foldkit as foldkitVitePlugin } from '@foldkit/vite-plugin';
import type { AstroIntegration } from 'astro';

export default function foldkit(): AstroIntegration {
  return {
    name: 'astro-foldkit',
    hooks: {
      'astro:config:setup': ({ addRenderer, updateConfig }) => {
        addRenderer({
          name: 'astro-foldkit',
          clientEntrypoint: fileURLToPath(new URL('./client.mjs', import.meta.url)),
          serverEntrypoint: fileURLToPath(new URL('./server.mjs', import.meta.url)),
        });
        updateConfig({
          vite: {
            plugins: [foldkitVitePlugin()],
          },
        });
      },
    },
  };
}
