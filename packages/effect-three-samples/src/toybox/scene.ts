/**
 * The toybox: crates and balls dropped into a tray, simulated by Rapier. Each toy is a
 * mesh with a dynamic body; the tray is fixed bodies. The Model never holds where a toy
 * is now, only where it was dropped and the kicks it has had. Marbles are one instances
 * node with a body per instance, and a chain of links hangs from a hook by joints.
 */
import {
  body,
  box,
  contactShadows,
  environment,
  instance,
  instances,
  joint,
  mesh,
  physics,
  scene,
  type SceneNode,
  sphere,
  sphericalJoint,
  standard,
} from '@opsydyn/effect-three';

import { paintAt, paintColour } from '../palette';
import { type Model, reach, type Toy } from './model';
import { toyKey } from './update';

const dropHeight = 4;

const toyNode = (model: Model, toy: Toy): SceneNode =>
  mesh({
    key: toyKey(model, toy),
    // Staggered upwards by id, so toys dropped together land one after another. (Not by
    // place in the list: that shifts as toys come and go, and a new position teleports.)
    position: [toy.x, dropHeight + (toy.id % 6) * 0.6, toy.z],
    geometry:
      toy.kind === 'ball' ? sphere({ radius: 0.35 }) : box({ width: 0.6, height: 0.6, depth: 0.6 }),
    material: standard({ color: paintColour[toy.paint], roughness: 0.45 }),
    interactive: true,
    castShadow: true,
    body: body({
      collider: toy.kind === 'ball' ? 'ball' : 'cuboid',
      mass: 1,
      restitution: toy.kind === 'ball' ? 0.6 : 0.2,
      friction: 0.7,
      impulse: toy.kick,
    }),
  });

const wall = (
  key: string,
  position: readonly [number, number, number],
  width: number,
  depth: number,
): SceneNode =>
  mesh({
    key,
    position,
    geometry: box({ width, height: 0.5, depth }),
    material: standard({ color: 0xd9d6cf, roughness: 0.9 }),
    body: body({ type: 'fixed' }),
  });

const side = reach * 2 + 0.3;

const tray: ReadonlyArray<SceneNode> = [
  mesh({
    key: 'tray-floor',
    position: [0, -0.15, 0],
    geometry: box({ width: side, height: 0.3, depth: side }),
    material: standard({ color: 0xeceae4, roughness: 0.95 }),
    body: body({ type: 'fixed', friction: 0.8 }),
  }),
  wall('tray-north', [0, 0.25, -reach - 0.075], side, 0.15),
  wall('tray-south', [0, 0.25, reach + 0.075], side, 0.15),
  wall('tray-east', [reach + 0.075, 0.25, 0], 0.15, side),
  wall('tray-west', [-reach - 0.075, 0.25, 0], 0.15, side),
];

/** Where the `index`th marble pours from: a tight spiral above the tray's far side. */
const marbleAt = (index: number) => {
  const angle = index * 2.4;
  const radius = 0.15 + (index % 16) * 0.05;
  return {
    key: `m${index}`,
    position: [
      Math.cos(angle) * radius + 0.8,
      dropHeight + 1.5 + Math.floor(index / 16) * 0.4,
      Math.sin(angle) * radius - 0.8,
    ] as const,
    color: paintColour[paintAt(index)],
  };
};

const marbleNode = (model: Model): SceneNode =>
  instances({
    // New per round, as the toys' keys are, so tidying pours them again.
    key: `marbles:${model.round}`,
    geometry: sphere({ radius: 0.12 }),
    material: standard({ roughness: 0.2 }),
    castShadow: true,
    instances: Array.from({ length: model.marbles }, (_, index) => instance(marbleAt(index))),
    body: body({ collider: 'ball', mass: 0.05, restitution: 0.3, friction: 0.4 }),
  });

const hook: readonly [number, number, number] = [-1.6, 3.4, -1.6];
const linkLength = 0.45;
const links = 5;

/** A link hanging below the hook, its top on the one above's bottom; the last is a heavy ball. */
const chainLink = (index: number): SceneNode =>
  mesh({
    key: `chain:${index}`,
    position: [hook[0], hook[1] - (index + 0.5) * linkLength, hook[2]],
    geometry:
      index === links - 1
        ? sphere({ radius: 0.28 })
        : box({ width: 0.08, height: linkLength - 0.05, depth: 0.08 }),
    material: standard({ color: index === links - 1 ? 0x3a3f4b : 0x8a8f99, metalness: 0.6 }),
    castShadow: true,
    body: body({ mass: index === links - 1 ? 3 : 0.2, angularDamping: 0.2 }),
  });

const chain: ReadonlyArray<SceneNode> = [
  mesh({
    key: 'chain:hook',
    position: hook,
    geometry: sphere({ radius: 0.06 }),
    material: standard({ color: 0x3a3f4b }),
    body: body({ type: 'fixed', sensor: true }),
  }),
  ...Array.from({ length: links }, (_, index) => chainLink(index)),
];

/** Each link hangs from the one above (the first from the hook) by its top end. */
const chainJoints = Array.from({ length: links }, (_, index) =>
  joint({
    key: `chain:joint:${index}`,
    a: index === 0 ? 'chain:hook' : `chain:${index - 1}`,
    b: `chain:${index}`,
    anchorA: index === 0 ? [0, 0, 0] : [0, -linkLength / 2, 0],
    anchorB: [0, linkLength / 2, 0],
    kind: sphericalJoint(),
    // Neighbouring links overlap where they meet: let them pass through each other.
    contacts: false,
  }),
);

export const sceneFor = (model: Model) =>
  scene({
    camera: model.camera,
    gestures: 'scene',
    physics: physics({ joints: chainJoints, debug: model.showColliders }),
    // In VR the player stands where the Model says: in front of the tray, to begin with.
    xr: model.player,
    environment: environment({ environmentIntensity: 0.6 }),
    contactShadows: contactShadows({
      position: [0, 0.01, 0],
      size: side,
      near: -0.05,
      far: 1.5,
      blur: 2,
      opacity: 0.7,
    }),
    children: [
      ...tray,
      ...chain,
      marbleNode(model),
      ...model.toys.map((toy) => toyNode(model, toy)),
    ],
  });
