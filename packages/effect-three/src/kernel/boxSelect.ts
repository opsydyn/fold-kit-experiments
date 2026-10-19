/**
 * Box selection as data, after three.js's `SelectionBox` (0.186.1,
 * `examples/jsm/interactive/SelectionBox.js`), which Drei's `Select` wraps. three's box
 * walks the scene for meshes whose centres fall inside the frustum a rectangle on screen
 * cuts from the camera; here the Model names the candidates and their centres, and
 * `boxSelect` returns the keys inside, so a selection is a value the Model keeps.
 *
 * A point is inside when it projects into the rectangle, as three's side planes have it,
 * and lies between the camera's near and far planes: what the camera can show. (three's
 * perspective box reaches past far, and its orthographic box neither stops at far nor
 * starts at near, `0.186.1`; a box here never selects what cannot be seen.)
 *
 * @module
 */
import { OrthographicCamera, PerspectiveCamera, Vector3 } from 'three';

import type { Camera, Vec3 } from './description.ts';

/** A corner of the box, in the canvas's normalised coordinates: −1 to 1, y up. */
export type BoxCorner = { readonly x: number; readonly y: number };

/** Something that can be selected: its key, and the point that must fall in the box. */
export type Selectable = { readonly key: string; readonly at: Vec3 };

/** The canvas's size in CSS pixels, which sets the camera's aspect (or ortho frustum). */
export type CanvasSize = { readonly width: number; readonly height: number };

/** The three.js camera the description renders through, fitted to `size`. */
const hostCamera = (camera: Camera, size: CanvasSize): PerspectiveCamera | OrthographicCamera => {
  const host =
    camera._tag === 'Perspective'
      ? new PerspectiveCamera(camera.fov, size.width / size.height, camera.near, camera.far)
      : new OrthographicCamera(
          size.width / -2,
          size.width / 2,
          size.height / 2,
          size.height / -2,
          camera.near,
          camera.far,
        );
  if (host instanceof OrthographicCamera && camera._tag === 'Orthographic') {
    host.zoom = camera.zoom;
  }
  host.position.set(...camera.position);
  host.lookAt(...camera.lookAt);
  host.updateMatrixWorld();
  host.updateProjectionMatrix();
  return host;
};

const between = (value: number, a: number, b: number): boolean =>
  value >= Math.min(a, b) && value <= Math.max(a, b);

/**
 * The keys of `candidates` whose points fall inside the box from corner `from` to corner
 * `to`, seen through `camera` on a canvas of `size`, in the order given.
 */
export const boxSelect = (
  camera: Camera,
  size: CanvasSize,
  from: BoxCorner,
  to: BoxCorner,
  candidates: ReadonlyArray<Selectable>,
): ReadonlyArray<string> => {
  const host = hostCamera(camera, size);
  // Projected, a point between near and far has a depth from −1 to 1; one behind the
  // camera, above 1.
  const inside = (candidate: Selectable): boolean => {
    const seen = new Vector3(...candidate.at).project(host);
    return between(seen.x, from.x, to.x) && between(seen.y, from.y, to.y) && between(seen.z, -1, 1);
  };
  return candidates.filter(inside).map((candidate) => candidate.key);
};
