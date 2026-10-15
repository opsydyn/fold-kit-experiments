/**
 * Two shelves of keyed cubes. Each cube's position comes from its index on its shelf, so
 * reordering produces position updates plus one Order; moving a cube between shelves keeps
 * its three.js object (a Move, not a remove and re-create).
 */
import {
  ambientLight,
  box,
  directionalLight,
  fixed,
  group,
  mesh,
  perspectiveCamera,
  scene,
  type SceneNode,
  sharedGeometry,
  sharedMaterial,
  standard,
} from '@opsydyn/effect-three';
import { Option } from 'effect';

import { paintColour, paints } from '../palette';
import type { Cube, Model } from './model';

const columns = 3;
const spacing = 1.1;

const hoverScale = (model: Model, key: string): number =>
  Option.match(
    Option.filter(model.hovered, (hovered) => hovered === key),
    { onNone: () => 1, onSome: () => 1.12 },
  );

const cubeNode = (model: Model, cube: Cube, index: number): SceneNode => {
  const scale = hoverScale(model, cube.key);
  return mesh({
    key: cube.key,
    position: [((index % columns) - 1) * spacing, Math.floor(index / columns) * spacing, 0],
    rotation: fixed([0.35, 0.6, 0]),
    scale: [scale, scale, scale],
    geometry: sharedGeometry('cube'),
    material: sharedMaterial(cube.paint),
    interactive: true,
  });
};

const shelf = (model: Model, key: string, x: number, cubes: ReadonlyArray<Cube>): SceneNode =>
  group({
    key,
    position: [x, -0.75, 0],
    children: cubes.map((cube, index) => cubeNode(model, cube, index)),
  });

export const sceneFor = (model: Model) =>
  scene({
    camera: perspectiveCamera({ fov: 40, position: [0, 1.4, 7.4], lookAt: [0, 0.35, 0] }),
    resources: {
      geometries: [{ id: 'cube', geometry: box({ width: 0.85, height: 0.85, depth: 0.85 }) }],
      materials: paints.map((paint) => ({
        id: paint,
        material: standard({ color: paintColour[paint], roughness: 0.5 }),
      })),
    },
    children: [
      ambientLight({ key: 'ambient', intensity: 0.55 }),
      directionalLight({ key: 'sun', intensity: 2, position: [4, 6, 6] }),
      shelf(model, 'left-shelf', -2.2, model.left),
      shelf(model, 'right-shelf', 2.2, model.right),
    ],
  });
