import { describe, expect, it } from 'bun:test';

import foldkit from '../../src/index';

type VitePlugin = {
  readonly name: string;
  readonly config?: (
    config: Record<string, unknown>,
    environment: { readonly command: 'build' | 'serve'; readonly mode: string },
  ) => Record<string, unknown> | Promise<Record<string, unknown> | undefined> | undefined;
};

const configuredBuildId = async (integration: ReturnType<typeof foldkit>) => {
  const updateCalls: Array<{ readonly vite?: { readonly plugins?: ReadonlyArray<unknown> } }> = [];
  const setup = integration.hooks['astro:config:setup'];
  if (setup === undefined) throw new Error('Expected astro:config:setup hook');
  setup({
    addRenderer: () => {},
    updateConfig: (config: { readonly vite?: { readonly plugins?: ReadonlyArray<unknown> } }) => {
      updateCalls.push(config);
    },
  } as never);
  const pluginGroups = updateCalls[0]?.vite?.plugins ?? [];
  const plugins = pluginGroups.flat(Number.POSITIVE_INFINITY) as ReadonlyArray<VitePlugin>;
  const buildToken = plugins.find((plugin) => plugin.name === 'foldkit:build-token');
  const viteConfig = await buildToken?.config?.({}, { command: 'build', mode: 'production' });
  const define = viteConfig?.define as Record<string, string> | undefined;
  return define?.['import.meta.env.FOLDKIT_BUILD_ID'];
};

describe('foldkit integration', () => {
  it('passes a configured server build identity to the FoldKit Vite plugin', async () => {
    const integration = foldkit({ server: { buildId: 'release-123' } });

    expect(await configuredBuildId(integration)).toBe('"release-123"');
  });

  it('uses the development build identity as integration configuration default', async () => {
    const integration = foldkit();

    expect(await configuredBuildId(integration)).toBe('"development"');
  });
});
