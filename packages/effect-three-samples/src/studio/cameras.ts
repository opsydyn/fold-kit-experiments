/**
 * The studio's cameras: where each lens starts, and how far orbiting may take it.
 */
import {
  type Camera,
  orbitOptions,
  orthographicCamera,
  perspectiveCamera,
} from '@opsydyn/effect-three';

import type { Lens } from './model';

/** Eased like Drei's damped `OrbitControls`, a little quicker. */
const damping = 0.1;

export const perspectiveLens = perspectiveCamera({
  fov: 40,
  position: [0, 5.2, 7.5],
  lookAt: [0, 0.3, 0],
  damping,
});

export const orthographicLens = orthographicCamera({
  zoom: 62,
  position: [0, 5.2, 7.5],
  lookAt: [0, 0.3, 0],
  damping,
});

/** The split lens's views: the orbiting front, and the plan. */
export const viewKey = { front: 'front', plan: 'plan' } as const;

/** The plan from above, in the split lens. It stays put. */
export const planLens = orthographicCamera({
  zoom: 40,
  position: [0, 12, 0.001],
  lookAt: [0, 0, 0],
});

/** Each lens starts from its own camera; the split lens orbits its perspective half. */
export const homeCamera = {
  perspective: perspectiveLens,
  orthographic: orthographicLens,
  split: perspectiveLens,
} satisfies Record<Lens, Camera>;

/** Orbit within reach of the floor: never below it, never too close or too far. */
export const studioOrbit = orbitOptions({
  maxPolarAngle: Math.PI / 2 - 0.08,
  minDistance: 4,
  maxDistance: 16,
  minZoom: 35,
  maxZoom: 140,
});
