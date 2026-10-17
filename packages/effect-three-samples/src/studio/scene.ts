/**
 * The studio: five pieces on a floor, each in its own material kind, lit by a sky light,
 * a warm point light and a spot light that follows the selected piece and casts shadows.
 * A monitor at the back shows the selected piece close up, through a render texture, and
 * a room environment gives the glossy and metal finishes something to reflect.
 */
import {
  basic,
  box,
  type Camera,
  capsule,
  cone,
  ease,
  environment,
  fixed,
  hemisphereLight,
  lambert,
  type MaterialRef,
  mesh,
  perspectiveCamera,
  phong,
  physical,
  plane,
  pointLight,
  renderSettings,
  renderTexture,
  scene,
  type SceneNode,
  sharedGeometry,
  sphere,
  spotLight,
  standard,
  torus,
  type Vec3,
  type View,
  view,
} from '@opsydyn/effect-three';
import { Option } from 'effect';

import { lighten } from '../bars/colours';
import { paintColour } from '../palette';
import { planLens, viewKey } from './cameras';
import { type Finish, type Lens, limit, type Model, type Piece, type Placement } from './model';
import { pieceKey } from './update';

const glide = ease({ seconds: 0.18, easing: 'easeOutCubic' });

const colour = {
  torus: paintColour.coral,
  capsule: paintColour.blue,
  cone: paintColour.gold,
  ball: paintColour.periwinkle,
  crate: paintColour.mint,
} satisfies Record<Piece, number>;

/** Height of each piece's centre when it rests on the floor. */
const restingHeight = {
  torus: 0.63,
  capsule: 0.62,
  cone: 0.5,
  ball: 0.5,
  crate: 0.4,
} satisfies Record<Piece, number>;

/** A quarter-ish turn on the crate so it reads as a cube, not a square. */
const turn = {
  torus: [0, 0, 0],
  capsule: [0, 0, 0],
  cone: [0, 0, 0],
  ball: [0, 0, 0],
  crate: [0, 0.5, 0],
} satisfies Record<Piece, Vec3>;

/** Each finish is a different three.js material kind. */
const finishMaterial = {
  matte: (color: number, glow: number) => lambert({ color, emissive: glow }),
  glossy: (color: number, glow: number) =>
    phong({ color, emissive: glow, specular: 0x444444, shininess: 80 }),
  // Fully metallic: it reflects the room environment the studio is lit by.
  metal: (color: number, glow: number) =>
    standard({ color, emissive: glow, metalness: 1, roughness: 0.25 }),
  lacquer: (color: number, glow: number) =>
    physical({ color, emissive: glow, roughness: 0.45, clearcoat: 1, clearcoatRoughness: 0.05 }),
  flat: (color: number, glow: number) => basic({ color: lighten(color, glow / 0xffffff) }),
} satisfies Record<Finish, (color: number, glow: number) => MaterialRef>;

const isHovered = (model: Model, piece: Piece): boolean =>
  Option.isSome(Option.filter(model.hovered, (hovered) => hovered === piece));

/** A faint glow on the hovered piece; none otherwise. */
const glowOf = (model: Model, piece: Piece): number =>
  Option.match(
    Option.liftPredicate(piece, (candidate) => isHovered(model, candidate)),
    {
      onNone: () => 0x000000,
      onSome: () => 0x2a2a2a,
    },
  );

const pieceNode = (model: Model, placement: Placement): SceneNode => {
  const material = finishMaterial[placement.finish](
    colour[placement.piece],
    glowOf(model, placement.piece),
  );
  return mesh({
    key: pieceKey(placement.piece),
    position: [placement.x, restingHeight[placement.piece], placement.z],
    rotation: fixed(turn[placement.piece]),
    transition: glide,
    geometry: sharedGeometry(placement.piece),
    material,
    interactive: true,
    castShadow: true,
  });
};

/** Where the spot light aims: the selected piece, or the middle of the floor. */
const spotTarget = (model: Model): Vec3 =>
  Option.getOrElse(
    Option.flatMap(model.selected, (piece) =>
      Option.map(
        Option.fromNullishOr(model.placements.find((placement) => placement.piece === piece)),
        (placement): Vec3 => [placement.x, 0, placement.z],
      ),
    ),
    (): Vec3 => [0, 0, 0],
  );

