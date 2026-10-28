/**
 * An entry's movement across the editions as a step chart: editions along the bottom,
 * rings down the side with Adopt at the top, and a gap while the entry was off the radar.
 * The geometry is worked out here so the page draws a plain SVG, with no script.
 *
 * @module
 */
import { point } from '@opsydyn/foldkit-viz/math/scale';
import { line } from '@opsydyn/foldkit-viz/shape/line';
import { Option } from 'effect';

import type { Standing } from './pages';
import { type Ring, ringIds, ringLabels } from './three/data';

export const chartSize = { width: 420, height: 170 } as const;
const margin = { top: 14, right: 20, bottom: 34, left: 64 } as const;

export type MovementChart = Readonly<{
  /** The step line, broken where the entry was absent; none if it was never placed. */
  path: Option.Option<string>;
  marks: ReadonlyArray<Readonly<{ x: number; y: number; label: string; current: boolean }>>;
  editions: ReadonlyArray<Readonly<{ x: number; label: string }>>;
  rings: ReadonlyArray<Readonly<{ y: number; label: string }>>;
  plot: Readonly<{ left: number; right: number; top: number; bottom: number }>;
}>;

export const movementChart = (history: ReadonlyArray<Standing>): MovementChart => {
  const plot = {
    left: margin.left,
    right: chartSize.width - margin.right,
    top: margin.top,
    bottom: chartSize.height - margin.bottom,
  };
  const x = point({
    domain: history.map(({ edition }) => edition.date),
    range: [plot.left, plot.right],
    padding: 0.3,
  });
  const y = point({ domain: ringIds, range: [plot.top, plot.bottom], padding: 0.3 });
  const yOf = (ring: Ring) => y.position(ring);
  const points = history.map(({ edition, ring }) => ({
    x: x.position(edition.date),
    ring,
    edition,
  }));
  const heights = points.map(({ x: px, ring }) =>
    Option.match(ring, {
      onNone: (): readonly [number, number] => [px, 0],
      onSome: (placed): readonly [number, number] => [px, yOf(placed)],
    }),
  );
  const path = Option.fromNullishOr(
    line(heights, {
      curve: 'stepAfter',
      defined: (_, index) => Option.isSome(points[index]?.ring ?? Option.none()),
    }),
  );
  const marks = points.flatMap(({ x: px, ring, edition }) =>
    Option.match(ring, {
      onNone: () => [],
      onSome: (placed) => [
        {
          x: px,
          y: yOf(placed),
          label: `${edition.label} (${edition.date}): ${ringLabels[placed]}`,
          current: edition.isCurrent,
        },
      ],
    }),
  );
  return {
    path,
    marks,
    editions: history.map(({ edition }) => ({
      x: x.position(edition.date),
      label: edition.date.slice(0, 7),
    })),
    rings: ringIds.map((ring) => ({ y: yOf(ring), label: ringLabels[ring] })),
    plot,
  };
};
