/**
 * The workshop: the loaded robot on a tiled floor under a sign. The robot is a borrowed
 * node, so it appears when its model is lent and disappears when unloaded; the floor uses
 * the lent texture as its map once it has settled; the sign is text in the lent font,
 * empty until the font arrives. The caption under it is a distance-field label naming the
 * clip playing, drawn by troika from a WOFF font.
 */
import {
  type Animation,
  borrowed,
  directionalLight,
  fixed,
  hemisphereLight,
  label,
  mesh,
  perspectiveCamera,
  plane,
  play,
  scene,
  standard,
  text,
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

const captionOf = (model: Model): string =>
  Option.match(Option.fromNullishOr(model.clip), {
    onNone: () => 'Standing still',
    onSome: (clip) => `Playing “${clip}” at ${model.speed}×`,
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
      mesh({
        key: 'sign',
        position: [0, 2.85, -2.6],
        geometry: text({
          text: 'WORKSHOP',
          font: assetIds.font,
          size: 0.42,
          depth: 0.12,
          bevel: { thickness: 0.02, size: 0.012 },
          center: true,
        }),
        material: standard({ color: 0xf2a541, roughness: 0.35, metalness: 0.2 }),
      }),
      label({
        key: 'caption',
        position: [0, 2.42, -2.6],
        text: captionOf(model),
        font: `${model.assetBase}inter-latin-400-normal.woff`,
        fontSize: 0.24,
        color: 0xf2a541,
        outlineWidth: 0.014,
        outlineColor: 0x2b2a28,
      }),
      borrowed({
        key: 'robot',
        id: assetIds.robot,
        animation: animationOf(model),
        interactive: true,
      }),
    ],
  });
