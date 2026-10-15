/** The test app's scene: plain data derived from the model. */
import {
  ambientLight,
  box,
  directionalLight,
  mesh,
  perspectiveCamera,
  scene,
  sharedGeometry,
  fixed,
  spin,
  standard,
} from '@opsydyn/effect-three';

const colours = { red: 0xd94040, blue: 0x3366ff } as const;
const edges = { small: 1, large: 1.5 } as const;

const motions = { spin: spin({ axis: 'y', radiansPerSecond: 1 }), still: fixed([0, 0.6, 0]) };

export type Colour = keyof typeof colours;
export type Motion = keyof typeof motions;
export type Size = keyof typeof edges;

export const sceneFor = (colour: Colour, size: Size = 'small', motion: Motion = 'spin') =>
  scene({
    camera: perspectiveCamera({ position: [0, 0, 4] }),
    resources: {
      geometries: [
        {
          id: 'cube',
          geometry: box({ width: edges[size], height: edges[size], depth: edges[size] }),
        },
      ],
    },
    children: [
      ambientLight({ key: 'ambient', intensity: 0.4 }),
      directionalLight({ key: 'sun', intensity: 2, position: [2, 3, 4] }),
      mesh({
        key: 'cube',
        geometry: sharedGeometry('cube'),
        material: standard({ color: colours[colour], roughness: 0.6 }),
        rotation: motions[motion],
        interactive: true,
      }),
    ],
  });
