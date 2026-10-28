/* Pure app-local projection of the shared radar layout; these are not Effect state transitions. */
/* oxlint-disable linteffect/no-if-statement, linteffect/no-ternary, linteffect/no-magic-domain-string, linteffect/no-domain-logic-in-conditional, linteffect/no-return-in-arrow */
import { clipGlobeLine, projectGlobePoint } from '@opsydyn/foldkit-viz/shape/globe';

import { categoryIds, ringIds, type Ring } from '../three/data';
import {
  compareId,
  filterPositions,
  type Coordinate,
  type RadarFilters,
  type RadarPosition,
  sectorStarts,
  shellFractions,
} from '../three/layout';

export {
  categoryCenter,
  countRings,
  filterPositions,
  layoutEntries,
  shellFractions,
  type Coordinate,
  type RadarFilters,
  type RadarPosition,
  type RingCounts,
} from '../three/layout';

export const RADAR_SIZE = 600;
export const RADAR_BASE_RADIUS = 260;
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
