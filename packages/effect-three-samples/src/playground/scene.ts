/**
 * Two shelves of keyed cubes. Each cube's position comes from its index on its shelf, so
 * reordering produces position updates plus one Order; moving a cube between shelves keeps
 * its three.js object (a Move, not a remove and re-create). Every cube eases to its new
 * place, so the Model stays the target while the scene shows the journey. They stand on
 * Drei's fading grid under a daylight sky whose sun is the scene's directional light.
 */
import {
  ambientLight,
  box,
  contactShadows,
  directionalLight,
  ease,
  fixed,
  shaderGrid,
  group,
  mesh,
  perspectiveCamera,
  renderSettings,
  scene,
  type SceneNode,
  sharedGeometry,
  sharedMaterial,
  sky,
  standard,
} from '@opsydyn/effect-three';
import { Option } from 'effect';

import { paintColour, paints } from '../palette';
import type { Cube, Model } from './model';

const columns = 3;
const spacing = 1.1;
const glide = ease({ seconds: 0.35 });

/** Where the sun is: the directional light and the sky agree. */
const sun = [4, 6, 6] as const;

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
    transition: glide,
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
    // The Preetham sky is high dynamic range: it needs tone mapping, as in three's example.
    sky: sky({ sunPosition: sun, turbidity: 4, rayleigh: 1.2 }),
    render: renderSettings({ toneMapping: 'aces', exposure: 0.85 }),
    // Soft shadows under the shelves, just above the grid; the turned cubes' lowest corners
    // dip below the plane, so the shadow camera starts a little under it.
    contactShadows: contactShadows({
      position: [0, -1.17, 0],
      size: 14,
      near: -0.4,
      far: 1.2,
      blur: 2,
      opacity: 0.85,
    }),
    resources: {
      geometries: [{ id: 'cube', geometry: box({ width: 0.85, height: 0.85, depth: 0.85 }) }],
      materials: paints.map((paint) => ({
        id: paint,
        material: standard({ color: paintColour[paint], roughness: 0.5 }),
      })),
    },
    children: [
      ambientLight({ key: 'ambient', intensity: 0.55 }),
      directionalLight({ key: 'sun', intensity: 2, position: sun }),
      shaderGrid({
        key: 'floor',
        position: [0, -1.18, 0],
        infinite: true,
        cellSize: 0.5,
        cellColor: 0xb9c2d0,
        sectionSize: 2,
        sectionColor: 0x8a94a6,
        fadeDistance: 18,
        fadeStrength: 1.5,
      }),
      shelf(model, 'left-shelf', -2.2, model.left),
      shelf(model, 'right-shelf', 2.2, model.right),
    ],
  });
