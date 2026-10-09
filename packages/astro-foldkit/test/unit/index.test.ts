import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import foldkit from '../../src/index';

interface ViteConfig {
  readonly define?: Readonly<Record<string, string>>;
}

type VitePlugin = {
  readonly name: string;
  readonly config?: (
    config: ViteConfig,
    environment: { readonly command: 'build' | 'serve'; readonly mode: string },
  ) => ViteConfig | Promise<ViteConfig | undefined> | undefined;
};

const configuredBuildId = async (integration: ReturnType<typeof foldkit>) => {
  const updateCalls: Array<{ readonly vite?: { readonly plugins?: ReadonlyArray<unknown> } }> = [];
  const setup = integration.hooks['astro:config:setup'];
  if (setup === undefined) throw new Error('Expected astro:config:setup hook');
  // SAFETY: The test fixture establishes this value before the assertion.
  setup({
    addRenderer: () => {},
    updateConfig: (config: { readonly vite?: { readonly plugins?: ReadonlyArray<unknown> } }) => {
      updateCalls.push(config);
    },
  } as never);
  const pluginGroups = updateCalls[0]?.vite?.plugins ?? [];
  // SAFETY: The test fixture establishes this value before the assertion.
  const plugins = pluginGroups.flat(Number.POSITIVE_INFINITY) as ReadonlyArray<VitePlugin>;
  const buildToken = plugins.find((plugin) => plugin.name === 'foldkit:build-token');
  const viteConfig = await buildToken?.config?.({}, { command: 'build', mode: 'production' });
  // SAFETY: The test fixture establishes this value before the assertion.
  const define = viteConfig?.define as Record<string, string> | undefined;
  return define?.['import.meta.env.FOLDKIT_BUILD_ID'];
};

describe('foldkit integration', () => {
  let previousBuildId: string | undefined;
  beforeEach(() => {
    previousBuildId = process.env.FOLDKIT_BUILD_ID;
    delete process.env.FOLDKIT_BUILD_ID;
  });
  afterEach(() => {
    if (previousBuildId === undefined) delete process.env.FOLDKIT_BUILD_ID;
    else process.env.FOLDKIT_BUILD_ID = previousBuildId;
  });

  it('passes a configured server build identity to the FoldKit Vite plugin', async () => {
    const integration = foldkit({ server: { buildId: 'release-123' } });

    expect(await configuredBuildId(integration)).toBe('"release-123"');
  });

  it('lets FoldKit generate the build identity when no override is configured', async () => {
    const integration = foldkit();

    expect(await configuredBuildId(integration)).toBeUndefined();
  });

  it('forwards the environment deployment identity when no option overrides it', async () => {
    process.env.FOLDKIT_BUILD_ID = 'environment-release';
    expect(await configuredBuildId(foldkit())).toBe('"environment-release"');
  });

  it('rejects an explicitly empty server build identity', () => {
    expect(() => foldkit({ server: { buildId: '  ' } })).toThrow('server.buildId');
  });
});
