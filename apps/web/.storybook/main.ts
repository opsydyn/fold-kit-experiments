import type { StorybookConfig } from '@storybook/html-vite';

// GitHub Actions sets GITHUB_ACTIONS=true automatically; local dev uses root.
const PAGES_BASE = process.env.GITHUB_ACTIONS ? '/fold-kit-experiments/' : '/';

const config: StorybookConfig = {
  stories: ['../src/stories/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-a11y'],
  framework: {
    name: '@storybook/html-vite',
    options: {},
  },
  async viteFinal(cfg) {
    cfg.base = PAGES_BASE;
    // Import the ESM-only plugin outside the CJS configuration evaluation path.
    const { vanillaExtractPlugin } = await import('@vanilla-extract/vite-plugin');
    cfg.plugins ??= [];
    cfg.plugins.push(vanillaExtractPlugin());
    return cfg;
  },
};

export default config;
