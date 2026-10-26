/* Pure placement geometry and a greedy loop; these are not Effect state transitions. */
/* oxlint-disable linteffect/no-if-statement, linteffect/no-domain-logic-in-conditional, linteffect/no-return-in-arrow, linteffect/no-magic-domain-string */
/**
 * Label placement: which of the radar's candidate labels to draw so none overlap on
 * screen. Candidates come in priority order (the focused entry first, then the nearest
 * blips), each with a few positions to try; a candidate takes the first position whose
 * box clears every box kept before it, within the budget for its kind. Pure, so it is tested without a
 * renderer; boxes are in view-tangent units, so the stage's aspect does not matter.
 */
import type { Vec3 } from '@opsydyn/effect-three';
import { Match, Option } from 'effect';

export type LabelKind = 'focus' | 'edge' | 'name' | 'meta';

export type Candidate = Readonly<{
  key: string;
  kind: LabelKind;
  /** Where the label's box may be centred, in world units, most preferred first. */
  centres: ReadonlyArray<Vec3>;
  /** The box's size in world units, as the text lays out at that distance. */
  width: number;
  height: number;
}>;

/** How many labels of each kind may show at once: a few names, fewer descriptions. */
export const labelBudget = { focus: 1, edge: 6, name: 8, meta: 2 } as const satisfies Readonly<
  Record<LabelKind, number>
>;

type Box = Readonly<{ x0: number; y0: number; x1: number; y1: number; depth: number }>;
type View = Readonly<{ eye: Vec3; forward: Vec3; right: Vec3; up: Vec3 }>;

const minus = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (v: Vec3): Vec3 => {
  const length = Math.hypot(...v);
  return [v[0] / length, v[1] / length, v[2] / length];
};

/** The camera's view axes, as three's `lookAt` builds them with y up. */
export const viewOf = (eye: Vec3, target: Vec3): View => {
  const forward = unit(minus(target, eye));
  const right = unit(cross(forward, [0, 1, 0]));
  return { eye, forward, right, up: cross(right, forward) };
};

/** Where `point` sits across the view: 0 at the centre, negative left, positive right. */
export const acrossView = (view: View, point: Vec3): number => {
  const offset = minus(point, view.eye);
  return dot(offset, view.right) / dot(offset, view.forward);
};

/** The visible half-width and half-height of the view, in view-tangent units. */
export type Frame = Readonly<{ x: number; y: number }>;
const unbounded: Frame = { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY };

/** The frame of a camera with this vertical field of view (degrees) on a stage this shape. */
export const frameOf = (fov: number, aspect: number): Frame => {
  const y = Math.tan((fov * Math.PI) / 360);
  return { x: y * aspect, y };
};

/** Space kept round every label, in view-tangent units. */
const gap = 0.002;

/** A candidate's screen box centred at `centre`, or none when that is behind the camera. */
const boxOf = (
  view: View,
  size: Readonly<{ width: number; height: number }>,
  centre: Vec3,
): Box | undefined => {
  const offset = minus(centre, view.eye);
  const depth = dot(offset, view.forward);
  const x = dot(offset, view.right) / depth;
  const y = dot(offset, view.up) / depth;
  const halfWidth = size.width / 2 / depth + gap;
  const halfHeight = size.height / 2 / depth + gap;
  return Match.value(depth > 0.1).pipe(
    Match.when(true, () => ({
      x0: x - halfWidth,
      y0: y - halfHeight,
      x1: x + halfWidth,
      y1: y + halfHeight,
      depth,
    })),
    Match.orElse(() => undefined),
  );
};

/** Whether a box lies wholly inside the frame, so none of its text is cut off. */
const inside = (box: Box, frame: Frame): boolean =>
  box.x0 >= -frame.x && box.x1 <= frame.x && box.y0 >= -frame.y && box.y1 <= frame.y;

const overlaps = (a: Box, b: Box): boolean =>
  a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * Something a label must not sit behind, such as a blip: a box at a fixed place. Only an
 * obstacle nearer the camera than a label blocks it; a label may cover what is behind it.
 */
export type Obstacle = Readonly<{
  centre: Vec3;
  width: number;
  height: number;
  /** Blocks labels at any depth, as the focused blip does: it is never covered. */
  solid?: boolean;
  /** Labels that may sit over it regardless: a blip's own labels never block on it. */
  exempt?: ReadonlyArray<string>;
}>;

/**
 * The depth an obstacle blocks from: its front surface, since a label just behind a
 * blip's centre is still inside the sphere's silhouette; a solid one blocks at any depth.
 */
const frontOf = (obstacle: Obstacle, depth: number): number =>
  Match.value(obstacle.solid === true).pipe(
    Match.when(true, () => Number.NEGATIVE_INFINITY),
    Match.orElse(() => depth - obstacle.width / 2),
  );

/**
 * The candidates to draw, each with the index of the position it takes: each in turn, if
 * its kind is within budget and one of its positions clears every box kept so far and
 * the obstacles. The focus label only has to clear other labels: it always shows.
 */
export function place(
  view: View,
  candidates: ReadonlyArray<Candidate>,
  obstacles: ReadonlyArray<Obstacle> = [],
  frame: Frame = unbounded,
): ReadonlyMap<string, number> {
  const blocked = obstacles.flatMap((obstacle) =>
    Option.toArray(Option.fromNullishOr(boxOf(view, obstacle, obstacle.centre))).map((box) => ({
      ...box,
      depth: frontOf(obstacle, box.depth),
      exempt: obstacle.exempt ?? [],
    })),
  );
  const kept: Array<Box> = [];
  const counts = { focus: 0, edge: 0, name: 0, meta: 0 } satisfies Record<LabelKind, number>;
  const placed = new Map<string, number>();
  for (const candidate of candidates) {
    if (counts[candidate.kind] >= labelBudget[candidate.kind]) continue;
    const index = candidate.centres.findIndex((centre) => {
      const box = boxOf(view, candidate, centre);
      return (
        box !== undefined &&
        inside(box, frame) &&
        !kept.some((other) => overlaps(box, other)) &&
        (candidate.kind === 'focus' ||
          !blocked.some(
            (other) =>
              other.depth < box.depth &&
              !other.exempt.includes(candidate.key) &&
              overlaps(box, other),
          ))
      );
    });
    const box = boxOf(
      view,
      candidate,
      candidate.centres[index] ?? candidate.centres[0] ?? view.eye,
    );
    if (index >= 0 && box !== undefined) {
      kept.push(box);
      counts[candidate.kind] += 1;
      placed.set(candidate.key, index);
    }
  }
  return placed;
}

/** The rough size of one line of text: troika's Inter averages about 0.55 em a glyph. */
export const textSize = (text: string, fontSize: number, maxWidth = Number.POSITIVE_INFINITY) => {
  const natural = text.length * fontSize * 0.55;
  const lines = Math.max(1, Math.ceil(natural / maxWidth));
  return { width: Math.min(natural, maxWidth), height: lines * fontSize * 1.3 };
};
