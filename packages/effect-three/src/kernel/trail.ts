/**
 * Trails, as Drei's `Trail` (`bf6f4ad`, `src/core/Trail.tsx`): a ribbon behind a moving
 * node through the places it has been. Drei records the target once a frame into
 * `length × 10` points, shifting in `decay` new ones each time it moves at least
 * `stride`, every `interval` frames, and draws them with `meshline`. Here the same rules
 * run on a clock of 60 steps a second of scene time rather than per frame, so a trail is
 * as long at 30 frames a second as at 120; and the ribbon is a plain mesh turned to face
 * the camera each frame, with vertex colours, so either renderer draws it. Its width is
 * Drei's: a tenth of `width`, in scene units, `taper` and `fade` narrowing and fading it
 * towards the tail (Drei takes an `attenuation` function).
 *
 * @module
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from 'three';

import type { Trail } from './description.ts';

/** Drei records a point a frame; this records one a step of this many a second. */
const stepsPerSecond = 60;

export type TrailRibbon = {
  /** The ribbon, in the space the positions are in; never picked. */
  readonly object: Mesh;
  /** Records the node at `position` for every step up to scene time `now`. */
  readonly record: (position: Vector3, now: number) => void;
  /** Turns the ribbon to face a camera at `eye`. */
  readonly face: (eye: Vector3) => void;
  /** Whether every recorded point is where the node is: the trail has caught up. */
  readonly settled: () => boolean;
  /** Applies a new look; a new length starts the trail again at `position`. */
  readonly restyle: (trail: Trail, position: Vector3, now: number) => void;
  readonly dispose: () => void;
};

/** How wide the ribbon is `along` the way from tail (0) to head (1). */
const widthAt = (trail: Trail, along: number): number => {
  const full = trail.width * 0.1;
  if (trail.taper === 'linear') return full * along;
  if (trail.taper === 'quadratic') return full * along * along;
  return full;
};

/** A ribbon of `trail.length × 10` points, all at `start`. Allocation-free once made. */
export const createTrailRibbon = (first: Trail, start: Vector3, now: number): TrailRibbon => {
  let trail = first;
  let count = 0;
  let points = new Float32Array(0);
  const geometry = new BufferGeometry();
  const material = new MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
  });
  const object = new Mesh(geometry, material);
  object.frustumCulled = false;
  object.raycast = () => undefined;
  // Not a node: marked so tools walking the scene can tell it apart.
  object.name = 'effect-three:trail';
  const last = new Vector3();
  const here = new Vector3();
  const ahead = new Vector3();
  const behind = new Vector3();
  const side = new Vector3();
  const toEye = new Vector3();
  const tint = new Color();
  let clock = now;
  let phase = 0;

  /** Sizes the buffers for the trail's length and fills every point with `at`. */
  const reset = (at: Vector3, time: number): void => {
    count = Math.max(2, Math.round(trail.length * 10));
    points = new Float32Array(count * 3);
    for (let point = 0; point < count; point++) at.toArray(points, point * 3);
    const index: Array<number> = [];
    for (let point = 0; point < count - 1; point++) {
      const a = point * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geometry.setIndex(index);
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 6), 3));
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(count * 8), 4));
    paint();
    last.copy(at);
    clock = time;
    phase = 0;
  };

  /** Colours each pair of vertices: the trail's colour, fading to the tail with `fade`. */
  const paint = (): void => {
    const colors = geometry.getAttribute('color');
    tint.setHex(trail.color);
    for (let point = 0; point < count; point++) {
      const alpha = trail.fade ? point / (count - 1) : 1;
      colors.setXYZW(point * 2, tint.r, tint.g, tint.b, alpha);
      colors.setXYZW(point * 2 + 1, tint.r, tint.g, tint.b, alpha);
    }
    colors.needsUpdate = true;
  };

  /** Drei's `shiftLeft` and push: the oldest point drops, `at` joins as the newest. */
  const push = (at: Vector3): void => {
    points.copyWithin(0, 3);
    at.toArray(points, (count - 1) * 3);
  };

  reset(start, now);

  return {
    object,
    record: (position, time) => {
      // At most a trail's worth of steps: an idle scene catches up at once.
      const due = Math.min(count, Math.floor((time - clock) * stepsPerSecond));
      if (due <= 0) return;
      clock += due / stepsPerSecond;
      for (let step = 0; step < due; step++) {
        if (phase === 0) {
          for (let shift = 0; shift < trail.decay; shift++) {
            if (position.distanceTo(last) < trail.stride) continue;
            push(position);
          }
          last.copy(position);
        }
        phase = (phase + 1) % Math.max(1, Math.round(trail.interval));
      }
    },
    face: (eye) => {
      const position = geometry.getAttribute('position');
      for (let point = 0; point < count; point++) {
        here.fromArray(points, point * 3);
        ahead.fromArray(points, Math.min(point + 1, count - 1) * 3);
        behind.fromArray(points, Math.max(point - 1, 0) * 3);
        // Across the ribbon: square to its direction here and to the view of it.
        side.subVectors(ahead, behind).cross(toEye.subVectors(eye, here));
        const length = side.length();
        if (length > 1e-9) side.multiplyScalar(widthAt(trail, point / (count - 1)) / 2 / length);
        else side.set(0, 0, 0);
        position.setXYZ(point * 2, here.x + side.x, here.y + side.y, here.z + side.z);
        position.setXYZ(point * 2 + 1, here.x - side.x, here.y - side.y, here.z - side.z);
      }
      position.needsUpdate = true;
    },
    settled: () => {
      const end = (count - 1) * 3;
      for (let point = 0; point < end; point += 3) {
        if (points[point] !== points[end] || points[point + 1] !== points[end + 1]) return false;
        if (points[point + 2] !== points[end + 2]) return false;
      }
      return true;
    },
    restyle: (next, position, time) => {
      const resized = Math.round(next.length * 10) !== Math.round(trail.length * 10);
      trail = next;
      if (resized) reset(position, time);
      else paint();
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
};
