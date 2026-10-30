import { expect, test } from 'bun:test';

import { geoGraticule, geoMercator, geoPath } from '../src/shape/geo';

const scale = 100;
const projection = geoMercator({ scale, translate: [250, 250] });

test('Mercator holds the poles at the edge of its square extent, as d3-geo clips them', () => {
  const [, north] = projection(0, 90);
  const [, south] = projection(0, -90);
  expect(Number.isFinite(north)).toBe(true);
  expect(Number.isFinite(south)).toBe(true);
  expect(Math.abs(250 - north)).toBeCloseTo(Math.PI * scale, 6);
  expect(Math.abs(south - 250)).toBeCloseTo(Math.PI * scale, 6);
});

test('Mercator leaves latitudes inside its extent where they were', () => {
  const [, y] = projection(0, 60);
  expect(250 - y).toBeCloseTo(scale * Math.log(Math.tan(Math.PI / 4 + Math.PI / 6)), 6);
});

test('a graticule through the poles draws without Infinity or NaN', () => {
  expect(geoPath(projection)(geoGraticule(30))).not.toMatch(/Infinity|NaN/);
});
