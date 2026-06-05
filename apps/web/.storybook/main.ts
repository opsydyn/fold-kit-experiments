import type { StorybookConfig } from '@storybook/html-vite';

const config: StorybookConfig = {
  stories: ['../src/stories/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-a11y',
  ],
  framework: {
    name: '@storybook/html-vite',
    options: {},
  },
  async viteFinal(cfg) {
    // Dynamic imports keep ESM-only plugins out of the CJS esbuild-register
    // evaluation path while still injecting them into Vite at build/dev time.
    const [{ foldkit }, { vanillaExtractPlugin }] = await Promise.all([
      import('@foldkit/vite-plugin'),
      import('@vanilla-extract/vite-plugin'),
    ]);
    cfg.plugins ??= [];
    cfg.plugins.push(foldkit(), vanillaExtractPlugin());
    return cfg;
  },
};

export default config;
