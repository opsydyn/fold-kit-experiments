/* Pure renderer-neutral layout and filtering; these are not Effect state transitions. */
/* oxlint-disable linteffect/no-if-statement, linteffect/no-ternary, linteffect/no-magic-domain-string, linteffect/no-domain-logic-in-conditional, linteffect/no-return-in-arrow */
import { ringIds, type Category, type RadarEntry, type Ring } from './data';

/** Each ring's shell, as a fraction of the outer (caution) shell's radius. */
export const shellFractions = {
  adopt: 0.4,
  trial: 0.6,
  assess: 0.8,
  caution: 1,
} satisfies Readonly<Record<Ring, number>>;
/** Each category's 90° sector of longitude starts here, in degrees. */
export const sectorStarts = {
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

export const compareId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
/** A category's centre, `[longitude, latitude]` in degrees. */
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
