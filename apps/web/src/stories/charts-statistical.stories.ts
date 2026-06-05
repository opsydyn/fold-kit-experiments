import type { Meta, StoryObj } from '@storybook/html';
import * as BoxPlotApp from '../apps/box-plot/main';
import * as HistogramApp from '../apps/histogram/main';
import * as ViolinApp from '../apps/violin/main';
import * as HeatmapApp from '../apps/heatmap/main';
import * as DensityContourApp from '../apps/density-contour/main';
import * as CalendarHeatmapApp from '../apps/calendar-heatmap/main';
import { mountFoldkit } from './mount';

export default {
  title: 'Charts/Statistical',
} satisfies Meta;

export const BoxPlot: StoryObj = {
  name: 'Box plot',
  render: () => mountFoldkit(BoxPlotApp),
  parameters: { docs: { description: { story: 'Salary distribution by level — IQR, whiskers, outliers.' } } },
};

export const Histogram: StoryObj = {
  name: 'Histogram',
  render: () => mountFoldkit(HistogramApp),
  parameters: { docs: { description: { story: 'Salary distribution — bin-based frequency chart.' } } },
};

export const Violin: StoryObj = {
  name: 'Violin chart',
  render: () => mountFoldkit(ViolinApp),
  parameters: { docs: { description: { story: 'KDE-smoothed salary distribution by level.' } } },
};

export const Heatmap: StoryObj = {
  name: 'Heatmap',
  render: () => mountFoldkit(HeatmapApp),
  parameters: { docs: { description: { story: 'Traffic by hour and day of week.' } } },
};

export const DensityContour: StoryObj = {
  name: 'Density contour',
  render: () => mountFoldkit(DensityContourApp),
  parameters: { docs: { description: { story: 'Bivariate density using marching-squares + KDE.' } } },
};

export const CalendarHeatmap: StoryObj = {
  name: 'Calendar heatmap',
  render: () => mountFoldkit(CalendarHeatmapApp),
  parameters: { docs: { description: { story: 'GitHub-style commit activity calendar.' } } },
};
