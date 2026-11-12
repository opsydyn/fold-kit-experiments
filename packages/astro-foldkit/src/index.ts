import { fileURLToPath } from 'node:url';

import { foldkit as foldkitVitePlugin } from '@foldkit/vite-plugin';
import type { AstroIntegration } from 'astro';

import type { InteractionOptions } from './directive-interaction';
import { islandScanPlugin } from './island-scan';

export type { InteractionOptions } from './directive-interaction';
export type { NavigationConfig, NavigationEvent, NavigationPhase } from './navigation';

declare module 'astro' {
  interface AstroClientDirectives {
    /**
     * Hydrate a pre-rendered FoldKit island on the reader's first pointer press,
     * focus or key press inside it, replaying clicks, typed values and focus
     * that happened before it booted. Requires `lazyApp(load, { prerender: true })`.
     */
    'client:interaction'?: InteractionOptions | boolean;
  }
}

export type FoldkitIntegrationOptions = Readonly<{
  server?: Readonly<{
    buildId: string;
  }>;
}>;

export default function foldkit(options: FoldkitIntegrationOptions = {}): AstroIntegration {
  const configuredBuildId = options.server?.buildId;
  if (configuredBuildId !== undefined && configuredBuildId.trim() === '')
    throw new Error('foldkit({ server: { buildId } }) requires a non-empty server.buildId.');
  return {
    name: 'astro-foldkit',
    hooks: {
      'astro:config:setup': ({ config, addClientDirective, addRenderer, updateConfig }) => {
        addRenderer({
          name: 'astro-foldkit',
          clientEntrypoint: fileURLToPath(new URL('./client.mjs', import.meta.url)),
          serverEntrypoint: fileURLToPath(new URL('./server.mjs', import.meta.url)),
        });
        addClientDirective({
          name: 'interaction',
          entrypoint: fileURLToPath(new URL('./directive-interaction.mjs', import.meta.url)),
        });
        updateConfig({
          vite: {
            plugins: [
              foldkitVitePlugin(options.server),
              islandScanPlugin(fileURLToPath(config.root), fileURLToPath(config.srcDir)),
            ],
          },
        });
      },
    },
  };
}
