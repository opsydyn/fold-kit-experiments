/**
 * The WebGPU kit's sky: three.js's `SkyMesh` (`addons/objects/SkyMesh.js` at 0.186.1), the
 * same Preetham sky as the WebGL kit's `Sky`, written in TSL. Never picked.
 *
 * @module
 */
import { SkyMesh } from 'three/addons/objects/SkyMesh.js';

import type { Sky } from '../kernel/description.ts';
import type { HostedSky } from '../kernel/renderKit.ts';

/** Writes a sky's description into the mesh's uniforms and scale. */
const writeSky = (mesh: SkyMesh, description: Sky): void => {
  mesh.turbidity.value = description.turbidity;
  mesh.rayleigh.value = description.rayleigh;
  mesh.mieCoefficient.value = description.mieCoefficient;
  mesh.mieDirectionalG.value = description.mieDirectionalG;
  mesh.cloudCoverage.value = description.clouds;
  mesh.sunPosition.value.fromArray(description.sunPosition);
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
