import { compilePlot } from '@opsydyn/foldkit-viz/plot';
import { describe, expect, it } from 'vitest';

import { spec } from '../choropleth/spec';
import { Message } from './message';
import { initialModel as model } from './model';
import { update } from './update';

describe('zoomable choropleth', () => {
  it('zooms between one and eight times, and pans the centre', () => {
    const zoomed = update(model, Message.ZoomedIn());
    expect(zoomed.zoom).toBe(2);
    expect(update(model, Message.ZoomedOut()).zoom).toBe(1);
    const east = update(zoomed, Message.PannedEast());
    expect(east.center[0]).toBeGreaterThan(zoomed.center[0]);
    expect(update(east, Message.ResetView())).toEqual(model);
  });

  it('draws more of the map off the panel as it zooms in', () => {
    const spread = (zoom: number) => {
      const plot = compilePlot({
        ...spec,
        projection: { type: 'naturalEarth1', zoom, center: model.center },
      });
      const numbers = (plot.facets[0]?.marks[0]?.graphics ?? []).flatMap((g) =>
        g.kind === 'path' ? (g.d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number) : [],
      );
      return Math.max(...numbers.slice(0, 2000)) - Math.min(...numbers.slice(0, 2000));
    };
    expect(spread(4)).toBeGreaterThan(spread(1));
  });
});
