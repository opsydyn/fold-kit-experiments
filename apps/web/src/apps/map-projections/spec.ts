import type { PlotSpec, ProjectionSpec } from '@opsydyn/foldkit-viz/plot';

// Twenty of the world's largest cities, as longitude and latitude.
const CITIES: ReadonlyArray<readonly [number, number, string]> = [
  [139.7, 35.7, 'Tokyo'],
  [77.2, 28.6, 'Delhi'],
  [121.5, 31.2, 'Shanghai'],
  [72.8, 19.1, 'Mumbai'],
  [-46.6, -23.5, 'São Paulo'],
  [-74.0, 40.7, 'New York'],
  [3.4, 6.5, 'Lagos'],
  [-99.1, 19.4, 'Mexico City'],
  [90.4, 23.7, 'Dhaka'],
  [29.0, 41.0, 'Istanbul'],
  [-0.1, 51.5, 'London'],
  [37.6, 55.8, 'Moscow'],
  [151.2, -33.9, 'Sydney'],
  [-58.4, -34.6, 'Buenos Aires'],
  [18.4, -33.9, 'Cape Town'],
  [55.3, 25.2, 'Dubai'],
  [103.8, 1.4, 'Singapore'],
  [2.3, 48.9, 'Paris'],
  [116.4, 39.9, 'Beijing'],
  [-43.2, -22.9, 'Rio'],
];

/** The same graticule and cities under one projection. */
const citiesUnder = (type: ProjectionSpec['type'], title: string): PlotSpec => ({
  width: 240,
  height: 200,
  title,
  description: `Twenty major cities on a ${title.toLowerCase()} projection, with a 30° graticule.`,
  margins: { top: 4, right: 4, bottom: 4, left: 4 },
  projection: { type },
  marks: [
    { mark: 'graticule', step: 30 },
    {
      mark: 'dot',
      data: CITIES.map(([lng, lat, city]) => ({ lng, lat, city })),
      x: 'lng',
      y: 'lat',
      r: { value: 3 },
      fill: { value: '#f59e0b' },
      title: 'city',
    },
  ],
});

export const specs: ReadonlyArray<PlotSpec> = [
  citiesUnder('equirectangular', 'Equirectangular'),
  citiesUnder('mercator', 'Mercator'),
];
