/**
 * Ten thousand buildings in a single instanced mesh. The skyline for a seed is built once
 * and reused, so a hover or a click changes one or two instances by reference and the
 * diff rewrites just those slots.
 */
import {
  box,
  directionalLight,
  fixed,
  hemisphereLight,
  type Instance,
  instance,
  instances,
  mesh,
  perspectiveCamera,
  plane,
  renderSettings,
  scene,
  standard,
} from '@opsydyn/effect-three';
import { randomLcg } from '@opsydyn/foldkit-viz/math/random';
import { Option } from 'effect';

import { paintColour } from '../palette';
import { buildingCount, buildingKey, type Model, side } from './model';

/** A sequential blue ramp, light to dark: taller buildings read darker. */
const ramp = [0xcde2fb, 0x9ec5f4, 0x6da7ec, 0x3987e5, 0x256abf, 0x184f95];
const tallest = 11;

const heightOf = (next: () => number, index: number): number => {
  const x = (index % side) / side - 0.5;
  const z = Math.floor(index / side) / side - 0.5;
  // Downtown in the middle: taller near the centre, with noise everywhere.
  const centrality = Math.max(0, 1 - Math.hypot(x, z) * 2.2);
  return 0.2 + (tallest - 0.2) * centrality ** 1.6 * (0.35 + next() * 0.65) + next() * 0.3;
};

const building = (index: number, height: number, color: number): Instance =>
  instance({
    key: buildingKey(index),
    position: [(index % side) - side / 2, height / 2, Math.floor(index / side) - side / 2],
    scale: [0.8, height, 0.8],
    color,
  });

const colourFor = (height: number): number =>
  ramp[Math.min(ramp.length - 1, Math.floor((height / tallest) * ramp.length))] ?? 0xcde2fb;

type Skyline = {
  readonly heights: ReadonlyArray<number>;
  readonly buildings: ReadonlyArray<Instance>;
};

const skylineFor = (seed: number): Skyline => {
  const next = randomLcg(seed);
  const heights = Array.from({ length: buildingCount }, (_, index) => heightOf(next, index));
  return {
    heights,
    buildings: heights.map((height, index) => building(index, height, colourFor(height))),
  };
};

// One cached skyline: rebuilding 10,000 instances on every hover would defeat the diff.
const skylines = new Map<number, Skyline>();
const remember = (seed: number): Skyline => {
  const built = skylineFor(seed);
  skylines.clear();
  skylines.set(seed, built);
  return built;
};

const skyline = (seed: number): Skyline =>
  Option.getOrElse(Option.fromNullishOr(skylines.get(seed)), () => remember(seed));

/** The buildings, with raised ones taller and coral and the hovered one gold. */
const buildingsFor = (model: Model): ReadonlyArray<Instance> => {
  const { heights, buildings } = skyline(model.seed);
  const changed = new Map<number, Instance>();
  for (const index of model.raised) {
    changed.set(index, building(index, (heights[index] ?? 1) * 1.8 + 1, paintColour.coral));
  }
  Option.map(model.hovered, (index) =>
    changed.set(
      index,
      building(index, changed.get(index)?.scale[1] ?? heights[index] ?? 1, paintColour.gold),
    ),
  );
  // Nothing changed: hand back the cached list itself, so the diff stops at the reference.
  return Option.match(
    Option.liftPredicate(changed, (changes) => changes.size > 0),
    {
      onNone: () => buildings,
      onSome: (changes) => buildings.map((original, index) => changes.get(index) ?? original),
    },
  );
};

export const sceneFor = (model: Model) =>
  scene({
    camera: perspectiveCamera({ fov: 40, far: 400, position: [62, 50, 62], lookAt: [0, 2, 0] }),
    render: renderSettings({ resolution: model.quality }),
    children: [
      hemisphereLight({ key: 'sky', color: 0xffffff, groundColor: 0x9aa3b5, intensity: 1.2 }),
      directionalLight({ key: 'sun', intensity: 2, position: [40, 80, 20] }),
      mesh({
        key: 'ground',
        rotation: fixed([-Math.PI / 2, 0, 0]),
        geometry: plane({ width: side + 6, height: side + 6 }),
        material: standard({ color: 0xe8e5dd, roughness: 1 }),
      }),
      instances({
        key: 'city',
        geometry: box(),
        material: standard({ roughness: 0.7 }),
        interactive: true,
        instances: buildingsFor(model),
      }),
    ],
  });