/** The split lens: the orbiting view on the left, a plan from above on the right. */
const splitViews = (camera: Camera): ReadonlyArray<View> => [
  view({ key: viewKey.front, camera, rect: { width: 0.5 } }),
  view({ key: viewKey.plan, camera: planLens, rect: { x: 0.5, width: 0.5 } }),
];

const noViews: ReadonlyArray<View> = [];

const viewsFor = {
  perspective: () => noViews,
  orthographic: () => noViews,
  split: splitViews,
} satisfies Record<Lens, (camera: Camera) => ReadonlyArray<View>>;

/** The selected piece alone, turned to show its finish; nothing when none is selected. */
const closeUp = (model: Model): ReadonlyArray<SceneNode> =>
  Option.match(
    Option.flatMap(model.selected, (piece) =>
      Option.fromNullishOr(model.placements.find((placement) => placement.piece === piece)),
    ),
    {
      onNone: () => [],
      onSome: (placement) => [
        mesh({
          key: 'close-up',
          rotation: fixed([0.35, 0.6, 0]),
          geometry: sharedGeometry(placement.piece),
          material: finishMaterial[placement.finish](colour[placement.piece], 0x000000),
        }),
      ],
    },
  );

/**
 * The monitor's picture: its own little scene, drawn into the `monitor` texture only when
 * the selection or its finish changes.
 */
const monitorPicture = (model: Model) =>
  renderTexture({
    id: 'monitor',
    width: 384,
    height: 240,
    camera: perspectiveCamera({ fov: 35, position: [0, 0.5, 2.6], lookAt: [0, 0, 0] }),
    background: 0x1d2128,
    children: [
      hemisphereLight({
        key: 'monitor-sky',
        color: 0xffffff,
        groundColor: 0x55524c,
        intensity: 1.4,
      }),
      pointLight({ key: 'monitor-key', intensity: 8, position: [1.5, 1.5, 2] }),
      ...closeUp(model),
    ],
  });

export const sceneFor = (model: Model) =>
  scene({
    camera: model.camera,
    gestures: 'scene',
    // Each piece's box, for framing them all.
    measure: model.placements.map((placement) => pieceKey(placement.piece)),
    views: viewsFor[model.lens](model.camera),
    render: renderSettings({ shadows: model.shadows, toneMapping: model.tone }),
    // three's RoomEnvironment: soft studio reflections without an image file.
    environment: environment({ environmentIntensity: 0.35 }),
    renderTextures: [monitorPicture(model)],
    resources: {
      geometries: [
        { id: 'torus', geometry: torus({ radius: 0.45, tube: 0.18, tubularSegments: 64 }) },
        { id: 'capsule', geometry: capsule({ radius: 0.32, height: 0.6, radialSegments: 24 }) },
        { id: 'cone', geometry: cone({ radius: 0.45, height: 1 }) },
        { id: 'ball', geometry: sphere({ radius: 0.5 }) },
        { id: 'crate', geometry: box({ width: 0.8, height: 0.8, depth: 0.8 }) },
      ],
    },
    children: [
      hemisphereLight({ key: 'sky', color: 0xffffff, groundColor: 0x8d8a83, intensity: 1.1 }),
      pointLight({ key: 'rim', color: 0xffd2a0, intensity: 14, position: [-3, 2.5, -2.5] }),
      spotLight({
        key: 'spot',
        intensity: 90,
        position: [2.5, 6, 3.5],
        target: spotTarget(model),
        angle: 0.65,
        penumbra: 0.5,
        castShadow: true,
        shadowMapSize: 1024,
        shadowBias: -0.0005,
      }),
      mesh({
        key: 'floor',
        rotation: fixed([-Math.PI / 2, 0, 0]),
        geometry: plane({ width: limit * 2 + 1.2, height: limit * 2 + 1.2 }),
        material: standard({ color: 0xd9d6cf, roughness: 0.95 }),
        receiveShadow: true,
      }),
      mesh({
        key: 'monitor',
        position: [0, 1.15, -limit - 0.4],
        geometry: plane({ width: 3.2, height: 2 }),
        material: basic({ map: 'monitor' }),
      }),
      ...model.placements.map((placement) => pieceNode(model, placement)),
    ],
  });
