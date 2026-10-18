/**
 * A small room, presentable in VR and AR. On the page and in VR it is furniture you can
 * plant things around; in AR the furniture goes, your own room shows through, and what
 * the session finds there is described as data:
 *
 * - each plant placed in AR is an anchor (`xr({ anchors })`), and a group following
 *   `anchorSpace(id)` keeps the plant where you put it as the session learns the room;
 * - detected planes and meshes come back as Messages; groups following `planeSpace(id)`
 *   and `meshSpace(id)` draw them, a mesh with its lent geometry (`xrMesh(id)`);
 * - a tips label follows your left hand or controller (`jointSpace`, `controllerSpace`).
 */
import {
  basic,
  box,
  circle,
  cone,
  controllerSpace,
  cylinder,
  directionalLight,
  environment,
  fixed,
  group,
  hemisphereLight,
  jointSpace,
  label,
  meshSpace,
  mesh,
  plane,
  planeSpace,
  pointLight,
  renderSettings,
  scene,
  type SceneNode,
  sphere,
  standard,
  type Vec3,
  xrAnchor,
  anchorSpace,
  xrMesh,
  type XrPlane,
} from '@opsydyn/effect-three';

import { paintColour } from '../palette';
import type { Model, Plant } from './model';

const piece = (
  key: string,
  position: Vec3,
  size: Vec3,
  colour: number,
  roughness = 0.8,
): SceneNode =>
  mesh({
    key,
    position,
    geometry: box({ width: size[0], height: size[1], depth: size[2] }),
    material: standard({ color: colour, roughness }),
    castShadow: true,
    receiveShadow: true,
  });

const sofaColour = 0x5d6b8c;
const wood = 0x9a6b45;

/** The room: floor, two walls with a window, a sofa, a table on a rug, a lamp and a shelf. */
const room: ReadonlyArray<SceneNode> = [
  mesh({
    key: 'floor',
    rotation: fixed([-Math.PI / 2, 0, 0]),
    geometry: plane({ width: 6, height: 6 }),
    material: standard({ color: 0xc8a27a, roughness: 0.7 }),
    receiveShadow: true,
    interactive: true,
  }),
  mesh({
    key: 'rug',
    position: [0.3, 0.004, -1.1],
    rotation: fixed([-Math.PI / 2, 0, 0]),
    geometry: circle({ radius: 1.35, segments: 48 }),
    material: standard({ color: 0xe9e1d3, roughness: 1 }),
    receiveShadow: true,
    interactive: true,
  }),
  piece('wall-back', [0, 1.4, -3], [6, 2.8, 0.1], 0xe8e2d8, 0.95),
  piece('wall-left', [-3, 1.4, 0], [0.1, 2.8, 6], 0xded6ca, 0.95),
  mesh({
    key: 'window',
    position: [1.6, 1.6, -2.94],
    geometry: plane({ width: 1.4, height: 1.1 }),
    material: standard({ color: 0xbcd4ff, emissive: 0xbcd4ff, emissiveIntensity: 0.9 }),
  }),
  piece('sofa-seat', [0.3, 0.22, -2.35], [2.2, 0.44, 0.9], sofaColour),
  piece('sofa-back', [0.3, 0.62, -2.75], [2.2, 0.56, 0.22], sofaColour),
  piece('sofa-arm-left', [-0.85, 0.42, -2.35], [0.2, 0.42, 0.9], sofaColour),
  piece('sofa-arm-right', [1.45, 0.42, -2.35], [0.2, 0.42, 0.9], sofaColour),
  piece('cushion', [-0.25, 0.55, -2.5], [0.42, 0.34, 0.14], paintColour.coral, 1),
  piece('table-top', [0.3, 0.42, -1.1], [1.1, 0.05, 0.6], wood, 0.45),
  ...[-0.45, 0.45].flatMap((x) =>
    [-0.22, 0.22].map((z) =>
      piece(`table-leg:${x}:${z}`, [0.3 + x, 0.2, -1.1 + z], [0.05, 0.4, 0.05], wood, 0.45),
    ),
  ),
  // The lamp: a pole, a glowing shade, and its light.
  mesh({
    key: 'lamp-pole',
    position: [-2.1, 0.75, -2.3],
    geometry: cylinder({ radiusTop: 0.025, radiusBottom: 0.025, height: 1.5 }),
    material: standard({ color: 0x2b2e35, metalness: 0.6, roughness: 0.4 }),
    castShadow: true,
  }),
  mesh({
    key: 'lamp-shade',
    position: [-2.1, 1.55, -2.3],
    geometry: cylinder({ radiusTop: 0.16, radiusBottom: 0.24, height: 0.3, radialSegments: 24 }),
    material: standard({ color: 0xffe2b0, emissive: 0xffc56b, emissiveIntensity: 1.2 }),
  }),
  pointLight({ key: 'lamp', color: 0xffc98a, intensity: 6, position: [-2.1, 1.45, -2.3] }),
  // A shelf of books on the left wall.
  piece('shelf', [-2.82, 1.3, -0.6], [0.3, 0.04, 1.4], wood, 0.5),
  ...[0x3d79fa, 0xf5ce60, 0x80d7bb, 0xfa8b79, 0xb38bf5, 0x2b2e35].map((colour, index) =>
    piece(
      `book:${index}`,
      [-2.8, 1.47, -1.15 + index * 0.2],
      [0.22, 0.3 - (index % 3) * 0.04, 0.16],
      colour,
      0.7,
    ),
  ),
];

