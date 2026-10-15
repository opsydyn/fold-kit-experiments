/** The sculpture as a pure function of the model: a ground plate and the shown blocks. */
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
  standard,
} from '@opsydyn/effect-three';

import { paintColour, paints } from '../palette';
import { type Block, type Model, shownBlocks } from './model';

/** Blocks sit on a grid from -half to +half on x and z. */
export const half = 4;

const blockNode = (block: Block): SceneNode =>
  mesh({
    key: `block-${block.id}`,
    position: [block.x, block.y + 0.5, block.z],
    geometry: sharedGeometry('block'),
    material: sharedMaterial(block.paint),
    interactive: true,
  });

export const sceneFor = (model: Model) =>
  scene({
    camera: perspectiveCamera({ fov: 40, position: [9, 9, 12], lookAt: [0, 0.5, 0] }),
    resources: {
      geometries: [{ id: 'block', geometry: box({ width: 0.96, height: 0.96, depth: 0.96 }) }],
      materials: paints.map((paint) => ({
        id: paint,
        material: standard({ color: paintColour[paint], roughness: 0.55 }),
      })),
    },
    children: [
      ambientLight({ key: 'ambient', intensity: 0.6 }),
      directionalLight({ key: 'sun', intensity: 2.2, position: [5, 10, 7] }),
      mesh({
        key: 'ground',
        position: [0, -0.1, 0],
        geometry: box({ width: half * 2 + 1, height: 0.2, depth: half * 2 + 1 }),
        material: standard({ color: 0x9aa3b5, roughness: 0.9 }),
        interactive: true,
      }),
      ...shownBlocks(model).map(blockNode),
    ],
  });
