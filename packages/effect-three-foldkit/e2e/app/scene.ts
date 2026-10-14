/** The test app's scene: plain data derived from the model. */
import {
  ambientLight,
  box,
  directionalLight,
  mesh,
  perspectiveCamera,
  scene,
  sharedGeometry,
  spin,
  standard,
} from '@opsydyn/effect-three';

const colours = { red: 0xd94040, blue: 0x3366ff } as const;

export type Colour = keyof typeof colours;

export const sceneFor = (colour: Colour) =>
  scene({
    camera: perspectiveCamera({ position: [0, 0, 4] }),
    resources: { geometries: [{ id: 'cube', geometry: box() }] },
    children: [
      ambientLight({ key: 'ambient', intensity: 0.4 }),
      directionalLight({ key: 'sun', intensity: 2, position: [2, 3, 4] }),
      mesh({
        key: 'cube',
        geometry: sharedGeometry('cube'),
        material: standard({ color: colours[colour], roughness: 0.6 }),
        rotation: spin({ axis: 'y', radiansPerSecond: 1.5 }),
        interactive: true,
      }),
    ],
  });
