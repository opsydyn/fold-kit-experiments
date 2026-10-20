/**
 * The tabletop: a tower of blocks on a walled table, and the balls thrown at it. Rapier
 * owns where everything is; the Model keeps only what was thrown, from where, with what
 * push, and the world's clock (`physics({ until })`), so each peer's world gets every
 * throw at the same step (ADR-014).
 */
import {
  ballCollider,
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
import { Option } from 'effect';

import { paintAt, paintColour } from '../palette';
import { camera, type Ball, type Model } from './model';
import { snapshotAtOf, untilOf } from './update';

const table = { width: 10, depth: 8 };

const wall = (
  key: string,
  position: readonly [number, number, number],
  width: number,
  depth: number,
): SceneNode =>
  mesh({
    key,
    position,
    geometry: box({ width, height: 0.6, depth }),
    material: standard({ color: 0xd9d6cf, roughness: 0.9 }),
    body: body({ type: 'fixed' }),
  });

const tableNodes: ReadonlyArray<SceneNode> = [
  mesh({
    key: 'table',
    position: [0, -0.2, 0],
    geometry: box({ width: table.width, height: 0.4, depth: table.depth }),
    material: standard({ color: 0xeceae4, roughness: 0.95 }),
    interactive: true,
    receiveShadow: true,
    body: body({ type: 'fixed', friction: 0.8 }),
  }),
  wall('wall-back', [0, 0.3, -table.depth / 2 - 0.1], table.width + 0.4, 0.2),
  wall('wall-left', [-table.width / 2 - 0.1, 0.3, 0], 0.2, table.depth),
  wall('wall-right', [table.width / 2 + 0.1, 0.3, 0], 0.2, table.depth),
];

const layers = 8;
const block = { long: 1.5, wide: 0.5, high: 0.3 };

/**
 * The `index`th block of the tower: three a layer, each layer across the one below. A
 * block lies across by its size, not by turning: nothing a peer computes with sines and
 * cosines (which browsers may round differently) reaches the world.
 */
const blockNode = (build: number, index: number): SceneNode => {
  const layer = Math.floor(index / 3);
  const across = layer % 2 === 1;
  const offset = ((index % 3) - 1) * block.wide;
  return mesh({
    // New keys each build: a rebuilt tower is new bodies, where the description puts them.
    key: `block-${build}-${index}`,
    position: [across ? offset : 0, block.high / 2 + layer * block.high, across ? 0 : offset],
    geometry: across
      ? box({ width: block.wide, height: block.high, depth: block.long })
      : box({ width: block.long, height: block.high, depth: block.wide }),
    material: standard({ color: paintColour[paintAt(layer)], roughness: 0.6 }),
    interactive: true,
    castShadow: true,
    body: body({ mass: 0.4, friction: 0.6 }),
  });
};

const ballRadius = 0.22;

const ballNode = (ball: Ball): SceneNode =>
  mesh({
    key: ball.key,
    position: ball.from,
    geometry: sphere({ radius: ballRadius }),
    material: standard({ color: paintColour[ball.paint], roughness: 0.3 }),
    castShadow: true,
    // Its own collider, sized exactly, rather than one measured from the sphere's vertices.
    body: body({
      colliders: [ballCollider({ radius: ballRadius })],
      mass: 1,
      ccd: true,
      impulse: { id: 1, impulse: ball.impulse },
    }),
  });

export const sceneFor = (model: Model) =>
  scene({
    camera,
    physics: physics({
      until: untilOf(model),
      run: model.run,
      snapshotAt: snapshotAtOf(model),
      from: Option.getOrNull(model.start),
    }),
    environment: environment({ environmentIntensity: 0.6 }),
    contactShadows: contactShadows({
      position: [0, 0.01, 0],
      size: 10,
      near: -0.05,
      far: 3,
      blur: 2,
      opacity: 0.6,
    }),
    children: [
      ...tableNodes,
      ...Array.from({ length: layers * 3 }, (_, index) => blockNode(model.build, index)),
      ...model.balls.map(ballNode),
    ],
  });
