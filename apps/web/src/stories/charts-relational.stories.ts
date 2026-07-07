import type { Meta, StoryObj } from '@storybook/html';

import * as ArcDiagramApp from '../apps/arc-diagram/main';
import * as ChordApp from '../apps/chord/main';
import * as ForceGraphApp from '../apps/force-graph/main';
import * as PackedCirclesApp from '../apps/packed-circles/main';
import * as RadialTreeApp from '../apps/radial-tree/main';
import * as SankeyApp from '../apps/sankey/main';
import * as SunburstApp from '../apps/sunburst/main';
import * as TidyTreeApp from '../apps/tidy-tree/main';
import * as TreemapApp from '../apps/treemap/main';
import { mountFoldkit } from './mount';

export default {
  title: 'Charts/Relational',
} satisfies Meta;

export const Chord: StoryObj = {
  name: 'Chord diagram',
  render: () => mountFoldkit(ChordApp),
  parameters: { docs: { description: { story: 'Tech sector cross-investment flows.' } } },
};

export const Sankey: StoryObj = {
  name: 'Sankey diagram',
  render: () => mountFoldkit(SankeyApp),
  parameters: { docs: { description: { story: 'UK energy flow — source → sector → end use.' } } },
};

export const ForceGraph: StoryObj = {
  name: 'Force graph',
  render: () => mountFoldkit(ForceGraphApp),
  parameters: {
    docs: { description: { story: 'JS ecosystem dependencies — N-body force simulation.' } },
  },
};

export const PackedCircles: StoryObj = {
  name: 'Packed circles',
  render: () => mountFoldkit(PackedCirclesApp),
  parameters: { docs: { description: { story: 'Language families — circle packing hierarchy.' } } },
};

export const Treemap: StoryObj = {
  name: 'Treemap',
  render: () => mountFoldkit(TreemapApp),
  parameters: { docs: { description: { story: 'Tech revenue by segment — squarified treemap.' } } },
};

export const TidyTree: StoryObj = {
  name: 'Tidy tree',
  render: () => mountFoldkit(TidyTreeApp),
  parameters: {
    docs: { description: { story: 'Frontend tech stack — Reingold-Tilford layout.' } },
  },
};

export const RadialTree: StoryObj = {
  name: 'Radial tree',
  render: () => mountFoldkit(RadialTreeApp),
  parameters: {
    docs: { description: { story: 'Indo-European language family — radial dendrogram.' } },
  },
};

export const Sunburst: StoryObj = {
  name: 'Sunburst',
  render: () => mountFoldkit(SunburstApp),
  parameters: {
    docs: { description: { story: 'Tech market cap by sector — multi-ring sunburst.' } },
  },
};

export const ArcDiagram: StoryObj = {
  name: 'Arc diagram',
  render: () => mountFoldkit(ArcDiagramApp),
  parameters: {
    docs: { description: { story: 'JS tooling dependency network — arcs above a linear axis.' } },
  },
};
