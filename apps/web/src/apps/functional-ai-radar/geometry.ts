/* Pure app-local geometry and filtering; these are not Effect state transitions. */
/* oxlint-disable linteffect/no-if-statement, linteffect/no-ternary, linteffect/no-magic-domain-string, linteffect/no-domain-logic-in-conditional, linteffect/no-return-in-arrow */
import { clipGlobeLine, projectGlobePoint } from '@opsydyn/foldkit-viz/shape/globe';

import { categoryIds, ringIds, type Category, type RadarEntry, type Ring } from './data';

export const RADAR_SIZE = 600;
export const RADAR_BASE_RADIUS = 260;
export const shellFractions = {
  adopt: 0.4,
  trial: 0.6,
  assess: 0.8,
  caution: 1,
} satisfies Readonly<Record<Ring, number>>;
const sectorStarts = {
  techniques: -180,
  tools: -90,
  platforms: 0,
  'languages-frameworks': 90,
} satisfies Readonly<Record<Category, number>>;
export type Coordinate = readonly [number, number];
export type RadarFilters = Readonly<{
  query: string;
  category: Category | 'all';
  rings: ReadonlyArray<Ring>;
}>;
export type RadarPosition = Readonly<{
  entry: RadarEntry;
  longitude: number;
  latitude: number;
  displayNumber: number;
}>;
export type RadarView = Readonly<{ center: Coordinate; zoom: number }>;
export type RadarMark = RadarPosition &
  Readonly<{ x: number; y: number; facing: number; depth: number }>;
export type RadarShell = Readonly<{
  ring: Ring;
  radius: number;
  segments: ReadonlyArray<ReadonlyArray<Coordinate>>;
}>;
export type RadarProjection = Readonly<{
  marks: ReadonlyArray<RadarMark>;
  shells: ReadonlyArray<RadarShell>;
}>;

const compareId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
export function categoryCenter(category: Category): Coordinate {
  return [sectorStarts[category] + 45, 20];
}
export function layoutEntries(entries: ReadonlyArray<RadarEntry>): ReadonlyArray<RadarPosition> {
  const counts = new Map<Category, number>();
  return Object.freeze(
    [...entries]
      .sort((a, b) => compareId(a.id, b.id))
      .map((entry, i) => {
        const slot = counts.get(entry.category) ?? 0;
        if (slot >= 8) throw new RangeError('Radar category exceeds eight layout slots');
        counts.set(entry.category, slot + 1);
        return Object.freeze({
          entry,
          longitude: sectorStarts[entry.category] + 15 + 20 * (slot % 4),
          latitude: slot < 4 ? 22 : -22,
          displayNumber: i + 1,
        });
      }),
  );
}
function matches(entry: RadarEntry, filters: RadarFilters): boolean {
  const query = filters.query.trim().toLowerCase();
  return (
    (filters.category === 'all' || entry.category === filters.category) &&
    filters.rings.includes(entry.ring) &&
    (entry.name.toLowerCase().includes(query) || entry.description.toLowerCase().includes(query))
  );
}
export function filterPositions(
  positions: ReadonlyArray<RadarPosition>,
  filters: RadarFilters,
): ReadonlyArray<RadarPosition> {
  return positions.filter(({ entry }) => matches(entry, filters));
}
export type RingCounts = Readonly<{
  adopt: number;
  trial: number;
  assess: number;
  caution: number;
}>;
export function countRings(
  positions: ReadonlyArray<RadarPosition>,
  filters: RadarFilters,
): RingCounts {
  const counts = { adopt: 0, trial: 0, assess: 0, caution: 0 };
  for (const { entry } of filterPositions(positions, { ...filters, rings: ringIds }))
    counts[entry.ring] += 1;
  return counts;
}
const guideLines = [
  Array.from({ length: 73 }, (_, i): Coordinate => [-180 + i * 5, 0]),
  ...categoryIds.map((category) =>
    Array.from({ length: 37 }, (_, i): Coordinate => [sectorStarts[category], -90 + i * 5]),
  ),
];
export function projectRadar(
  positions: ReadonlyArray<RadarPosition>,
  filters: RadarFilters,
  view: RadarView,
): RadarProjection {
  if (
    view.center.length !== 2 ||
    !view.center.every(Number.isFinite) ||
    Math.abs(view.center[1]) > 90 ||
    !Number.isFinite(view.zoom) ||
    view.zoom < 1 ||
    view.zoom > 2
  )
    throw new RangeError('Invalid radar view');
  const shells = ringIds.map((ring): RadarShell => {
    const radius = RADAR_BASE_RADIUS * shellFractions[ring] * view.zoom;
    const translate: Coordinate = [300, 300];
    const globeView = { center: view.center, radius, translate };
    return { ring, radius, segments: guideLines.flatMap((line) => clipGlobeLine(line, globeView)) };
  });
  const marks = filterPositions(positions, filters)
    .flatMap((position): RadarMark[] => {
      const radius = RADAR_BASE_RADIUS * shellFractions[position.entry.ring] * view.zoom;
      const point = projectGlobePoint([position.longitude, position.latitude], {
        center: view.center,
        radius,
        translate: [300, 300],
      });
      if (
        !point.visible ||
        point.x < 0 ||
        point.x > RADAR_SIZE ||
        point.y < 0 ||
        point.y > RADAR_SIZE
      )
        return [];
      return [
        { ...position, x: point.x, y: point.y, facing: point.facing, depth: radius * point.facing },
      ];
    })
    .sort((a, b) => a.depth - b.depth || compareId(a.entry.id, b.entry.id));
  return { shells, marks };
}
