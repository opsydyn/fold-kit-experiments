/**
 * Setting up a shot by name (roadmap, "Beyond parity" 3): a vocabulary an assistant (or
 * a person) can use instead of numbers. `shotCamera` frames a box from a named angle, as
 * a photographer would ask for it, through `fitCamera`; `moodStaging` turns a lighting
 * mood into lights, image-based lighting and a sky. Both return descriptions to keep in
 * the Model, so a shot is undoable and replayable like any other change.
 *
 * @module
 */
import { Vector3 } from 'three';

import {
  directionalLight,
  environment,
  hemisphereLight,
  sky,
  sunPositionFromAngles,
} from './build.ts';
import type { Camera, Environment, SceneNode, Sky, Vec3 } from './description.ts';
import { type Box, fitCamera } from './orbit.ts';

/** Where the camera looks from, round the subject. */
export type ShotAngle = 'front' | 'back' | 'left' | 'right' | 'top' | 'three-quarter' | 'low';

export const shotAngles: ReadonlyArray<ShotAngle> = [
  'front',
  'back',
  'left',
  'right',
  'top',
  'three-quarter',
  'low',
];

/**
 * From the subject towards the camera, for each angle: in front is +z, as three's
 * cameras look down −z; the top view stays a hair off the pole, as `OrbitControls` does.
 */
const directionOf: Record<ShotAngle, Vec3> = {
  front: [0, 0.15, 1],
  back: [0, 0.15, -1],
  left: [-1, 0.15, 0],
  right: [1, 0.15, 0],
  top: [0, 1, 1e-4],
  'three-quarter': [1, 0.7, 1],
  low: [0.35, -0.02, 1],
};

/**
 * The camera looking at `subject` from `angle`, as close as it can be with the box
 * still inside the frame (`margin` 1.3 leaves room round it). `area` is the canvas's
 * size, or its shape: only the ratio matters to a perspective camera.
 */
export const shotCamera = <C extends Camera>(
  camera: C,
  subject: Box,
  angle: ShotAngle,
  area: { readonly width: number; readonly height: number } = { width: 16, height: 10 },
  margin = 1.3,
): C => {
  const centre = new Vector3(...subject.min).add(new Vector3(...subject.max)).multiplyScalar(0.5);
  const from = new Vector3(...directionOf[angle]).normalize().add(centre);
  const aimed = {
    ...camera,
    position: [from.x, from.y, from.z],
    lookAt: [centre.x, centre.y, centre.z],
  } as C;
  // SAFETY: `fitCamera` returns the camera it was given with only its position, aim and
  // zoom changed, so the kind of camera is the one passed in.
  return fitCamera(aimed, subject, area, margin) as C;
};

/** A lighting mood, from the even light of a studio to a clear night. */
export type Mood = 'studio' | 'daylight' | 'sunset' | 'night';

export const moods: ReadonlyArray<Mood> = ['studio', 'daylight', 'sunset', 'night'];

/** What a mood stages: lights (keyed under the prefix), image-based light and a sky. */
export type Staging = {
  readonly lights: ReadonlyArray<SceneNode>;
  readonly environment: Environment | null;
  readonly sky: Sky | null;
};

/** The staging for `mood`, its lights keyed `${prefix}:…`. */
export const moodStaging = (mood: Mood, prefix = 'mood'): Staging => {
  switch (mood) {
    case 'studio':
      return {
        lights: [
          hemisphereLight({
            key: `${prefix}:fill`,
            color: 0xffffff,
            groundColor: 0x6f6a62,
            intensity: 0.8,
          }),
          directionalLight({
            key: `${prefix}:key`,
            position: [4, 7, 3],
            intensity: 2,
            castShadow: true,
          }),
        ],
        environment: environment({ environmentIntensity: 0.35 }),
        sky: null,
      };
    case 'daylight':
      return {
        lights: [
          hemisphereLight({
            key: `${prefix}:sky`,
            color: 0xcfe6ff,
            groundColor: 0x8a7a60,
            intensity: 1,
          }),
          directionalLight({
            key: `${prefix}:sun`,
            position: [6, 9, 4],
            intensity: 3,
            castShadow: true,
          }),
        ],
        environment: environment({ environmentIntensity: 0.25 }),
        sky: sky({ sunPosition: sunPositionFromAngles(0.85, 0.35) }),
      };
    case 'sunset':
      return {
        lights: [
          hemisphereLight({
            key: `${prefix}:sky`,
            color: 0xffb27a,
            groundColor: 0x3a2a40,
            intensity: 0.6,
          }),
          directionalLight({
            key: `${prefix}:sun`,
            color: 0xff9a5a,
            position: [-8, 2.5, 3],
            intensity: 2.5,
            castShadow: true,
          }),
        ],
        environment: null,
        sky: sky({ sunPosition: sunPositionFromAngles(0.52, 0.25), turbidity: 8, rayleigh: 3 }),
      };
    case 'night':
      return {
        lights: [
          hemisphereLight({
            key: `${prefix}:sky`,
            color: 0x3a4a80,
            groundColor: 0x101018,
            intensity: 0.35,
          }),
          directionalLight({
            key: `${prefix}:moon`,
            color: 0xaabfff,
            position: [-3, 8, -4],
            intensity: 0.8,
            castShadow: true,
          }),
        ],
        environment: null,
        sky: null,
      };
  }
};
