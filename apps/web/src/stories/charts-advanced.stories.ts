import { BrowserHost } from '@effect/ui/html';
import type { Meta, StoryObj } from '@storybook/html';

import { AnimatedBar as AnimatedBarApp } from '../apps/animated-bar/main';
import { Chart as BulletApp } from '../apps/bullet/main';
import { Chart as BumpApp } from '../apps/bump/main';
import { Chart as CandlestickApp } from '../apps/candlestick/main';
import { Chart as CorrelationMatrixApp } from '../apps/correlation-matrix/main';
import { Chart as DivergingStackedBarApp } from '../apps/diverging-stacked-bar/main';
import { HistogramBrush as HistogramBrushApp } from '../apps/histogram-brush/main';
import { LinkedCharts as LinkedChartsApp } from '../apps/linked-charts/main';
import * as PhyllotaxisApp from '../apps/phyllotaxis/main';
import { Chart as RadarApp } from '../apps/radar/main';
import { Chart as StreamgraphApp } from '../apps/streamgraph/main';
import { Chart as WaterfallApp } from '../apps/waterfall/main';
import { Chart as WindRoseApp } from '../apps/wind-rose/main';
import { ZoomableLine as ZoomableLineApp } from '../apps/zoomable-line/main';
import { mountFoldkit } from './mount';
import { mountEffectUi, mountStaticChart } from './mount-effect-ui';

export default {
  title: 'Charts/Advanced',
} satisfies Meta;

export const AnimatedBar: StoryObj = {
  name: 'Animated bar (tween)',
  render: () =>
    mountEffectUi((host) => BrowserHost.mountEffect(AnimatedBarApp, {}, host, { head: false })),
  parameters: {
    docs: {
      description: {
        story: 'Bars grow on mount through a scoped animation frame subscription.',
      },
    },
  },
};

export const LinkedCharts: StoryObj = {
  name: 'Linked charts',
  render: () =>
    mountEffectUi((host) => BrowserHost.mountEffect(LinkedChartsApp, {}, host, { head: false })),
  parameters: {
    docs: {
      description: {
        story: 'Pointer and keyboard inspection link a salary scatter plot and histogram.',
      },
    },
  },
};

export const HistogramBrush: StoryObj = {
  name: 'Histogram brush filter',
  render: () =>
    mountEffectUi((host) => BrowserHost.mountEffect(HistogramBrushApp, {}, host, { head: false })),
  parameters: {
    docs: {
      description: {
        story: 'Drag across the histogram to highlight the matching bins and scatter points.',
      },
    },
  },
};

export const ZoomableLine: StoryObj = {
  name: 'Zoomable line',
  render: () =>
    mountEffectUi((host) => BrowserHost.mountEffect(ZoomableLineApp, {}, host, { head: false })),
  parameters: {
    docs: {
      description: {
        story: 'Use the date range controls to zoom, pan, and reset the stock price chart.',
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
  render: () => mountStaticChart(CandlestickApp),
  parameters: {
    docs: { description: { story: 'OHLC candlesticks — NVDA Apr–May 2024.' } },
  },
};

export const Waterfall: StoryObj = {
  name: 'Waterfall chart',
  render: () => mountStaticChart(WaterfallApp),
  parameters: {
    docs: { description: { story: 'Annual P&L — cumulative bridge bars with +/- colouring.' } },
  },
};

export const BulletChart: StoryObj = {
  name: 'Bullet chart',
  render: () => mountStaticChart(BulletApp),
  parameters: {
    docs: { description: { story: 'KPI vs target with comparative range bands.' } },
  },
};

export const BumpChart: StoryObj = {
  name: 'Bump / rank chart',
  render: () => mountStaticChart(BumpApp),
  parameters: {
    docs: { description: { story: 'JS framework rankings over time — curveNatural rank lines.' } },
  },
};

export const CorrelationMatrix: StoryObj = {
  name: 'Correlation matrix',
  render: () => mountStaticChart(CorrelationMatrixApp),
  parameters: {
    docs: {
      description: {
        story: 'Tech stock return correlations — scaleSequential Lab colour encoding.',
      },
    },
  },
};

export const DivergingStackedBar: StoryObj = {
  name: 'Diverging stacked bar',
  render: () => mountStaticChart(DivergingStackedBarApp),
  parameters: {
    docs: {
      description: { story: 'Likert survey responses — cumsum stacking, net score on hover.' },
    },
  },
};

export const WindRose: StoryObj = {
  name: 'Wind rose',
  render: () => mountStaticChart(WindRoseApp),
  parameters: {
    docs: {
      description: { story: 'Wind frequency by direction — polar wedge segments with gap.' },
    },
  },
};

export const Streamgraph: StoryObj = {
  name: 'Streamgraph',
  render: () => mountStaticChart(StreamgraphApp),
  parameters: {
    docs: {
      description: { story: 'JS framework downloads — flowing stacked areas around a baseline.' },
    },
  },
};

export const Radar: StoryObj = {
  name: 'Radar / spider chart',
  render: () => mountStaticChart(RadarApp),
  parameters: {
    docs: { description: { story: 'Language comparison across 5 dimensions.' } },
  },
};
