import type { Preview } from '@storybook/html';
import '../src/styles/chart-tokens.css';

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0d0d1a' },
        { name: 'light', value: '#f8fafc' },
      ],
    },
    layout: 'fullscreen',
    a11y: { config: {} },
  },
  decorators: [
    (Story) => {
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'padding: 32px; box-sizing: border-box; width: 100%;';
      wrapper.appendChild(Story() as Node);
      return wrapper;
    },
  ],
};

export default preview;
