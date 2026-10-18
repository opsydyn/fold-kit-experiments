/**
 * The WebGL kit's sky: three.js's `Sky` (Preetham, `addons/objects/Sky.js` at 0.186.1),
 * as Drei's `Sky` draws it (`bf6f4ad`, `src/core/Sky.tsx`): a box scaled to `distance`
 * whose shader paints the daylight sky for a sun position. Never picked.
 *
 * @module
 */
import { Vector3 } from 'three';
import { Sky as SkyMesh } from 'three/addons/objects/Sky.js';

import type { Sky } from '../kernel/description.ts';
import type { HostedSky } from '../kernel/renderKit.ts';

/** Writes a sky's description into the mesh's uniforms and scale. */
const writeSky = (mesh: SkyMesh, description: Sky): void => {
  const { uniforms } = mesh.material;
  const set = (name: string, value: unknown): void => {
    const uniform = uniforms[name];
    if (uniform !== undefined) uniform.value = value;
  };
  set('turbidity', description.turbidity);
  set('rayleigh', description.rayleigh);
  set('mieCoefficient', description.mieCoefficient);
  set('mieDirectionalG', description.mieDirectionalG);
  set('cloudCoverage', description.clouds);
  set('sunPosition', new Vector3().fromArray(description.sunPosition));
  mesh.scale.setScalar(description.distance);
};

/** Creates the sky mesh; the scene graph adds it and writes its description. */
export const hostSky = (): HostedSky => {
  const mesh = new SkyMesh();
  mesh.raycast = () => undefined;
  return {
    object: mesh,
    update: (description) => writeSky(mesh, description),
    dispose: () => {
      mesh.geometry.dispose();
      mesh.material.dispose();
    },
  };
};
