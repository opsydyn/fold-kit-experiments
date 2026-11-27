import type { Meta, StoryObj } from '@storybook/html';

import { Chart as AreaApp } from '../apps/area/main';
import { Chart as BarApp } from '../apps/bar/main';
import { Chart as BubbleApp } from '../apps/bubble/main';
import { Chart as DonutApp } from '../apps/donut/main';
import { Chart as LineApp } from '../apps/line/main';
import { Chart as ScatterApp } from '../apps/scatter/main';
import { mountStaticChart } from './mount-effect-ui';

// ── Bar ────────────────────────────────────────────────────────────────────────

export default {
  title: 'Charts/Basic',
} satisfies Meta;

export const Bar: StoryObj = {
  name: 'Bar chart',
  render: () => mountStaticChart(BarApp),
  parameters: {
    docs: { description: { story: 'Monthly figures — vertical bar chart with hover highlight.' } },
  },
};

export const Line: StoryObj = {
  name: 'Line chart',
  render: () => mountStaticChart(LineApp),
  parameters: {
    docs: { description: { story: 'Monthly trend — CatmullRom line with area fill.' } },
  },
};

export const Area: StoryObj = {
  name: 'Area chart',
  render: () => mountStaticChart(AreaApp),
  parameters: {
    docs: { description: { story: 'Monthly revenue — stacked area with gradient fill.' } },
  },
};

export const Donut: StoryObj = {
  name: 'Donut chart',
  render: () => mountStaticChart(DonutApp),
  parameters: { docs: { description: { story: 'Budget breakdown — arc segments with legend.' } } },
};

export const Scatter: StoryObj = {
  name: 'Scatter chart',
  render: () => mountStaticChart(ScatterApp),
  parameters: {
    docs: { description: { story: 'Experience vs salary — click to select points.' } },
  },
};

export const Bubble: StoryObj = {
  name: 'Bubble chart',
  render: () => mountStaticChart(BubbleApp),
  parameters: { docs: { description: { story: 'Price vs rating sized by sales volume.' } } },
};
