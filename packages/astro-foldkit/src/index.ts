import { fileURLToPath } from 'node:url';

import { foldkit as foldkitVitePlugin } from '@foldkit/vite-plugin';
import type { AstroIntegration } from 'astro';

export type { NavigationConfig, NavigationEvent, NavigationPhase } from './navigation';

export type FoldkitIntegrationOptions = Readonly<{
  server?: Readonly<{
    buildId: string;
  }>;
}>;

export default function foldkit(options: FoldkitIntegrationOptions = {}): AstroIntegration {
  const configuredBuildId = options.server?.buildId;
  if (configuredBuildId !== undefined && configuredBuildId.trim() === '')
    throw new Error('foldkit({ server: { buildId } }) requires a non-empty server.buildId.');
  const buildId = configuredBuildId ?? 'development';
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
            plugins: [foldkitVitePlugin({ buildId })],
          },
        });
      },
    },
  };
}
