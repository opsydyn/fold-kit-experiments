/**
 * A measuring tape as data (roadmap, "Beyond parity" 5): two ends placed on the scene
 * by clicks, the distance between them, and a dashed preview from the first end to the
 * pointer while the second is being placed. Neither three.js nor Drei has one; it is
 * built the way the gizmos are: `placeTapeEnd` and `pointTape` return the next tape for
 * the Model to keep, `tapeNodes` describes it, and `tapeLength` measures it.
 *
 * A first click places one end, a second the other; a third starts a new tape there.
 * With `snap`, each end is rounded to that step on every axis.
 *
 * @module
 */
import { basic, group, line, mesh, sphere } from './build.ts';
import type { Rgb, SceneNode, Vec3 } from './description.ts';

export type Tape = {
  /** The first end, once placed. */
  readonly from: Vec3 | null;
  /** The second end, once placed: the tape is then measured. */
  readonly to: Vec3 | null;
  /** Where the pointer is on the scene while the second end is being placed. */
  readonly pointer: Vec3 | null;
  /** Rounds each end to this step on every axis, or not when `null`. */
  readonly snap: number | null;
};

/** An empty tape, snapping to `snap` when given. */
export const tape = (options: { readonly snap?: number | null } = {}): Tape => ({
  from: null,
  to: null,
  pointer: null,
  snap: options.snap ?? null,
});

const snapped = (state: Tape, point: Vec3): Vec3 => {
  const step = state.snap;
  if (step === null) return point;
  return [
    Math.round(point[0] / step) * step,
    Math.round(point[1] / step) * step,
    Math.round(point[2] / step) * step,
  ];
};

/** A click at `point`: the first end, the second, or (when both are placed) a new tape. */
export const placeTapeEnd = (state: Tape, point: Vec3): Tape => {
  const at = snapped(state, point);
  if (state.from !== null && state.to === null) return { ...state, to: at, pointer: null };
  return { ...state, from: at, to: null, pointer: null };
};

/** The pointer over the scene at `point` (or off it, `null`), for the preview. */
export const pointTape = (state: Tape, point: Vec3 | null): Tape =>
  state.from !== null && state.to === null
    ? { ...state, pointer: point === null ? null : snapped(state, point) }
    : state;

/** An empty tape, keeping its snap. */
export const clearTape = (state: Tape): Tape => ({ ...tape({ snap: state.snap }) });

/** Where the tape's far end is: the second end, or the pointer while it is placed. */
const farEnd = (state: Tape): Vec3 | null => state.to ?? state.pointer;

const distance = (a: Vec3, b: Vec3): number => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);

/** The tape's length: between its ends, or to the pointer while the second is placed. */
export const tapeLength = (state: Tape): number | undefined => {
  const end = farEnd(state);
  return state.from === null || end === null ? undefined : distance(state.from, end);
};

/** The middle of the tape, for a label there. */
export const tapeMiddle = (state: Tape): Vec3 | undefined => {
  const end = farEnd(state);
  if (state.from === null || end === null) return undefined;
  return [(state.from[0] + end[0]) / 2, (state.from[1] + end[1]) / 2, (state.from[2] + end[2]) / 2];
};

export type TapeLook = {
  readonly color: Rgb;
  /** The line's width in pixels. */
  readonly width: number;
  /** The end balls' radius in scene units. */
  readonly endRadius: number;
};

const endBall = (key: string, at: Vec3, look: TapeLook): SceneNode =>
  mesh({
    key,
    position: at,
    geometry: sphere({ radius: look.endRadius, widthSegments: 16, heightSegments: 8 }),
    material: basic({ color: look.color }),
  });

/**
 * The tape under `key`: a ball at each placed end and a line between them, dashed while
 * it runs to the pointer. Nothing in it is picked, so clicks reach the scene beneath.
 */
export const tapeNodes = (key: string, state: Tape, look: Partial<TapeLook> = {}): SceneNode => {
  const shown: TapeLook = {
    color: look.color ?? 0xffcc33,
    width: look.width ?? 3,
    endRadius: look.endRadius ?? 0.03,
  };
  const end = farEnd(state);
  const ends = [state.from, state.to].flatMap((at, index) =>
    at === null ? [] : [endBall(`${key}:end:${index}`, at, shown)],
  );
  const span =
    state.from === null || end === null
      ? []
      : [
          line({
            key: `${key}:line`,
            points: [state.from, end],
            color: shown.color,
            width: shown.width,
            dashed: state.to === null,
            dashSize: 0.08,
            gapSize: 0.05,
          }),
        ];
  return group({ key, children: [...span, ...ends] });
};
