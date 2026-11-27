import type { Meta, StoryObj } from '@storybook/html';

import { Chart as BoxPlotApp } from '../apps/box-plot/main';
import { Chart as CalendarHeatmapApp } from '../apps/calendar-heatmap/main';
import { Chart as DensityContourApp } from '../apps/density-contour/main';
import { Chart as HeatmapApp } from '../apps/heatmap/main';
import { Chart as HistogramApp } from '../apps/histogram/main';
import { Chart as ViolinApp } from '../apps/violin/main';
import { mountStaticChart } from './mount-effect-ui';

export default {
  title: 'Charts/Statistical',
} satisfies Meta;

export const BoxPlot: StoryObj = {
  name: 'Box plot',
  render: () => mountStaticChart(BoxPlotApp),
  parameters: {
    docs: { description: { story: 'Salary distribution by level — IQR, whiskers, outliers.' } },
  },
};

export const Histogram: StoryObj = {
  name: 'Histogram',
  render: () => mountStaticChart(HistogramApp),
  parameters: {
    docs: { description: { story: 'Salary distribution — bin-based frequency chart.' } },
  },
};

export const Violin: StoryObj = {
  name: 'Violin chart',
  render: () => mountStaticChart(ViolinApp),
  parameters: { docs: { description: { story: 'KDE-smoothed salary distribution by level.' } } },
};

export const Heatmap: StoryObj = {
  name: 'Heatmap',
  render: () => mountStaticChart(HeatmapApp),
  parameters: { docs: { description: { story: 'Traffic by hour and day of week.' } } },
};

export const DensityContour: StoryObj = {
  name: 'Density contour',
  render: () => mountStaticChart(DensityContourApp),
  parameters: {
    docs: { description: { story: 'Bivariate density using marching-squares + KDE.' } },
  },
};

export const CalendarHeatmap: StoryObj = {
  name: 'Calendar heatmap',
  render: () => mountStaticChart(CalendarHeatmapApp),
  parameters: { docs: { description: { story: 'GitHub-style commit activity calendar.' } } },
};
