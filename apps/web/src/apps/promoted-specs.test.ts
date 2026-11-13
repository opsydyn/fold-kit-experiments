import { compilePlot } from '@opsydyn/foldkit-viz/plot';
import { describe, expect, it } from 'vitest';

import { spec as boxPlot } from './box-plot/spec';
import { spec as candlestick } from './candlestick/spec';
import { spec as parallelCoords } from './parallel-coords/spec';
import { spec as sankey } from './sankey/spec';
import { spec as sunburst } from './sunburst/spec';
import { spec as treemap } from './treemap/spec';
import { spec as violin } from './violin/spec';

const promoted = { boxPlot, candlestick, parallelCoords, sankey, sunburst, treemap, violin };

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
