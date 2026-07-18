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
