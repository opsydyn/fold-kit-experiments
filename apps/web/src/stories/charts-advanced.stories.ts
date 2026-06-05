import type { Meta, StoryObj } from '@storybook/html';
import * as AnimatedBarApp from '../apps/animated-bar/main';
import * as LinkedChartsApp from '../apps/linked-charts/main';
import * as ZoomableLineApp from '../apps/zoomable-line/main';
import * as PhyllotaxisApp from '../apps/phyllotaxis/main';
import * as CandlestickApp from '../apps/candlestick/main';
import * as WaterfallApp from '../apps/waterfall/main';
import * as BulletApp from '../apps/bullet/main';
import * as BumpApp from '../apps/bump/main';
import * as CorrelationMatrixApp from '../apps/correlation-matrix/main';
import * as DivergingStackedBarApp from '../apps/diverging-stacked-bar/main';
import * as WindRoseApp from '../apps/wind-rose/main';
import * as StreamgraphApp from '../apps/streamgraph/main';
import * as RadarApp from '../apps/radar/main';
import { mountFoldkit } from './mount';

export default {
  title: 'Charts/Advanced',
} satisfies Meta;

export const AnimatedBar: StoryObj = {
  name: 'Animated bar (tween)',
  render: () => mountFoldkit(AnimatedBarApp),
  parameters: {
    docs: {
      description: {
        story: 'TEA-native tween animation — bars grow on mount via animationFrame subscription.',
      },
    },
  },
};

export const LinkedCharts: StoryObj = {
  name: 'Linked charts',
  render: () => mountFoldkit(LinkedChartsApp),
  parameters: {
    docs: {
      description: {
        story: 'Scatter + bar sharing selection state — brush/click in one updates the other.',
      },
    },
  },
};

export const ZoomableLine: StoryObj = {
  name: 'Zoomable line',
  render: () => mountFoldkit(ZoomableLineApp),
  parameters: {
    docs: {
      description: {
        story: 'Stock price chart — scroll to zoom, drag to pan, mini-map overview.',
      },
    },
  },
};

export const Phyllotaxis: StoryObj = {
  name: 'Phyllotaxis + minimap',
  render: () => mountFoldkit(PhyllotaxisApp),
  parameters: {
    docs: { description: { story: 'Golden-angle spiral — zoom and mini-map viewport indicator.' } },
  },
};

export const Candlestick: StoryObj = {
  name: 'Candlestick chart',
  render: () => mountFoldkit(CandlestickApp),
  parameters: {
    docs: { description: { story: 'OHLC candlesticks — NVDA Apr–May 2024.' } },
  },
};

export const Waterfall: StoryObj = {
  name: 'Waterfall chart',
  render: () => mountFoldkit(WaterfallApp),
  parameters: {
    docs: { description: { story: 'Annual P&L — cumulative bridge bars with +/- colouring.' } },
  },
};

export const BulletChart: StoryObj = {
  name: 'Bullet chart',
  render: () => mountFoldkit(BulletApp),
  parameters: {
    docs: { description: { story: 'KPI vs target with comparative range bands.' } },
  },
};

export const BumpChart: StoryObj = {
  name: 'Bump / rank chart',
  render: () => mountFoldkit(BumpApp),
  parameters: {
    docs: { description: { story: 'JS framework rankings over time — curveNatural rank lines.' } },
  },
};

export const CorrelationMatrix: StoryObj = {
  name: 'Correlation matrix',
  render: () => mountFoldkit(CorrelationMatrixApp),
  parameters: {
    docs: { description: { story: 'Tech stock return correlations — scaleSequential Lab colour encoding.' } },
  },
};

export const DivergingStackedBar: StoryObj = {
  name: 'Diverging stacked bar',
  render: () => mountFoldkit(DivergingStackedBarApp),
  parameters: {
    docs: { description: { story: 'Likert survey responses — cumsum stacking, net score on hover.' } },
  },
};

export const WindRose: StoryObj = {
  name: 'Wind rose',
  render: () => mountFoldkit(WindRoseApp),
  parameters: {
    docs: { description: { story: 'Wind frequency by direction — polar wedge segments with gap.' } },
  },
};

export const Streamgraph: StoryObj = {
  name: 'Streamgraph',
  render: () => mountFoldkit(StreamgraphApp),
  parameters: {
    docs: { description: { story: 'JS framework downloads — flowing stacked areas around a baseline.' } },
  },
};

export const Radar: StoryObj = {
  name: 'Radar / spider chart',
  render: () => mountFoldkit(RadarApp),
  parameters: {
    docs: { description: { story: 'Language comparison across 5 dimensions.' } },
  },
};
