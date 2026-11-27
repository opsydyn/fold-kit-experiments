import { BrowserHost } from '@effect/ui/html';
import type { Meta, StoryObj } from '@storybook/html';

import { Chart as ChoroplethApp } from '../apps/choropleth/main';
import { Chart as MapProjectionsApp } from '../apps/map-projections/main';
import { Chart as TileGridMapApp } from '../apps/tile-grid-map/main';
import { ZoomableChoropleth as ZoomableChoroplethApp } from '../apps/zoomable-choropleth/main';
import { mountEffectUi, mountStaticChart } from './mount-effect-ui';

export default {
  title: 'Charts/Geographic',
} satisfies Meta;

export const MapProjections: StoryObj = {
  name: 'Map projections',
  render: () => mountStaticChart(MapProjectionsApp),
  parameters: {
    docs: {
      description: {
        story: 'Side-by-side equirectangular vs Mercator with graticule and 20 major cities.',
      },
    },
  },
};

export const ChoroplethMap: StoryObj = {
  name: 'Choropleth world map',
  render: () => mountStaticChart(ChoroplethApp),
  parameters: {
    docs: {
      description: {
        story:
          'World internet penetration % — TopoJSON world-atlas 110m, geoNaturalEarth1 with fitSize, scaleSequential color encoding. Hover a country to see name + value.',
      },
    },
  },
};

export const ZoomableChoroplethMap: StoryObj = {
  name: 'Zoomable choropleth map',
  render: () =>
    mountEffectUi((host) =>
      BrowserHost.mountEffect(ZoomableChoroplethApp, {}, host, { head: false }),
    ),
  parameters: {
    docs: {
      description: {
        story:
          'Zoom, pan, and reset the map of world internet penetration using the viewport controls.',
      },
    },
  },
};

export const TileGridMap: StoryObj = {
  name: 'Tile grid map',
  render: () => mountStaticChart(TileGridMapApp),
  parameters: {
    docs: {
      description: {
        story: 'US state GDP index on a 12×7 cartogram grid — scaleSequential + interpolateRgb.',
      },
    },
  },
};
