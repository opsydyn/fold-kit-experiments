import { describe, expect, it } from 'bun:test';

import { compilePlot } from '../src/plot';
import type { Graphic, PlotSpec } from '../src/plot';
import type { GeoFeatureCollection } from '../src/shape/geo';

const base = {
  width: 400,
  height: 200,
  margins: { top: 0, right: 0, bottom: 0, left: 0 },
} as const;
const square = (lng: number, lat: number) => ({
  type: 'Polygon' as const,
  coordinates: [
    [
      [lng, lat],
      [lng + 10, lat],
      [lng + 10, lat + 10],
      [lng, lat + 10],
      [lng, lat],
    ] as const,
  ],
});
const countries: GeoFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', geometry: square(0, 0), properties: { name: 'West', gdp: 10 } },
    { type: 'Feature', geometry: square(20, 0), properties: { name: 'East', gdp: 30 } },
  ],
};
const map: PlotSpec = {
  ...base,
  projection: { type: 'equirectangular' },
  marks: [{ mark: 'geo', features: countries, fill: 'gdp', title: 'name' }],
};
const graphics = (spec: PlotSpec, mark = 0): ReadonlyArray<Graphic> =>
  compilePlot(spec).facets[0]?.marks[mark]?.graphics ?? [];
const numbersIn = (g: Graphic | undefined): ReadonlyArray<number> =>
  g?.kind === 'path' ? (g.d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number) : [];

describe('projected maps', () => {
  it('draws each feature as a path, filled from its properties, with no axes', () => {
    const plot = compilePlot(map);
    const [west, east] = plot.facets[0]?.marks[0]?.graphics ?? [];
    expect(plot.facets[0]?.x).toBeNull();
    const fillOf = (g: Graphic | undefined) => (g?.kind === 'path' ? g.fill : '');
    expect(west?.title).toBe('West');
    expect(fillOf(west)).not.toBe(fillOf(east));
    expect(plot.legends[0]?.kind).toBe('continuous');
  });

  it('fits the features to the panel', () => {
    const all = graphics(map).flatMap(numbersIn);
    expect(Math.min(...all)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...all)).toBeLessThanOrEqual(400);
    expect(Math.max(...all)).toBeGreaterThan(300);
  });

  it('places dots by longitude and latitude through the projection', () => {
    const [dot] = graphics(
      {
        ...map,
        marks: [
          { mark: 'geo', features: countries },
          { mark: 'dot', data: [{ lng: 5, lat: 5 }], x: 'lng', y: 'lat' },
        ],
      },
      1,
    );
    const west = numbersIn(graphics(map)[0]);
    const xs = west.filter((_, i) => i % 2 === 0);
    expect(dot?.kind === 'circle' ? dot.cx : 0).toBeGreaterThan(Math.min(...xs));
    expect(dot?.kind === 'circle' ? dot.cx : 0).toBeLessThan(Math.max(...xs));
  });

  it('zooms about a centre', () => {
    const plain = graphics(map).flatMap(numbersIn);
    const zoomed = graphics({
      ...map,
      projection: { type: 'equirectangular', zoom: 2, center: [5, 5] },
    }).flatMap(numbersIn);
    const spread = (ns: ReadonlyArray<number>) => Math.max(...ns) - Math.min(...ns);
    expect(spread(zoomed)).toBeGreaterThan(spread(plain));
  });

  it('carries a polygon across the antimeridian on past the edge instead of across the map', () => {
    const fiji: GeoFeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [170, -20],
                [-170, -20],
                [-170, -10],
                [170, -10],
                [170, -20],
              ],
            ],
          },
        },
      ],
    };
    const [ring] = graphics({
      ...base,
      projection: { type: 'equirectangular' },
      marks: [{ mark: 'geo', features: fiji }],
    });
    const xs = numbersIn(ring).filter((_, i) => i % 2 === 0);
    // The ring spans 20° of longitude, not the 340° the other way round, so it
    // is a sliver of the fitted width rather than all of it.
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(100);
  });

  it('draws a graticule', () => {
    const [grid] = graphics({
      ...base,
      projection: { type: 'naturalEarth1' },
      marks: [{ mark: 'graticule' }],
    });
    expect(grid?.kind === 'path' ? grid.d.length : 0).toBeGreaterThan(100);
  });

  it('names the spec path for maps without a projection, and marks maps cannot draw', () => {
    expect(() => compilePlot({ ...base, marks: [{ mark: 'graticule' }] })).toThrow(
      'marks[0]: a graticule mark needs the plot to have a projection',
    );
    expect(() =>
      compilePlot({ ...map, marks: [{ mark: 'bar', data: [{ a: 'x', b: 1 }], x: 'a', y: 'b' }] }),
    ).toThrow('marks[0]: the bar mark cannot be drawn on a projected map');
    const unknown: PlotSpec = JSON.parse(JSON.stringify({ ...map, projection: { type: 'flat' } }));
    expect(() => compilePlot(unknown)).toThrow('projection.type: unknown projection "flat"');
  });
});
