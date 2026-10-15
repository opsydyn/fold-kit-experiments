/**
 * A 3 × 3 cluster of spinning shapes in the brand palette, each with its own phase.
 * Hovering pops a shape with an overshooting ease.
 */
import {
  type Axis,
  ambientLight,
  box,
  cylinder,
  directionalLight,
  ease,
  mesh,
  perspectiveCamera,
  scene,
  type SceneNode,
  sharedGeometry,
  sharedMaterial,
  sphere,
  spin,
  standard,
} from '@opsydyn/effect-three';
import { Option } from 'effect';

import { type Paint, paintColour, paints } from '../palette';
import type { Model } from './model';

const axes: ReadonlyArray<Axis> = ['x', 'y', 'y'];
const pieces: ReadonlyArray<string> = ['cube', 'ball', 'drum'];
const pop = ease({ seconds: 0.3, easing: 'easeOutBack' });

const hoverScale = (model: Model, index: number): number =>
  Option.match(
    Option.filter(model.hovered, (hovered) => hovered === index),
    { onNone: () => 1, onSome: () => 1.2 },
  );

const cube = (model: Model, paint: Paint, index: number): SceneNode => {
  const scale = hoverScale(model, index);
  const row = Math.floor(index / 3) - 1;
  const column = (index % 3) - 1;
  return mesh({
    key: `cube-${index}`,
    position: [column * 1.6, row * 1.6, (index % 2) * -0.6],
    scale: [scale, scale, scale],
    transition: pop,
    rotation: spin({
      axis: axes[index % 3] ?? 'y',
      radiansPerSecond: 0.35 + (index % 4) * 0.12,
      phase: index * 0.7,
    }),
    geometry: sharedGeometry(pieces[(index + row + 1) % pieces.length] ?? 'cube'),
    material: sharedMaterial(paint),
    interactive: true,
  });
};

export const sceneFor = (model: Model) =>
  scene({
    camera: perspectiveCamera({ fov: 42, position: [0, 0.4, 8], lookAt: [0, 0, 0] }),
    resources: {
      geometries: [
        { id: 'cube', geometry: box({ width: 1, height: 1, depth: 1 }) },
        { id: 'ball', geometry: sphere({ radius: 0.62 }) },
        { id: 'drum', geometry: cylinder({ radiusTop: 0.55, radiusBottom: 0.55, height: 1 }) },
      ],
      materials: paints.map((paint) => ({
        id: paint,
        material: standard({ color: paintColour[paint], roughness: 0.4, metalness: 0.05 }),
      })),
    },
    children: [
      ambientLight({ key: 'ambient', intensity: 0.6 }),
      directionalLight({ key: 'key-light', intensity: 2.4, position: [4, 5, 6] }),
      directionalLight({ key: 'rim-light', intensity: 0.8, position: [-5, -2, -4] }),
      ...model.paints.map((paint, index) => cube(model, paint, index)),
    ],
  });
