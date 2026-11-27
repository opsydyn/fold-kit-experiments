import type { Meta, StoryObj } from '@storybook/html';

import { Chart as ArcDiagramApp } from '../apps/arc-diagram/main';
import { Chart as ChordApp } from '../apps/chord/main';
import { Chart as ForceGraphApp } from '../apps/force-graph/main';
import { Chart as PackedCirclesApp } from '../apps/packed-circles/main';
import { Chart as RadialTreeApp } from '../apps/radial-tree/main';
import { Chart as SankeyApp } from '../apps/sankey/main';
import { Chart as SunburstApp } from '../apps/sunburst/main';
import { Chart as TidyTreeApp } from '../apps/tidy-tree/main';
import { Chart as TreemapApp } from '../apps/treemap/main';
import { mountStaticChart } from './mount-effect-ui';

export default {
  title: 'Charts/Relational',
} satisfies Meta;

export const Chord: StoryObj = {
  name: 'Chord diagram',
  render: () => mountStaticChart(ChordApp),
  parameters: { docs: { description: { story: 'Tech sector cross-investment flows.' } } },
};

export const Sankey: StoryObj = {
  name: 'Sankey diagram',
  render: () => mountStaticChart(SankeyApp),
  parameters: { docs: { description: { story: 'UK energy flow — source → sector → end use.' } } },
};

export const ForceGraph: StoryObj = {
  name: 'Force graph',
  render: () => mountStaticChart(ForceGraphApp),
  parameters: {
    docs: { description: { story: 'JS ecosystem dependencies — N-body force simulation.' } },
  },
};

export const PackedCircles: StoryObj = {
  name: 'Packed circles',
  render: () => mountStaticChart(PackedCirclesApp),
  parameters: { docs: { description: { story: 'Language families — circle packing hierarchy.' } } },
};

export const Treemap: StoryObj = {
  name: 'Treemap',
  render: () => mountStaticChart(TreemapApp),
  parameters: { docs: { description: { story: 'Tech revenue by segment — squarified treemap.' } } },
};

export const TidyTree: StoryObj = {
  name: 'Tidy tree',
  render: () => mountStaticChart(TidyTreeApp),
  parameters: {
    docs: { description: { story: 'Frontend tech stack — Reingold-Tilford layout.' } },
  },
};

export const RadialTree: StoryObj = {
  name: 'Radial tree',
  render: () => mountStaticChart(RadialTreeApp),
  parameters: {
    docs: { description: { story: 'Indo-European language family — radial dendrogram.' } },
  },
};

export const Sunburst: StoryObj = {
  name: 'Sunburst',
  render: () => mountStaticChart(SunburstApp),
  parameters: {
    docs: { description: { story: 'Tech market cap by sector — multi-ring sunburst.' } },
  },
};

export const ArcDiagram: StoryObj = {
  name: 'Arc diagram',
  render: () => mountStaticChart(ArcDiagramApp),
  parameters: {
    docs: { description: { story: 'JS tooling dependency network — arcs above a linear axis.' } },
  },
};
