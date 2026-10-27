/**
 * The CAP moons, an Easter egg: up close, Local-first sync has three small extra moons,
 * Consistency, Availability and Partition tolerance. From any bearing round the radar one
 * of them is gone, so you can never see all three at once: pick two.
 */
import {
  basic,
  ease,
  fixed,
  group,
  mesh,
  type SceneNode,
  sharedGeometry,
  sharedMaterial,
  sphere,
  spin,
} from '@opsydyn/effect-three';
import { Option } from 'effect';

import { type Model, isVisible, positionOf } from './model';
import { bearingOf, blipPosition, detailFor, showsName } from './space';

/** The entry the CAP moons circle: syncing replicas is where the trade-off bites. */
export const capHost = { id: 'local-first-sync' } as const;

export const capMoons = ['Consistency', 'Availability', 'Partition tolerance'] as const;

/** Wider than the relationship moons, even round a pinned blip, and tilted off them. */
export const capOrbit = { radius: 0.46, tilt: [0.5, 0, -0.3] } as const;

/**
 * The moon that is gone from where the camera stands: each third of the way round the
 * radar loses a different one.
 */
export const missingMoon = (camera: Readonly<[number, number, number]>): number =>
  Math.floor((((bearingOf(camera) % 360) + 360) % 360) / 120) % capMoons.length;

/** Never scale to zero: a degenerate matrix breaks lighting and hit testing. */
const gone = 0.001;

/** Whether the moons show: the host is on the radar and the camera is close enough to name it. */
export const capShows = (model: Model): boolean =>
  isVisible(model, capHost.id) &&
  Option.exists(positionOf(model, capHost.id), (position) =>
    showsName(detailFor(model.camera.position, blipPosition(position))),
  );

const moonAt = (index: number) => {
  const angle = (index / capMoons.length) * 2 * Math.PI;
  return [capOrbit.radius * Math.cos(angle), 0, capOrbit.radius * Math.sin(angle)] as const;
};

/** One CAP moon, shrunk to nothing when it is the one gone from here. */
const capMoonNode = (missing: number, index: number): SceneNode => {
  const size = Number(index !== missing) * (1 - gone) + gone;
  return mesh({
    key: `egg:cap:moon:${index}`,
    position: [...moonAt(index)],
    scale: [size, size, size],
    transition: ease({ seconds: 0.5 }),
    geometry: sharedGeometry('egg:cap-moon'),
    material: sharedMaterial('egg:cap-moon'),
  });
};

const capNode = (model: Model, at: Readonly<[number, number, number]>): SceneNode => {
  const missing = missingMoon(model.camera.position);
  return group({
    key: 'egg:cap',
    position: at,
    rotation: fixed([...capOrbit.tilt]),
    interactive: true,
    children: [
      group({
        key: 'egg:cap:orbit',
        // Scene time stops under reduced motion, so the moons hold where they are.
        rotation: spin({ axis: 'y', radiansPerSecond: (2 * Math.PI) / 20 }),
        children: capMoons.map((_, index) => capMoonNode(missing, index)),
      }),
    ],
  });
};

export const capNodes = (model: Model): ReadonlyArray<SceneNode> =>
  Option.match(
    Option.filter(positionOf(model, capHost.id), () => capShows(model)),
    {
      onNone: () => [],
      onSome: (position) => [capNode(model, blipPosition(position))],
    },
  );

export const isCapKey = (key: string): boolean => /^egg:cap(?::|$)/.test(key);

/** What the readout says over the moons: which two this side of the radar keeps. */
export const capReadout = (model: Model): string => {
  const missing = missingMoon(model.camera.position);
  const kept = capMoons.filter((_, index) => index !== missing).join(' and ');
  return `CAP: Consistency, Availability, Partition tolerance. Pick two; from here, ${kept}`;
};

export const capGeometries = [
  { id: 'egg:cap-moon', geometry: sphere({ radius: 0.03, widthSegments: 10, heightSegments: 8 }) },
];

export const capMaterials = [{ id: 'egg:cap-moon', material: basic({ color: 0xe8e8f0 }) }];
