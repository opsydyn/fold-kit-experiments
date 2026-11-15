import { compilePlot } from '@opsydyn/foldkit-viz/plot';
import { describe, expect, it } from 'vitest';

import { spec as arcDiagram } from './arc-diagram/spec';
import { spec as area } from './area/spec';
import { spec as bar } from './bar/spec';
import { spec as boxPlot } from './box-plot/spec';
import { spec as bubble } from './bubble/spec';
import { spec as bullet } from './bullet/spec';
import { spec as bump } from './bump/spec';
import { spec as calendarHeatmap } from './calendar-heatmap/spec';
import { spec as candlestick } from './candlestick/spec';
import { spec as chord } from './chord/spec';
import { spec as choropleth } from './choropleth/spec';
import { spec as correlationMatrix } from './correlation-matrix/spec';
import { spec as curveComparison } from './curve-comparison/spec';
import { spec as densityContour } from './density-contour/spec';
import { spec as divergingBar } from './diverging-bar/spec';
import { spec as divergingStackedBar } from './diverging-stacked-bar/spec';
import { spec as donut } from './donut/spec';
import { spec as forceGraph } from './force-graph/spec';
import { spec as gauge } from './gauge/spec';
import { spec as heatmap } from './heatmap/spec';
import { spec as histogram } from './histogram/spec';
import { spec as line } from './line/spec';
import { spec as logScatter } from './log-scatter/spec';
import { spec as packedCircles } from './packed-circles/spec';
import { spec as parallelCoords } from './parallel-coords/spec';
import { spec as radar } from './radar/spec';
import { spec as radialTree } from './radial-tree/spec';
import { spec as sankey } from './sankey/spec';
import { spec as scatter } from './scatter/spec';
import { spec as streamgraph } from './streamgraph/spec';
import { spec as sunburst } from './sunburst/spec';
import { spec as symbolScatter } from './symbol-scatter/spec';
import { spec as thresholdBar } from './threshold-bar/spec';
import { spec as tidyTree } from './tidy-tree/spec';
import { spec as tileGridMap } from './tile-grid-map/spec';
import { spec as timeline } from './timeline/spec';
import { spec as treemap } from './treemap/spec';
import { spec as violin } from './violin/spec';
import { spec as voronoiDiagram } from './voronoi-diagram/spec';
import { spec as waterfall } from './waterfall/spec';
import { spec as windRose } from './wind-rose/spec';

const promoted = {
  radar,
  windRose,
  donut,
  gauge,
  choropleth,
  chord,
  arcDiagram,
  forceGraph,
  packedCircles,
  tidyTree,
  radialTree,
  voronoiDiagram,
  boxPlot,
  candlestick,
  parallelCoords,
  sankey,
  sunburst,
  treemap,
  violin,
  area,
  bar,
  bubble,
  bullet,
  bump,
  calendarHeatmap,
  correlationMatrix,
  curveComparison,
  divergingBar,
  heatmap,
  line,
  logScatter,
  scatter,
  thresholdBar,
  tileGridMap,
  timeline,
  waterfall,
  divergingStackedBar,
  streamgraph,
  histogram,
  symbolScatter,
  densityContour,
};

describe('demos promoted to plot specs', () => {
  it.each(Object.entries(promoted))(
    '%s compiles to marks and survives a JSON round trip',
    (_, spec) => {
      const plot = compilePlot(spec);
      expect(plot.facets[0]?.marks.every((mark) => mark.graphics.length > 0)).toBe(true);
      expect(compilePlot(JSON.parse(JSON.stringify(spec)))).toEqual(plot);
    },
  );

  it('keeps every candle: a wick and a body per day, coloured by direction', () => {
    const [wicks, bodies] = compilePlot(candlestick).facets[0]?.marks ?? [];
    expect(wicks?.graphics).toHaveLength(30);
    expect(bodies?.graphics).toHaveLength(30);
    const colours = new Set(bodies?.graphics.map((g) => (g.kind === 'rect' ? g.fill : '')));
    expect(colours).toEqual(new Set(['#10b981', '#ef4444']));
  });

  it('thins crowded day labels on the candlestick axis', () => {
    const labels = compilePlot(candlestick).facets[0]?.x?.ticks.filter((t) => t.label !== '') ?? [];
    expect(labels.length).toBeGreaterThan(3);
    expect(labels.length).toBeLessThan(30);
  });
});
