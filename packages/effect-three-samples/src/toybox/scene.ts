/**
 * The toybox: crates and balls dropped into a tray, simulated by Rapier. Each toy is a
 * mesh with a dynamic body; the tray is fixed bodies. The Model never holds where a toy
 * is now, only where it was dropped and the kicks it has had.
 */
import {
  body,
  box,
  contactShadows,
  environment,
  mesh,
  physics,
  scene,
  type SceneNode,
  sphere,
  standard,
} from '@opsydyn/effect-three';

import { paintColour } from '../palette';
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

export const sceneFor = (model: Model) =>
  scene({
    camera: model.camera,
    gestures: 'scene',
    physics: physics(),
    environment: environment({ environmentIntensity: 0.6 }),
    contactShadows: contactShadows({
      position: [0, 0.01, 0],
      size: side,
      near: -0.05,
      far: 1.5,
      blur: 2,
      opacity: 0.7,
    }),
    children: [...tray, ...model.toys.map((toy) => toyNode(model, toy))],
  });