/** A potted plant, at the origin of whatever holds it. */
const plantParts = (id: string): ReadonlyArray<SceneNode> => [
  mesh({
    key: `${id}:pot`,
    position: [0, 0.11, 0],
    geometry: cylinder({ radiusTop: 0.11, radiusBottom: 0.08, height: 0.22, radialSegments: 20 }),
    material: standard({ color: paintColour.coral, roughness: 0.6 }),
    castShadow: true,
    interactive: true,
  }),
  mesh({
    key: `${id}:leaves`,
    position: [0, 0.38, 0],
    geometry: cone({ radius: 0.16, height: 0.4, radialSegments: 12 }),
    material: standard({ color: 0x4f9a6b, roughness: 0.7, flatShading: true }),
    castShadow: true,
    interactive: true,
  }),
  mesh({
    key: `${id}:bloom`,
    position: [0.05, 0.6, 0.02],
    geometry: sphere({ radius: 0.04 }),
    material: standard({
      color: paintColour.gold,
      emissive: paintColour.gold,
      emissiveIntensity: 0.4,
    }),
  }),
];

/** In AR a plant rides its anchor; elsewhere it stands where it was put. */
const plantNode = (model: Model, plant: Plant): SceneNode =>
  group({
    key: plant.id,
    position: plant.at,
    follow: model.session === 'immersive-ar' ? anchorSpace(plant.id) : null,
    children: plantParts(plant.id),
  });

/** A detected plane, drawn flat over its outline's bounds, with what the device took it for. */
const planeNode = (detected: XrPlane): SceneNode => {
  const xs = detected.polygon.map((point) => point[0]);
  const zs = detected.polygon.map((point) => point[2]);
  const width = Math.max(0.05, Math.max(...xs) - Math.min(...xs));
  const depth = Math.max(0.05, Math.max(...zs) - Math.min(...zs));
  const centre: Vec3 = [
    (Math.max(...xs) + Math.min(...xs)) / 2,
    0.002,
    (Math.max(...zs) + Math.min(...zs)) / 2,
  ];
  return group({
    key: `plane:${detected.id}`,
    follow: planeSpace(detected.id),
    children: [
      mesh({
        key: `plane:${detected.id}:surface`,
        position: centre,
        rotation: fixed([-Math.PI / 2, 0, 0]),
        geometry: plane({ width, height: depth }),
        material: basic({ color: paintColour.mint, opacity: 0.25, transparent: true }),
      }),
      ...(detected.label === ''
        ? []
        : [
            label({
              key: `plane:${detected.id}:label`,
              text: detected.label,
              position: [centre[0], 0.08, centre[2]],
              fontSize: 0.06,
              color: 0xffffff,
              outlineWidth: 0.004,
              outlineColor: 0x1f3b33,
            }),
          ]),
    ],
  });
};

/** Tips that ride the left hand, or the left controller: whichever is tracked shows. */
const tips = (model: Model): ReadonlyArray<SceneNode> => {
  const text =
    model.session === 'immersive-ar'
      ? 'Point at a surface and pull the trigger (or pinch) to plant.'
      : 'Left stick glides, right stick turns. Point at the floor and pull the trigger to plant.';
  const tip = (key: string) =>
    label({
      key,
      text,
      font: `${model.assetBase}inter-latin-400-normal.woff`,
      position: [0, 0.09, 0],
      fontSize: 0.016,
      maxWidth: 0.16,
      color: 0xffffff,
      outlineWidth: 0.0015,
      outlineColor: 0x1d2433,
    });
  return [
    group({
      key: 'tips:hand',
      follow: jointSpace('left', 'wrist'),
      children: [tip('tips:hand:text')],
    }),
    group({
      key: 'tips:controller',
      follow: controllerSpace('left'),
      children: [tip('tips:controller:text')],
    }),
  ];
};

export const sceneFor = (model: Model) => {
  const inAr = model.session === 'immersive-ar';
  return scene({
    camera: model.camera,
    gestures: 'scene',
    xr: {
      ...model.player,
      // Anchors only where the room is the real one.
      anchors: inAr
        ? model.plants.map((plant) => xrAnchor({ id: plant.id, position: plant.at }))
        : [],
    },
    environment: inAr ? null : environment({ environmentIntensity: 0.45 }),
    render: renderSettings({ shadows: 'soft', toneMapping: 'aces', exposure: 1.05 }),
    children: [
      hemisphereLight({ key: 'sky', color: 0xeef3ff, groundColor: 0x6b5a48, intensity: 0.8 }),
      directionalLight({
        key: 'sun',
        position: [3, 4.5, 2],
        intensity: 1.4,
        castShadow: true,
        shadowArea: 8,
      }),
      ...(inAr ? [] : room),
      ...model.plants.map((plant) => plantNode(model, plant)),
      ...model.planes.map(planeNode),
      ...model.meshes.map((detected) =>
        group({
          key: `mesh:${detected.id}`,
          follow: meshSpace(detected.id),
          children: [
            mesh({
              key: `mesh:${detected.id}:shape`,
              geometry: xrMesh(detected.id),
              material: basic({ color: paintColour.periwinkle, wireframe: true }),
            }),
          ],
        }),
      ),
      ...tips(model),
    ],
  });
};
