import type { Meta, StoryObj } from '@storybook/html';
import * as ChoroplethApp from '../apps/choropleth/main';
import * as MapProjectionsApp from '../apps/map-projections/main';
import * as TileGridMapApp from '../apps/tile-grid-map/main';
import * as ZoomableChoroplethApp from '../apps/zoomable-choropleth/main';
import { mountFoldkit } from './mount';

export default {
  title: 'Charts/Geographic',
} satisfies Meta;

export const MapProjections: StoryObj = {
  name: 'Map projections',
  render: () => mountFoldkit(MapProjectionsApp),
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
  render: () => mountFoldkit(ChoroplethApp),
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
  render: () => mountFoldkit(ZoomableChoroplethApp),
  parameters: {
    docs: {
      description: {
        story:
          'World internet penetration % with zoom (+/−/⟲) and drag-to-pan. Applies TransformMatrix from math/zoom to the SVG countries group. Stroke width counter-scales so borders stay crisp at any zoom level.',
      },
    },
  },
};

export const TileGridMap: StoryObj = {
  name: 'Tile grid map',
  render: () => mountFoldkit(TileGridMapApp),
  parameters: {
    docs: {
      description: {
        story: 'US state GDP index on a 12×7 cartogram grid — scaleSequential + interpolateRgb.',
      },
    },
  },
};
