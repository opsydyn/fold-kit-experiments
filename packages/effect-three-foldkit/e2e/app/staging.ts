/**
 * Staging on a white page, seen straight down: cubes resting on contact shadows. The
 * scene is set from the test through `window.__staging`.
 */
import {
  basic,
  box,
  contactShadows,
  type ContactShadows,
  fixed,
  line,
  mesh,
  orthographicCamera,
  plane,
  points,
  scene,
  shaderGrid,
  sphere,
} from '@opsydyn/effect-three';
import { Effect, Option, Queue, Stream } from 'effect';
import type { ViewState } from 'foldkit/mount';

import * as EffectThreeFoldkit from '../../src/index.ts';
import { rendererFromAddress } from './rendererChoice.ts';

// `?renderer=webgpu` draws with three's WebGPURenderer (its WebGL 2 backend, or real
// WebGPU with `&backend=webgpu`): the same scenes through the TSL render kit.
const environment = EffectThreeFoldkit.makeEnvironment(
  window,
  rendererFromAddress(location.search),
);
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

/** The white floor under Drei's shader grid: black cells a unit apart, red sections two. */
const gridScene = () =>
  scene({
    camera: orthographicCamera({ zoom: 40, position: [0, 10, 0.001], lookAt: [0, 0, 0] }),
    children: [
      mesh({
        key: 'floor',
        position: [0, -0.01, 0],
        rotation: fixed([-Math.PI / 2, 0, 0]),
        geometry: plane({ width: 10, height: 10 }),
        material: basic({ color: 0xffffff }),
      }),
      shaderGrid({
        key: 'grid',
        size: [8, 8],
        cellSize: 1,
        cellThickness: 1,
        sectionSize: 2,
        sectionThickness: 2,
        sectionColor: 0xff0000,
      }),
    ],
  });

/**
 * A blue line 6 pixels wide across the white floor at z = 0 (Drei's `Line`), and a red
 * dashed one at z = 2, from x = −3 to 3, seen from above.
 */
const lineScene = () =>
  scene({
    camera: orthographicCamera({ zoom: 40, position: [0, 10, 0.001], lookAt: [0, 0, 0] }),
    children: [
      mesh({
        key: 'floor',
        position: [0, -0.01, 0],
        rotation: fixed([-Math.PI / 2, 0, 0]),
        geometry: plane({ width: 10, height: 10 }),
        material: basic({ color: 0xffffff }),
      }),
      line({
        key: 'solid',
        points: [
          [-3, 0, 0],
          [3, 0, 0],
        ],
        color: 0x0000ff,
        width: 6,
      }),
      line({
        key: 'dashes',
        points: [
          [-3, 0, 2],
          [3, 0, 2],
        ],
        color: 0xff0000,
        width: 6,
        dashed: true,
        dashSize: 0.5,
        gapSize: 0.5,
      }),
    ],
  });

/** A red dot 40 pixels across at the origin, round, on the white floor, seen from above. */
const pointsScene = () =>
  scene({
    camera: orthographicCamera({ zoom: 40, position: [0, 10, 0.001], lookAt: [0, 0, 0] }),
    children: [
      mesh({
        key: 'floor',
        position: [0, -0.01, 0],
        rotation: fixed([-Math.PI / 2, 0, 0]),
        geometry: plane({ width: 10, height: 10 }),
        material: basic({ color: 0xffffff }),
      }),
      points({
        key: 'dot',
        positions: [[0, 0, 0]],
        color: 0xff0000,
        size: 40,
        sizeAttenuation: false,
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
  showGrid: () => Reflect.set(element, 'scene', gridScene()),
  showLines: () => Reflect.set(element, 'scene', lineScene()),
  showPoints: () => Reflect.set(element, 'scene', pointsScene()),
});
