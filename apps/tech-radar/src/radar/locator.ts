/**
 * An entry's place on the radar, flat: its category's quarter with the four ring bands,
 * Adopt at the centre, and every entry in that category at the edition as a dot in its
 * band. The geometry is worked out here so the page draws a plain SVG, with no script.
 *
 * Dots are spread evenly across their band rather than at their 3D positions: the locator
 * answers which ring and who else is there, and an even spread never overlaps.
 *
 * @module
 */
import { arc } from '@opsydyn/foldkit-viz/shape/arc';

import { entriesAt, entryHref } from './pages';
import { type RadarDataset, type RadarEntry, type Ring, ringIds, ringLabels } from './three/data';
import { shellFractions } from './three/layout';

export const locatorSize = { width: 280, height: 290 } as const;
/** The quarter's centre, at the bottom left, and its radius. */
const centre = { x: 10, y: 262 } as const;
const radius = 255;
/** A band holding more dots than this puts them in two rows. */
const perRow = 4;

export type LocatorBand = Readonly<{
  ring: Ring;
  /** The band as an SVG path round the quarter's centre. */
  path: string;
  label: string;
  /** Where its label sits under the bottom edge, from the quarter's centre. */
  labelX: number;
  current: boolean;
}>;

export type LocatorBlip = Readonly<{
  id: string;
  name: string;
  ring: Ring;
  href: string;
  x: number;
  y: number;
  current: boolean;
}>;

export type Locator = Readonly<{
  centre: Readonly<{ x: number; y: number }>;
  labelY: number;
  bands: ReadonlyArray<LocatorBand>;
  blips: ReadonlyArray<LocatorBlip>;
}>;

/** A band's inner and outer radius: the shells' own fractions, as the 3D radar draws them. */
const bandOf = (ring: Ring): readonly [number, number] => {
  const index = ringIds.indexOf(ring);
  const inner = index === 0 ? 0 : shellFractions[ringIds[index - 1] ?? ring];
  return [inner * radius, shellFractions[ring] * radius];
};

/** Points along a band, as its angle from straight up (clockwise) and its distance out. */
const spread = (ring: Ring, count: number): ReadonlyArray<readonly [number, number]> => {
  const [inner, outer] = bandOf(ring);
  const middle = (inner + outer) / 2;
  const quarter = (outer - inner) / 4;
  const row = (size: number, distance: number) =>
    Array.from(
      { length: size },
      (_, index) => [((index + 1) / (size + 1)) * (Math.PI / 2), distance] as const,
    );
  return count <= perRow
    ? row(count, middle)
    : [
        ...row(Math.ceil(count / 2), middle + quarter),
        ...row(Math.floor(count / 2), middle - quarter),
      ];
};

/** The locator for `entry` among its category's entries at the edition `index`. */
export const locatorFor = (dataset: RadarDataset, index: number, entry: RadarEntry): Locator => {
  const inCategory = entriesAt(dataset, index).filter(
    (placed) => placed.entry.category === entry.category,
  );
  const current = inCategory.find((placed) => placed.entry.id === entry.id)?.ring;
  return {
    centre,
    labelY: 16,
    bands: ringIds.map((ring) => {
      const [inner, outer] = bandOf(ring);
      return {
        ring,
        path: arc({ innerRadius: inner, outerRadius: outer, startAngle: 0, endAngle: Math.PI / 2 }),
        label: ringLabels[ring],
        labelX: (inner + outer) / 2,
        current: ring === current,
      };
    }),
    blips: ringIds.flatMap((ring) => {
      const placed = inCategory.filter((candidate) => candidate.ring === ring);
      const points = spread(ring, placed.length);
      return placed.map(({ entry: other }, at) => {
        const [angle, distance] = points[at] ?? [0, 0];
        return {
          id: other.id,
          name: other.name,
          ring,
          href: entryHref(dataset, other.id, index),
          x: Math.sin(angle) * distance,
          y: -Math.cos(angle) * distance,
          current: other.id === entry.id,
        };
      });
    }),
  };
};
