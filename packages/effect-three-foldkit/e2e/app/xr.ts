/**
 * An immersive session in a headless browser: Meta's IWER emulates a Quest 3 behind
 * `navigator.xr`, and the test enters, moves the headset and exits through
 * `window.__xr`. The scene places the player two units along +x, turned to face +x.
 */
import { box, mesh, scene, standard, xr } from '@opsydyn/effect-three';
import { Effect, Queue, Stream } from 'effect';
import type { ViewState } from 'foldkit/mount';
import { metaQuest3, XRDevice } from 'iwer';

import * as EffectThreeFoldkit from '../../src/index.ts';
import { aimStraight, headOf, keyOf, modeOf, rendererFinder, shimOffsetSpaces } from './xrProbe.ts';

shimOffsetSpaces();
const device = new XRDevice(metaQuest3);
device.installRuntime({ forceInstall: true });

const environment = EffectThreeFoldkit.makeEnvironment(window);
const sceneMount = EffectThreeFoldkit.makeSceneMount(environment);

const element = document.createElement('effect-three-scene');
element.className = 'scene';
const described = scene({
  xr: xr({ origin: [2, 0, 0], heading: -Math.PI / 2 }),
  children: [
    mesh({
      key: 'cube',
      position: [4, 1.5, 0],
      geometry: box(),
      material: standard(),
      interactive: true,
    }),
  ],
});
Reflect.set(element, 'scene', described);
document.body.append(element);

const sessions: Array<string | null> = [];
element.addEventListener('scene-xr', (event) => sessions.push(modeOf(event)));

const clicks: Array<string> = [];
element.addEventListener('scene-click', (event) => clicks.push(keyOf(event)));

const viewStates = Effect.runSync(Queue.sliding<ViewState>(4));
Queue.offerUnsafe(viewStates, 'Live');
const lifecycle = sceneMount().f(element, Stream.fromQueue(viewStates));
Effect.runFork(Stream.runDrain(lifecycle));

const renderer = rendererFinder(element);

Reflect.set(globalThis, '__xr', {
  ready: () => renderer() !== undefined,
  supported: () => Effect.runPromise(environment.xr.supported('immersive-vr')),
  enter: () => Effect.runPromise(environment.xr.enter('immersive-vr')),
  exit: () => Effect.runPromise(environment.xr.exit),
  sessions: () => sessions,
  presenting: () => renderer()?.xr.isPresenting === true,
  frames: () => renderer()?.info.render.frame ?? 0,
  /** Moves the emulated headset, in its own reference space. */
  moveHead: (x: number, y: number, z: number) => {
    device.position.x = x;
    device.position.y = y;
    device.position.z = z;
  },
  head: () => headOf(renderer()),
  clicks: () => clicks,
  /** Points the right controller straight ahead (−z in the headset's space) from `y`. */
  aimRight: (y: number) => aimStraight(device.controllers.right, y),
  /** Pulls (1) or releases (0) the right controller's trigger: a select. */
  trigger: (value: number) => device.controllers.right?.updateButtonValue('trigger', value),
});
