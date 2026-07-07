import type { Meta, StoryObj } from '@storybook/html';

import * as AreaApp from '../apps/area/main';
import * as BarApp from '../apps/bar/main';
import * as BubbleApp from '../apps/bubble/main';
import * as DonutApp from '../apps/donut/main';
import * as LineApp from '../apps/line/main';
import * as ScatterApp from '../apps/scatter/main';
import { mountFoldkit } from './mount';

// ── Bar ────────────────────────────────────────────────────────────────────────

export default {
  title: 'Charts/Basic',
} satisfies Meta;

export const Bar: StoryObj = {
  name: 'Bar chart',
  render: () => mountFoldkit(BarApp),
  parameters: {
    docs: { description: { story: 'Monthly figures — vertical bar chart with hover highlight.' } },
  },
};

export const Line: StoryObj = {
  name: 'Line chart',
  render: () => mountFoldkit(LineApp),
  parameters: {
    docs: { description: { story: 'Monthly trend — CatmullRom line with area fill.' } },
  },
};

export const Area: StoryObj = {
  name: 'Area chart',
  render: () => mountFoldkit(AreaApp),
  parameters: {
    docs: { description: { story: 'Monthly revenue — stacked area with gradient fill.' } },
  },
};

export const Donut: StoryObj = {
  name: 'Donut chart',
  render: () => mountFoldkit(DonutApp),
  parameters: { docs: { description: { story: 'Budget breakdown — arc segments with legend.' } } },
};

export const Scatter: StoryObj = {
  name: 'Scatter chart',
  render: () => mountFoldkit(ScatterApp),
  parameters: {
    docs: { description: { story: 'Experience vs salary — click to select points.' } },
  },
};

export const Bubble: StoryObj = {
  name: 'Bubble chart',
  render: () => mountFoldkit(BubbleApp),
  parameters: { docs: { description: { story: 'Price vs rating sized by sales volume.' } } },
};
