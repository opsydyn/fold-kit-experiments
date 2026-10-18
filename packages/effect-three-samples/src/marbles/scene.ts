/**
 * The marble machine: two colours of marble roll down a ramp onto a paddle wheel turned
 * by a motor, then over a grate that holds teal marbles (they roll off to the left bin)
 * and lets gold ones fall through (to the right). It is all bodies and joints described
 * as data:
 *
 * - the wheel is a group whose children are its colliders, hinged to a fixed axle by a
 *   revolute joint whose velocity motor the Model sets;
 * - the grate's collision groups admit teal marbles only, so gold ones pass through it;
 * - each bin is guarded by a sensor collider named for it, so a collision says which;
 * - the wheel reports contact forces above a threshold: how hard the marbles hit it.
 */
import {
  ambientLight,
  basic,
  bloom,
  body,
  box,
  colorRange,
  contactShadows,
  cuboidCollider,
  cylinder,
  directionalLight,
  environment,
  fixed,
  group,
  instance,
  instances,
  interactionGroups,
  joint,
  label,
  type MaterialRef,
  mesh,
  physical,
  physics,
  renderSettings,
  revoluteJoint,
  scene,
  type SceneNode,
  sphere,
  standard,
  velocityMotor,
  type Vec3,
} from '@opsydyn/effect-three';

import { paintColour } from '../palette';
import type { Colour, Model } from './model';
import { marblesKey } from './update';

/** The machine's frame: inside, x from −3 to 3 and y from 0 up; the channel z ±0.3. */
const width = 6;
const height = 7;
const channel = 0.3;

/** Collision groups: marbles of each colour, and the grate that only teal ones meet. */
const groups = { gold: 1, teal: 2, grate: 3 } as const;

const marbleColour = { gold: paintColour.gold, teal: 0x2fb5a3 } satisfies Record<Colour, number>;

const frame = standard({ color: 0xb9b4aa, roughness: 0.85 });
const glass = physical({ color: 0xeef4ff, opacity: 0.05, transparent: true, roughness: 0.05 });

/** A fixed box: a wall, ramp or pane. */
const slab = (
  key: string,
  position: Vec3,
  size: Vec3,
  options: {
    readonly tilt?: number;
    readonly material?: MaterialRef;
    readonly friction?: number;
  } = {},
): SceneNode =>
  mesh({
    key,
    position,
    rotation: fixed([0, 0, options.tilt ?? 0]),
    geometry: box({ width: size[0], height: size[1], depth: size[2] }),
    material: options.material ?? frame,
    castShadow: true,
    receiveShadow: true,
    body: body({ type: 'fixed', friction: options.friction ?? 0.3 }),
  });

const shell: ReadonlyArray<SceneNode> = [
  slab('floor', [0, -0.1, 0], [width + 0.3, 0.2, channel * 2 + 0.2]),
  slab('wall-left', [-width / 2 - 0.08, height / 2, 0], [0.16, height, channel * 2 + 0.2]),
  // Frictionless, so a marble in the corner where the grate meets it rolls back down.
  slab('wall-right', [width / 2 + 0.08, height / 2, 0], [0.16, height, channel * 2 + 0.2], {
    friction: 0,
  }),
  // The bins' divider, under the grate's low end.
  slab('divider', [0.15, 0.55, 0], [0.12, 1.1, channel * 2]),
  // Glass front and back keep the marbles in the channel, and let you see in.
  slab('glass-front', [0, height / 2, channel + 0.03], [width, height, 0.06], { material: glass }),
  slab('glass-back', [0, height / 2, -channel - 0.03], [width, height, 0.06], { material: glass }),
];

/** The ramp under the hopper, falling to the right towards the wheel. */
const ramp = slab('ramp', [-1.25, 4.95, 0], [3.7, 0.12, channel * 2], { tilt: -0.2 });

const wheelAt: Vec3 = [1.35, 3.45, 0];
const armLength = 1.9;

/** The paddle wheel: a hub and two crossed paddles, one body, turned by its joint's motor. */
const wheel: SceneNode = group({
  key: 'wheel',
  position: wheelAt,
  body: body({ mass: 3, gravityScale: 0, collider: 'cuboid', contactForces: 16 }),
  children: [
    mesh({
      key: 'wheel:paddle-a',
      geometry: box({ width: armLength, height: 0.1, depth: channel * 2 - 0.04 }),
      material: standard({ color: paintColour.coral, roughness: 0.35, metalness: 0.3 }),
      castShadow: true,
    }),
    mesh({
      key: 'wheel:paddle-b',
      geometry: box({ width: 0.1, height: armLength, depth: channel * 2 - 0.04 }),
      material: standard({ color: paintColour.coral, roughness: 0.35, metalness: 0.3 }),
      castShadow: true,
    }),
    mesh({
      key: 'wheel:hub',
      rotation: fixed([Math.PI / 2, 0, 0]),
      geometry: cylinder({ radiusTop: 0.18, radiusBottom: 0.18, height: channel * 2 }),
      material: standard({ color: 0x3a3f4b, metalness: 0.7, roughness: 0.3 }),
    }),
  ],
});

