/**
 * The workshop: the loaded robot on a tiled floor. The robot is a borrowed node, so it
 * appears when its model is lent and disappears when unloaded; the floor uses the lent
 * texture as its map once it has settled.
 */
import {
  type Animation,
  borrowed,
  directionalLight,
  fixed,
  hemisphereLight,
  mesh,
  perspectiveCamera,
  plane,
  play,
  scene,
  standard,
} from '@opsydyn/effect-three';
import { Option } from 'effect';
import { matchData } from 'foldkit/asyncData';

import { assetIds, type Model } from './model';

/** The floor's map: the lent texture once it has settled, none before. */
const floorMap = (model: Model): string | null =>
  matchData(model.floor, {
    onEmpty: () => null,
    onFailure: () => null,
    onData: () => assetIds.floor,
  });

const animationOf = (model: Model): Animation | null =>
  Option.match(Option.fromNullishOr(model.clip), {
    onNone: () => null,
    onSome: (clip) => play(clip, { speed: model.speed }),
  });

export const sceneFor = (model: Model) =>
  scene({
    camera: perspectiveCamera({ fov: 40, position: [2.2, 2.6, 5.4], lookAt: [0, 1, 0] }),
    children: [
      hemisphereLight({ key: 'sky', color: 0xffffff, groundColor: 0x8d8a83, intensity: 1.4 }),
      directionalLight({ key: 'sun', intensity: 2.2, position: [3, 6, 4] }),
      mesh({
        key: 'floor',
        rotation: fixed([-Math.PI / 2, 0, 0]),
        geometry: plane({ width: 8, height: 8 }),
        material: standard({ color: 0xffffff, roughness: 0.9, map: floorMap(model) }),
      }),
      borrowed({
        key: 'robot',
        id: assetIds.robot,
        animation: animationOf(model),
        interactive: true,
      }),
    ],
  });
