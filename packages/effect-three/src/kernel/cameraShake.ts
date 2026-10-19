/**
 * Camera shake, as Drei's `CameraShake` (`bf6f4ad`, `src/core/CameraShake.tsx`): yaw, pitch
 * and roll added to the camera's rotation from simplex noise, scaled by the square of the
 * intensity. Here it is a pure function of scene time: the noise is seeded (Drei seeds
 * from `Math.random`), and decay counts down from when the shake began, so the same scene
 * time always shakes the same way, at any frame rate. Reduced motion holds it still.
 *
 * The camera always looks at its target here, so each frame it is aimed there again and
 * the shake added on top: whatever moved the camera in between, nothing accumulates.
 *
 * @module
 */
import type { OrthographicCamera, PerspectiveCamera, Vector3 } from 'three';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';

import type { CameraShake } from './description.ts';
import { cameraShakeEquals } from './equality.ts';

/** A small seeded generator (mulberry32), so the noise is the same on every page load. */
const seeded = (seed: number): { readonly random: () => number } => {
  let state = seed >>> 0;
  return {
    random: () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
};

const yawNoise = new SimplexNoise(seeded(1));
const pitchNoise = new SimplexNoise(seeded(2));
const rollNoise = new SimplexNoise(seeded(3));

/** The intensity at `seconds` after the shake began: Drei's, clamped to [0, 1], decaying. */
export const shakeIntensity = (shake: CameraShake, seconds: number): number => {
  const decayed = shake.decay ? shake.intensity - shake.decayRate * seconds : shake.intensity;
  return Math.min(1, Math.max(0, decayed));
};

export type CameraShaker = {
  /**
   * The camera's shake as described at scene time `now`: one that first appears, changes
   * or is triggered again begins then.
   */
  readonly describe: (shake: CameraShake | null, now: number) => void;
  /**
   * Aims the camera at `target` and adds the shake at scene time `now`, or only aims it
   * when the shake has ended or motion is reduced. Does nothing when nothing was added.
   */
  readonly apply: (
    camera: PerspectiveCamera | OrthographicCamera,
    target: Vector3,
    now: number,
    animating: boolean,
  ) => void;
  /** Whether the camera is shaking at scene time `now`, and so needs frames. */
  readonly shaking: (now: number) => boolean;
};

/** One camera's shake. Allocation-free once created. */
export const createCameraShaker = (): CameraShaker => {
  let current: CameraShake | null = null;
  let since = 0;
  // Whether the camera wears an offset that a still frame must take off again.
  let offset = false;

  return {
    describe: (shake, now) => {
      if (shake !== null && (current === null || !cameraShakeEquals(current, shake))) since = now;
      current = shake;
    },
    apply: (camera, target, now, animating) => {
      const shake = current;
      const strength =
        shake === null || !animating ? 0 : shakeIntensity(shake, Math.max(0, now - since)) ** 2;
      if (shake === null || strength === 0) {
        if (offset) camera.lookAt(target);
        offset = false;
        return;
      }
      camera.lookAt(target);
      camera.rotation.set(
        camera.rotation.x +
          shake.maxPitch * strength * pitchNoise.noise(now * shake.pitchFrequency, 1),
        camera.rotation.y + shake.maxYaw * strength * yawNoise.noise(now * shake.yawFrequency, 1),
        camera.rotation.z +
          shake.maxRoll * strength * rollNoise.noise(now * shake.rollFrequency, 1),
      );
      offset = true;
    },
    shaking: (now) =>
      offset || (current !== null && shakeIntensity(current, Math.max(0, now - since)) > 0),
  };
};
