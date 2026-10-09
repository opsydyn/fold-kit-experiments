import type { Meta, StoryObj } from '@storybook/html';

import * as ComparisonApp from '../apps/comparison/main';
import { mountFoldkit } from './mount';

export default {
  title: 'Charts/Comparison',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export const Workbench = {
  render: () => mountFoldkit(ComparisonApp),
} satisfies StoryObj;
