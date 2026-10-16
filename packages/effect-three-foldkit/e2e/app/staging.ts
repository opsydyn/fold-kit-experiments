/**
 * Staging on a white page, seen straight down: cubes resting on contact shadows. The
 * scene is set from the test through `window.__staging`.
 */
import {
  box,
  fixed,
  plane,
  contactShadows,
  type ContactShadows,
  mesh,
  orthographicCamera,
  scene,
  sphere,
  basic,
} from '@opsydyn/effect-three';
import { Effect, Option, Queue, Stream } from 'effect';
import type { ViewState } from 'foldkit/mount';

import * as EffectThreeFoldkit from '../../src/index.ts';

const environment = EffectThreeFoldkit.makeEnvironment(window);
const sceneMount = EffectThreeFoldkit.makeSceneMount(environment);

/**
 * One unit is 40 pixels, +x to the right and +z down the screen. The cube's flat bottom
 * and the ball's lowest point touch y = 0, over a white floor just below.
 */
const stagingScene = (shadows: Option.Option<ContactShadows>) =>
  scene({
    camera: orthographicCamera({ zoom: 40, position: [0, 10, 0.001], lookAt: [0, 0, 0] }),
    contactShadows: Option.getOrNull(shadows),
    children: [
      mesh({
        key: 'floor',
        position: [0, -0.01, 0],
        rotation: fixed([-Math.PI / 2, 0, 0]),
        geometry: plane({ width: 10, height: 10 }),
        material: basic({ color: 0xffffff }),
      }),
      mesh({
        key: 'cube',
        position: [-2, 0.5, 0],
        geometry: box(),
        material: basic({ color: 0x3366ff }),
      }),
      mesh({
        key: 'ball',
        position: [2, 0.5, 1.5],
        geometry: sphere({ radius: 0.5 }),
        material: basic({ color: 0x3366ff }),
      }),
    ],
  });

const element = document.createElement('effect-three-scene');
element.className = 'scene';
const bare = stagingScene(Option.none());
Reflect.set(element, 'scene', bare);
document.body.append(element);

const viewStates = Effect.runSync(Queue.sliding<ViewState>(4));
Queue.offerUnsafe(viewStates, 'Live');
const lifecycle = sceneMount().f(element, Stream.fromQueue(viewStates));
Effect.runFork(Stream.runDrain(lifecycle));

type ShadowOptions = Parameters<typeof contactShadows>[0];

Reflect.set(globalThis, '__staging', {
  ready: () => element.querySelector('canvas') !== null,
  show: (options: ShadowOptions | null) => {
    const shadows = Option.map(Option.fromNullishOr(options), contactShadows);
    Reflect.set(element, 'scene', stagingScene(shadows));
  },
});