/** A fixed, touchless axle for the wheel to hinge on. */
const axle: SceneNode = mesh({
  key: 'axle',
  position: wheelAt,
  geometry: sphere({ radius: 0.05 }),
  material: basic({ color: 0x3a3f4b }),
  body: body({ type: 'fixed', sensor: true }),
});

const wheelJoint = (model: Model) =>
  joint({
    key: 'wheel:hinge',
    a: 'axle',
    b: 'wheel',
    kind: revoluteJoint({ axis: [0, 0, 1], motor: velocityMotor(model.wheelSpeed, 40) }),
    contacts: false,
  });

const grateLook = standard({
  color: marbleColour.teal,
  opacity: 0.45,
  transparent: true,
  roughness: 0.3,
});

/** A plate of the grate: fixed, and met by teal marbles only. */
const gratePlate = (key: string, position: Vec3, length: number, tilt: number): SceneNode =>
  mesh({
    key,
    position,
    rotation: fixed([0, 0, tilt]),
    geometry: box({ width: length, height: 0.08, depth: channel * 2 }),
    material: grateLook,
    body: body({
      type: 'fixed',
      friction: 0.1,
      collisionGroups: interactionGroups(groups.grate, groups.teal),
    }),
  });

/**
 * The grate: rising to the right under the wheel, and a steep kicker where it meets the
 * wall, so no teal marble can settle in the corner.
 */
const grate: ReadonlyArray<SceneNode> = [
  gratePlate('grate', [0.95, 1.93, 0], 3.4, 0.17),
  gratePlate('grate-kicker', [2.8, 2.38, 0], 0.55, 0.75),
];

/** Sensors over each bin, named, so a collision says which bin a marble dropped into. */
const binSensors: SceneNode = group({
  key: 'bins',
  body: body({
    type: 'fixed',
    sensor: true,
    colliders: [
      cuboidCollider({
        name: 'teal-bin',
        halfExtents: [1.45, 0.5, channel],
        position: [-1.5, 0.55, 0],
      }),
      cuboidCollider({
        name: 'gold-bin',
        halfExtents: [1.35, 0.5, channel],
        position: [1.6, 0.55, 0],
      }),
    ],
  }),
  children: [],
});

const binLabel = (model: Model, key: string, text: string, x: number, colour: number): SceneNode =>
  label({
    key,
    text,
    font: `${model.assetBase}inter-latin-400-normal.woff`,
    fontSize: 0.32,
    position: [x, 1.45, channel + 0.1],
    color: 0x2a2d34,
    // The count in the marbles' colour.
    colorRanges: [colorRange(text.indexOf(' ') + 1, colour)],
    outlineWidth: 0.012,
    outlineColor: 0xffffff,
  });

/** Where the `index`th marble of a colour pours from: over the ramp's high end. */
const pourPoint = (colour: Colour, index: number): Vec3 => [
  -2.75 + (index % 3) * 0.22 + (colour === 'teal' ? 0.11 : 0),
  5.9 + Math.floor(index / 3) * 0.3 + (colour === 'teal' ? 0.15 : 0),
  ((index % 2) - 0.5) * 0.24,
];

const marbles = (model: Model, colour: Colour): SceneNode =>
  instances({
    key: marblesKey(model, colour),
    geometry: sphere({ radius: 0.12, widthSegments: 20, heightSegments: 14 }),
    material:
      colour === 'gold'
        ? standard({
            color: marbleColour.gold,
            emissive: marbleColour.gold,
            // Past 1, so the bloom picks out the gold and nothing else.
            emissiveIntensity: 1.15,
            metalness: 0.4,
            roughness: 0.25,
          })
        : standard({ color: marbleColour.teal, metalness: 0.1, roughness: 0.15 }),
    castShadow: true,
    instances: Array.from({ length: model.poured[colour] }, (_, index) =>
      instance({ key: `${colour[0]}${index}`, position: pourPoint(colour, index) }),
    ),
    body: body({
      collider: 'ball',
      mass: 0.05,
      restitution: 0.25,
      friction: 0.2,
      ccd: true,
      collisionGroups: interactionGroups(groups[colour]),
    }),
  });

export const sceneFor = (model: Model) =>
  scene({
    camera: model.camera,
    gestures: 'scene',
    physics: physics({ joints: [wheelJoint(model)], debug: model.showColliders }),
    environment: environment({ environmentIntensity: 0.4 }),
    contactShadows: contactShadows({
      position: [0, 0.005, 0],
      size: 9,
      far: 3,
      blur: 2.5,
      opacity: 0.55,
    }),
    render: renderSettings({
      toneMapping: 'aces',
      exposure: 0.9,
      effects: [bloom({ strength: 0.45, radius: 0.3, threshold: 1 })],
    }),
    children: [
      ambientLight({ key: 'ambient', intensity: 0.35 }),
      directionalLight({ key: 'sun', position: [4, 8, 6], intensity: 1.4 }),
      ...shell,
      ramp,
      axle,
      wheel,
      ...grate,
      binSensors,
      // The counts in deeper shades of the marbles' colours, legible on any background.
      binLabel(model, 'label:teal', `Teal ${model.tealBin.teal}`, -1.5, 0x168a7c),
      binLabel(model, 'label:gold', `Gold ${model.goldBin.gold}`, 1.6, 0xc08a12),
      marbles(model, 'gold'),
      marbles(model, 'teal'),
    ],
  });
