import type { GeoCoord, GeoGeometry } from '@opsydyn/foldkit-viz/shape/geo';
import { geoEquirectangular, geoPath } from '@opsydyn/foldkit-viz/shape/geo';
import { feature } from 'topojson-client';
import atlas from 'world-atlas/countries-110m.json';

// SAFETY: this versioned world-atlas asset is a TopoJSON topology. JSON imports
// widen the discriminants; topojson-client owns decoding the topology below.
// oxlint-disable-next-line anti-slop/no-chained-type-assertions
const topology = atlas as unknown as Parameters<typeof feature>[0];
const countries = topology.objects.countries;
if (!countries || countries.type !== 'GeometryCollection') {
  throw new Error('The bundled world atlas must contain a countries collection.');
}
const collection = feature(topology, countries);
const blues = ['#2563eb', '#477cf3', '#739afa', '#a0bafc', '#c4d4ff'];
function coordinate(position: ReadonlyArray<number>): GeoCoord {
  return [position[0] ?? 0, position[1] ?? 0];
}
function geometry(value: (typeof collection.features)[number]['geometry']): GeoGeometry | null {
  switch (value.type) {
    case 'Polygon':
      return {
        type: 'Polygon',
        coordinates: value.coordinates.map((ring) => ring.map(coordinate)),
      };
    case 'MultiPolygon':
      return {
        type: 'MultiPolygon',
        // Exclude overseas territories from this regional fixture. The simple
        // library projection does not implement antimeridian clipping.
        coordinates: value.coordinates
          .filter((polygon) =>
            polygon.every((ring) =>
              ring.every(
                (position) =>
                  (position[0] ?? 0) > -15 &&
                  (position[0] ?? 0) < 42 &&
                  (position[1] ?? 0) > 34 &&
                  (position[1] ?? 0) < 72,
              ),
            ),
          )
          .map((polygon) => polygon.map((ring) => ring.map(coordinate))),
      };
    default:
      return null;
  }
}
const europeanCountries = new Set([
  'France',
  'Spain',
  'Portugal',
  'Germany',
  'Italy',
  'Austria',
  'Switzerland',
  'Netherlands',
  'Belgium',
  'Luxembourg',
  'United Kingdom',
  'Ireland',
  'Denmark',
  'Sweden',
  'Norway',
  'Finland',
  'Poland',
  'Czechia',
  'Slovakia',
  'Hungary',
  'Slovenia',
  'Croatia',
  'Serbia',
  'Bosnia and Herz.',
  'Montenegro',
  'Albania',
  'Macedonia',
  'Greece',
  'Bulgaria',
  'Romania',
  'Estonia',
  'Latvia',
  'Lithuania',
  'Belarus',
  'Ukraine',
  'Moldova',
]);
const regionalFeatures = collection.features
  .filter((country) => europeanCountries.has(String(country.properties?.name)))
  .map((country) => ({
    type: 'Feature' as const,
    geometry: geometry(country.geometry),
    name: String(country.properties?.name),
  }));
const projection = geoEquirectangular().fitExtent(
  [
    [30, 12],
    [302, 196],
  ],
  {
    type: 'FeatureCollection',
    features: regionalFeatures,
  },
);
const path = geoPath(projection);
export const mapPaths = regionalFeatures
  .map((country, i) => ({
    d: path(country),
    name: country.name,
    fill: blues[(i * 7) % blues.length] ?? '#477cf3',
  }))
  .filter(({ d }) => d.length > 0);
