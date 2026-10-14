/**
 * The scene as a pure function of the Model. Both cubes share one geometry and one
 * material, so a colour or size change updates shared GPU resources in place.
 */
import {
  ambientLight,
  box,
  directionalLight,
  mesh,
  perspectiveCamera,
  scene,
  type SceneNode,
  sharedGeometry,
  sharedMaterial,
  spin,
  standard,
} from '@opsydyn/effect-three';
import { Array as Arr, Option } from 'effect';

import type { CubeSize, Model, Paint } from './model';

const paints = { teal: 0x14b8a6, amber: 0xf59e0b } satisfies Record<Paint, number>;
const sizes = { small: 1, large: 1.6 } satisfies Record<CubeSize, number>;

const hoverScale = (model: Model, key: string): number =>
  Option.match(
    Option.filter(model.hovered, (hovered) => hovered === key),
    { onNone: () => 1, onSome: () => 1.15 },
  );

const cube = (
  model: Model,
  key: string,
  position: readonly [number, number, number],
  axis: 'x' | 'y',
): SceneNode => {
  const scale = hoverScale(model, key);
  return mesh({
    key,
    position,
    scale: [scale, scale, scale],
    rotation: spin({ axis, radiansPerSecond: 0.8 }),
    geometry: sharedGeometry('cube'),
    material: sharedMaterial('paint'),
    interactive: true,
  });
};

export const sceneFor = (model: Model) => {
  const edge = sizes[model.size];
  return scene({
    camera: perspectiveCamera({ position: [0, 1.2, 6], lookAt: [0, 0, 0] }),
    resources: {
      geometries: [{ id: 'cube', geometry: box({ width: edge, height: edge, depth: edge }) }],
      materials: [
        { id: 'paint', material: standard({ color: paints[model.paint], roughness: 0.45 }) },
      ],
    },
    children: [
      ambientLight({ key: 'ambient', intensity: 0.35 }),
      directionalLight({ key: 'sun', intensity: 2.2, position: [3, 4, 5] }),
      cube(model, 'left', [-1.4, 0, 0], 'y'),
      ...Arr.filter([cube(model, 'right', [1.4, 0, 0], 'x')], () => model.showSecondCube),
    ],
  });
};
